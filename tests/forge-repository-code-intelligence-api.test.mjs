import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken } from '../functions/lib/auth.mjs';
import { onRequestPost } from '../functions/api/forge/repository-code-intelligence.js';

const secret = 'forge-repository-code-intelligence-secret-long-enough';
const env = { AEGIS_PASSWORD: 'test-password-long-enough', AEGIS_SESSION_SECRET: secret };
const sourceUrl = 'https://github.com/example/project';
const treeSha = '1'.repeat(40);
const mainSha = 'a'.repeat(40);
const depSha = 'b'.repeat(40);

async function request(body, { authenticated = true, origin = 'https://aegis.example' } = {}) {
  const headers = { 'Content-Type': 'application/json', Origin: origin };
  if (authenticated) headers.Cookie = '__Host-aegis_session=' + await createSessionToken(secret);
  return new Request('https://aegis.example/api/forge/repository-code-intelligence', {
    method: 'POST', headers, body: JSON.stringify(body),
  });
}
function response(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, async json() { return body; } };
}
function githubFetch({ changedTree = false } = {}) {
  const calls = [];
  const fetchImpl = async url => {
    calls.push(String(url));
    if (String(url).endsWith('/repos/example/project')) return response({
      full_name: 'example/project', html_url: sourceUrl, default_branch: 'main', private: false,
    });
    if (String(url).endsWith('/git/trees/main?recursive=1')) return response({
      sha: changedTree ? '2'.repeat(40) : treeSha, truncated: false,
      tree: [
        { path: 'src/main.ts', type: 'blob', sha: mainSha, size: 23 },
        { path: 'src/core.ts', type: 'blob', sha: depSha, size: 24 },
      ],
    });
    if (String(url).endsWith('/git/blobs/' + mainSha)) return response({
      sha: mainSha, size: 23, encoding: 'base64', content: btoa("import './core';\nexport {};"),
    });
    if (String(url).endsWith('/git/blobs/' + depSha)) return response({
      sha: depSha, size: 24, encoding: 'base64', content: btoa('export const core = true;'),
    });
    throw new Error('Unexpected GitHub request: ' + url);
  };
  return { fetchImpl, calls };
}

test('repository code intelligence requires authentication and same-origin requests', async () => {
  const unauth = await onRequestPost({
    request: await request({ sourceUrl, treeSha, files: [] }, { authenticated: false }), env,
  });
  assert.equal(unauth.status, 401);
  const cross = await onRequestPost({
    request: await request({ sourceUrl, treeSha, files: [] }, { origin: 'https://attacker.example' }), env,
  });
  assert.equal(cross.status, 403);
});

test('analyses only selected blobs whose paths and SHAs match the pinned repository tree', async () => {
  const { fetchImpl, calls } = githubFetch();
  const result = await onRequestPost({
    request: await request({ sourceUrl, treeSha, files: [
      { path: 'src/main.ts', sha: mainSha },
      { path: 'src/core.ts', sha: depSha },
    ] }), env, fetchImpl,
  });
  assert.equal(result.status, 200);
  const body = await result.json();
  assert.equal(body.repository.treeSha, treeSha);
  assert.equal(body.graph.execution, 'none');
  assert.equal(body.graph.nodes.length, 2);
  assert.equal(body.graph.edges.length, 1);
  assert.equal(calls.length, 4);
});

test('rejects a stale tree revision before reading any source blobs', async () => {
  const { fetchImpl, calls } = githubFetch({ changedTree: true });
  const result = await onRequestPost({
    request: await request({ sourceUrl, treeSha, files: [{ path: 'src/main.ts', sha: mainSha }] }),
    env, fetchImpl,
  });
  assert.equal(result.status, 409);
  assert.equal(calls.length, 2);
});

test('rejects unlisted paths, mismatched blob SHAs and oversized selections before blob reads', async () => {
  for (const files of [
    [{ path: 'README.md', sha: mainSha }],
    [{ path: 'src/main.ts', sha: depSha }],
    Array.from({ length: 51 }, (_, i) => ({ path: 'src/' + i + '.ts', sha: mainSha })),
  ]) {
    const { fetchImpl, calls } = githubFetch();
    const result = await onRequestPost({
      request: await request({ sourceUrl, treeSha, files }), env, fetchImpl,
    });
    assert.equal(result.status, 400);
    assert.equal(calls.length, 2);
  }
});

test('rejects unknown request fields without contacting GitHub', async () => {
  let calls = 0;
  const result = await onRequestPost({
    request: await request({ sourceUrl, treeSha, files: [], execute: true }),
    env, fetchImpl: async () => { calls++; throw new Error('must not fetch'); },
  });
  assert.equal(result.status, 400);
  assert.equal(calls, 0);
});
