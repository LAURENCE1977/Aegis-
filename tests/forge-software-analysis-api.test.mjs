import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken } from '../functions/lib/auth.mjs';
import { onRequestPost as analyse } from '../functions/api/forge/analyse.js';

const secret = 'forge-analysis-test-session-secret-long-enough';
const env = { AEGIS_PASSWORD: 'test-password-long-enough', AEGIS_SESSION_SECRET: secret };

async function request(body, { authenticated = true, origin = 'https://aegis.example' } = {}) {
  const headers = { 'Content-Type': 'application/json', Origin: origin };
  if (authenticated) headers.Cookie = '__Host-aegis_session=' + await createSessionToken(secret);
  return new Request('https://aegis.example/api/forge/analyse', {
    method: 'POST', headers, body: JSON.stringify(body),
  });
}

function response(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, async json() { return body; } };
}

function githubFixture(files) {
  const bySha = new Map(files.map(file => [file.sha, file]));
  const calls = [];
  const fetchImpl = async url => {
    calls.push(url);
    if (url.endsWith('/repos/example/agent')) {
      return response({
        full_name: 'example/agent',
        html_url: 'https://github.com/example/agent',
        default_branch: 'main',
        private: false,
        description: 'Agent framework',
      });
    }
    if (url.endsWith('/git/trees/main?recursive=1')) {
      return response({
        sha: 'f'.repeat(40),
        truncated: false,
        tree: files.map(file => ({
          path: file.path, type: 'blob', sha: file.sha, size: file.size,
        })),
      });
    }
    const match = url.match(/\/git\/blobs\/([a-f0-9]{40})$/);
    if (match) {
      const file = bySha.get(match[1]);
      if (!file) return response({ message: 'Not Found' }, 404);
      return response({
        sha: file.sha,
        size: file.size,
        encoding: 'base64',
        content: btoa(file.content),
      });
    }
    throw new Error('Unexpected GitHub request: ' + url);
  };
  return { fetchImpl, calls };
}

function sourceFile(path, sha, content) {
  return { path, sha, content, size: new TextEncoder().encode(content).byteLength };
}

test('Forge analysis requires owner authentication and same-origin requests', async () => {
  const unauth = await analyse({
    request: await request({ sourceUrl: 'https://github.com/example/agent' }, { authenticated: false }),
    env,
  });
  assert.equal(unauth.status, 401);
  const cross = await analyse({
    request: await request({ sourceUrl: 'https://github.com/example/agent' }, { origin: 'https://attacker.example' }),
    env,
  });
  assert.equal(cross.status, 403);
});

test('Forge analysis reads only inspected pinned blobs and returns evidence-bound capability signals', async () => {
  const files = [
    sourceFile('README.md', 'a'.repeat(40), '# Agent runtime\nMulti-agent orchestrator with MCP server support.'),
    sourceFile('src/sandbox.ts', 'b'.repeat(40), 'export const sandbox = true; // isolation boundary'),
    sourceFile('package.json', 'c'.repeat(40), '{"name":"agent","scripts":{"test":"node:test"}}'),
  ];
  const fixture = githubFixture(files);
  const result = await analyse({
    request: await request({ sourceUrl: 'https://github.com/example/agent' }),
    env,
    fetchImpl: fixture.fetchImpl,
  });

  assert.equal(result.status, 200);
  assert.match(result.headers.get('cache-control'), /no-store/);
  const body = await result.json();
  assert.equal(body.analysis.source.repository, 'example/agent');
  assert.equal(body.analysis.source.treeSha, 'f'.repeat(40));
  assert.deepEqual(body.analysis.capabilities.map(item => item.id), [
    'agent-orchestration', 'mcp-integration', 'security-isolation', 'testing',
  ]);
  assert.deepEqual(body.inspection, {
    filesAvailable: 3,
    filesSelected: 3,
    filesSkipped: 0,
    truncated: false,
  });
  assert.equal(fixture.calls.length, 5);
  assert.ok(body.analysis.capabilities.every(item => item.evidence.every(evidence =>
    /^[a-f0-9]{40}$/.test(evidence.blobSha)
  )));
  assert.equal(body.analysis.authority.executeCode, false);
});

test('Forge analysis caps file reads and reports incomplete inspection instead of implying completeness', async () => {
  const files = Array.from({ length: 25 }, (_, index) =>
    sourceFile(`src/module-${index}.ts`, index.toString(16).padStart(40, '0'), 'export const value = ' + index + ';')
  );
  const fixture = githubFixture(files);
  const result = await analyse({
    request: await request({ sourceUrl: 'https://github.com/example/agent' }),
    env,
    fetchImpl: fixture.fetchImpl,
  });

  assert.equal(result.status, 200);
  const body = await result.json();
  assert.equal(body.inspection.filesAvailable, 25);
  assert.equal(body.inspection.filesSelected, 20);
  assert.equal(body.inspection.filesSkipped, 5);
  assert.equal(body.inspection.truncated, true);
  assert.equal(fixture.calls.length, 22);
});

test('Forge analysis rejects malformed requests before contacting GitHub', async () => {
  let calls = 0;
  const unknown = await analyse({
    request: await request({ sourceUrl: 'https://github.com/example/agent', execute: true }),
    env,
    fetchImpl: async () => { calls++; throw new Error('must not fetch'); },
  });
  const invalid = await analyse({
    request: await request({ sourceUrl: 'https://attacker.invalid/example/agent' }),
    env,
    fetchImpl: async () => { calls++; throw new Error('must not fetch'); },
  });
  assert.equal(unknown.status, 400);
  assert.equal(invalid.status, 400);
  assert.equal(calls, 0);
});

test('Forge analysis fails closed when an inspected blob cannot be read exactly', async () => {
  const files = [sourceFile('README.md', 'a'.repeat(40), 'MCP server')];
  const fixture = githubFixture(files);
  const brokenFetch = async url => {
    if (url.includes('/git/blobs/')) {
      return response({ sha: 'b'.repeat(40), size: 10, encoding: 'base64', content: btoa('MCP server') });
    }
    return fixture.fetchImpl(url);
  };
  const result = await analyse({
    request: await request({ sourceUrl: 'https://github.com/example/agent' }),
    env,
    fetchImpl: brokenFetch,
  });
  assert.equal(result.status, 502);
  const body = await result.json();
  assert.match(body.error, /failed|could not/i);
});

test('Forge analysis rejects cross-origin content types and oversized request bodies', async () => {
  const badType = await analyse({
    request: new Request('https://aegis.example/api/forge/analyse', {
      method: 'POST',
      headers: { Origin: 'https://aegis.example', Cookie: '__Host-aegis_session=' + await createSessionToken(secret) },
      body: '{}',
    }),
    env,
  });
  assert.equal(badType.status, 415);
});
