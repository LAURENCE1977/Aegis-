import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken } from '../functions/lib/auth.mjs';
import { discoverGitHubRepository } from '../functions/lib/github-discovery.mjs';
import { onRequestPost } from '../functions/api/forge/discover.js';

const secret = 'test-only-forge-session-secret-with-sufficient-entropy';
const configuredEnv = {
  AEGIS_PASSWORD: 'a-long-test-password-value',
  AEGIS_SESSION_SECRET: secret,
};

test('GitHub discovery normalises public repository metadata without fetching source code', async () => {
  let requestedUrl = '';
  let requestedOptions;
  const result = await discoverGitHubRepository('https://github.com/Example/Useful-Tool', async (url, options) => {
    requestedUrl = url;
    requestedOptions = options;
    return new Response(JSON.stringify({
      full_name: 'Example/Useful-Tool',
      html_url: 'https://github.com/Example/Useful-Tool',
      description: 'A useful open-source tool',
      default_branch: 'main',
      archived: false,
      fork: false,
      private: false,
      pushed_at: '2026-11-01T12:00:00Z',
      stargazers_count: 123,
      language: 'TypeScript',
      license: { spdx_id: 'MIT', name: 'MIT License' },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });

  assert.equal(requestedUrl, 'https://api.github.com/repos/Example/Useful-Tool');
  assert.equal(requestedOptions.redirect, 'error');
  assert.equal(result.fullName, 'Example/Useful-Tool');
  assert.equal(result.licenseSpdx, 'MIT');
  assert.equal(result.defaultBranch, 'main');
  assert.equal(result.private, false);
  assert.equal(result.sourceUrl, 'https://github.com/Example/Useful-Tool');
});

test('GitHub discovery rejects non-GitHub, non-HTTPS and ambiguous source URLs', async () => {
  const neverFetch = async () => { throw new Error('must not fetch'); };
  await assert.rejects(discoverGitHubRepository('http://github.com/a/b', neverFetch));
  await assert.rejects(discoverGitHubRepository('https://evil.example/a/b', neverFetch));
  await assert.rejects(discoverGitHubRepository('https://github.com/a/b/issues/1', neverFetch));
  await assert.rejects(discoverGitHubRepository('https://user:pass@github.com/a/b', neverFetch));
  await assert.rejects(discoverGitHubRepository('https://github.com/a/b?tab=readme', neverFetch));
});

test('GitHub discovery rejects malformed API payloads', async () => {
  await assert.rejects(discoverGitHubRepository('https://github.com/a/b', async () =>
    new Response(JSON.stringify({ message: 'not a repository payload' }), { status: 200 })));
});

test('GitHub discovery reports missing and private repositories without exposing raw responses', async () => {
  await assert.rejects(
    discoverGitHubRepository('https://github.com/a/missing', async () =>
      new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 })),
    (error) => error.status === 404 && !String(error.message).includes('Not Found'),
  );
});

test('Forge discovery API fails closed when authentication is not configured', async () => {
  const response = await onRequestPost({
    request: new Request('https://aegis.example/api/forge/discover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://aegis.example' },
      body: JSON.stringify({ sourceUrl: 'https://github.com/example/repo' }),
    }),
    env: {},
  });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('Forge discovery API rejects unauthenticated and cross-origin requests', async () => {
  const unauthenticated = await onRequestPost({
    request: new Request('https://aegis.example/api/forge/discover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://aegis.example' },
      body: JSON.stringify({ sourceUrl: 'https://github.com/example/repo' }),
    }),
    env: configuredEnv,
  });
  const token = await createSessionToken(secret);
  const crossOrigin = await onRequestPost({
    request: new Request('https://aegis.example/api/forge/discover', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://attacker.example',
        Cookie: '__Host-aegis_session=' + token,
      },
      body: JSON.stringify({ sourceUrl: 'https://github.com/example/repo' }),
    }),
    env: configuredEnv,
  });
  assert.equal(unauthenticated.status, 401);
  assert.equal(crossOrigin.status, 403);
});

test('Forge discovery API returns safe metadata for an authenticated same-origin request', async () => {
  const token = await createSessionToken(secret);
  const response = await onRequestPost({
    request: new Request('https://aegis.example/api/forge/discover', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://aegis.example',
        Cookie: '__Host-aegis_session=' + token,
      },
      body: JSON.stringify({ sourceUrl: 'https://github.com/example/repo' }),
    }),
    env: configuredEnv,
    fetchImpl: async () => new Response(JSON.stringify({
      full_name: 'example/repo',
      html_url: 'https://github.com/example/repo',
      default_branch: 'main',
      private: false,
      license: { spdx_id: 'Apache-2.0', name: 'Apache License 2.0' },
    }), { status: 200 }),
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  const body = await response.json();
  assert.equal(body.repository.fullName, 'example/repo');
  assert.equal(body.repository.licenseSpdx, 'Apache-2.0');
  assert.equal(body.repository.private, false);
});


test('Forge discovery API bounds streaming request reads before GitHub fetch', async () => {
  const token = await createSessionToken(secret);
  let fetchCalls = 0;
  const response = await onRequestPost({
    request: new Request('https://aegis.example/api/forge/discover', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://aegis.example',
        Cookie: '__Host-aegis_session=' + token,
      },
      body: JSON.stringify({ sourceUrl: 'https://github.com/example/' + 'x'.repeat(5000) }),
    }),
    env: configuredEnv,
    fetchImpl: async () => { fetchCalls++; throw new Error('must not fetch'); },
  });
  assert.equal(response.status, 413);
  assert.equal(fetchCalls, 0);
});


test('GitHub API requests use an abort signal and explicitly reject redirects', async () => {
  let options;
  await discoverGitHubRepository('https://github.com/example/repo', async (_url, requestOptions) => {
    options = requestOptions;
    return new Response(JSON.stringify({
      full_name: 'example/repo',
      html_url: 'https://github.com/example/repo',
      default_branch: 'main',
      private: false,
    }), { status: 200 });
  });
  assert.equal(options.redirect, 'error');
  assert.ok(options.signal instanceof AbortSignal);
});

test('GitHub source inspection rejects oversized API response bodies', async () => {
  await assert.rejects(
    discoverGitHubRepository('https://github.com/example/repo', async () =>
      new Response(JSON.stringify({
        full_name: 'example/repo',
        html_url: 'https://github.com/example/repo',
        default_branch: 'main',
        private: false,
        description: 'x'.repeat(1_100_000),
      }), { status: 200 })),
    (error) => error.status === 413 && /response.*size|too large/i.test(error.message),
  );
});
