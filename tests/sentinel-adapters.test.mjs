import test from 'node:test';
import assert from 'node:assert/strict';
import { createBuiltinAdapterRegistry } from '../functions/lib/sentinel-adapters.mjs';

test('exposes the local module catalogue as a read-only built-in adapter', async () => {
  const adapters = createBuiltinAdapterRegistry();
  const handler = adapters['aegis-module-catalogue:list'];
  assert.equal(typeof handler, 'function');

  const result = await handler({}, {
    capabilityId: 'aegis-module-catalogue',
    actionId: 'list',
  });
  assert.equal(result.total, result.modules.length);
  assert.ok(result.modules.length > 0);
  assert.ok(result.modules.every((module) => Array.isArray(module.permissions) && module.permissions.length === 0));
  assert.ok(result.modules.every((module) => module.status === 'planned' || module.status === 'available'));
});

test('rejects unexpected input rather than treating it as a command', async () => {
  const adapters = createBuiltinAdapterRegistry();
  await assert.rejects(() => adapters['aegis-module-catalogue:list']({
    command: 'run-shell',
  }, {}), /does not accept input/i);
});
test('discovers only public GitHub metadata through the fixed api.github.com host', async () => {
  let requestedUrl;
  let requestedOptions;
  const adapters = createBuiltinAdapterRegistry({
    fetchImpl: async (url, options) => {
      requestedUrl = url;
      requestedOptions = options;
      return new Response(JSON.stringify({
        full_name: 'Example/Repo',
        html_url: 'https://github.com/Example/Repo',
        description: 'Public repository',
        default_branch: 'main',
        private: false,
        archived: false,
        fork: false,
        pushed_at: '2026-11-01T00:00:00Z',
        stargazers_count: 12,
        language: 'TypeScript',
        license: { spdx_id: 'MIT', name: 'MIT License' },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    },
  });
  const result = await adapters['aegis-github-public-discovery:discover']({
    sourceUrl: 'https://github.com/Example/Repo',
  }, {});
  assert.equal(requestedUrl, 'https://api.github.com/repos/Example/Repo');
  assert.equal(requestedOptions.redirect, 'error');
  assert.ok(requestedOptions.signal);
  assert.equal(result.fullName, 'Example/Repo');
  assert.equal(result.private, false);
  assert.equal(result.primaryLanguage, 'TypeScript');
  assert.equal('files' in result, false);
});

test('GitHub adapter rejects arbitrary input fields and non-canonical hosts before fetching', async () => {
  let calls = 0;
  const adapters = createBuiltinAdapterRegistry({ fetchImpl: async () => { calls += 1; throw new Error('unexpected'); } });
  await assert.rejects(() => adapters['aegis-github-public-discovery:discover']({
    sourceUrl: 'https://github.com/Example/Repo',
    endpoint: 'https://attacker.example/collect',
  }, {}), /exact sourceUrl/i);
  await assert.rejects(() => adapters['aegis-github-public-discovery:discover']({
    sourceUrl: 'https://attacker.example/Example/Repo',
  }, {}));
  assert.equal(calls, 0);
});

test('GitHub adapter enforces a bounded response body', async () => {
  const adapters = createBuiltinAdapterRegistry({
    maxResponseBytes: 1024,
    fetchImpl: async () => new Response('x'.repeat(2048), {
      status: 200,
      headers: { 'Content-Length': '2048' },
    }),
  });
  await assert.rejects(() => adapters['aegis-github-public-discovery:discover']({
    sourceUrl: 'https://github.com/Example/Repo',
  }, {}));
});
