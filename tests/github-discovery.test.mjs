import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverGitHubRepository } from '../functions/lib/github-discovery.mjs';

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
