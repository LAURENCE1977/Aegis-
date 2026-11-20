import test from 'node:test';
import assert from 'node:assert/strict';
import { createComposioToolAdapter } from '../functions/lib/composio-adapter.mjs';

const apiKey = 'composio-project-key-for-tests-only';
const context = {
  integrationToolSlug: 'GITHUB_GET_REPO',
  integrationPlatformAccountId: 'ca_github_owner_123456',
  integrationAllowedToolSlugs: ['GITHUB_GET_REPO'],
  integrationConnectionType: 'owner_private',
};

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

test('Composio adapter executes only the exact preflight-allowlisted tool on its selected private account', async () => {
  let request;
  const adapter = createComposioToolAdapter({
    apiKey,
    fetchImpl: async (url, options) => {
      request = { url, options };
      return jsonResponse({ data: { repository: 'Aegis-' }, successful: true });
    },
  });

  const output = await adapter(
    { arguments: { owner: 'LAURENCE1977', repo: 'Aegis-' }, version: '20251120_00' },
    context,
  );

  assert.equal(request.url, 'https://backend.composio.dev/api/v3.1/tools/execute/GITHUB_GET_REPO');
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.redirect, 'error');
  assert.equal(request.options.headers['x-api-key'], apiKey);
  assert.deepEqual(JSON.parse(request.options.body), {
    connected_account_id: context.integrationPlatformAccountId,
    arguments: { owner: 'LAURENCE1977', repo: 'Aegis-' },
    version: '20251120_00',
  });
  assert.deepEqual(output, { data: { repository: 'Aegis-' }, successful: true });
});

test('Composio adapter refuses missing project credentials before network access', async () => {
  let called = false;
  const adapter = createComposioToolAdapter({
    apiKey: '',
    fetchImpl: async () => { called = true; return jsonResponse({}); },
  });
  await assert.rejects(
    adapter({ arguments: {}, version: '20251120_00' }, context),
    /Composio project credentials are unavailable/,
  );
  assert.equal(called, false);
});

test('Composio adapter refuses a tool slug not present in the exact connection allowlist', async () => {
  let called = false;
  const adapter = createComposioToolAdapter({
    apiKey,
    fetchImpl: async () => { called = true; return jsonResponse({}); },
  });
  await assert.rejects(
    adapter({ arguments: {}, version: '20251120_00' }, {
      ...context,
      integrationToolSlug: 'GITHUB_DELETE_REPO',
    }),
    /not allowlisted/,
  );
  assert.equal(called, false);
});

test('Composio adapter rejects shared accounts until a verified user identity mapping exists', async () => {
  let called = false;
  const adapter = createComposioToolAdapter({
    apiKey,
    fetchImpl: async () => { called = true; return jsonResponse({}); },
  });
  await assert.rejects(
    adapter({ arguments: {}, version: '20251120_00' }, {
      ...context,
      integrationConnectionType: 'workspace_shared',
    }),
    /private owner connection/,
  );
  assert.equal(called, false);
});

test('Composio adapter rejects free-form text, malformed arguments and unpinned versions', async () => {
  const adapter = createComposioToolAdapter({ apiKey, fetchImpl: async () => jsonResponse({}) });
  for (const input of [
    { text: 'do anything' },
    { arguments: [] , version: '20251120_00' },
    { arguments: {}, version: 'latest' },
    { arguments: {}, version: '2025-11-20' },
    { arguments: {}, version: '20251120_00', endpoint: 'https://attacker.example' },
  ]) {
    await assert.rejects(adapter(input, context));
  }
});

test('Composio adapter fails closed on upstream errors and oversized responses', async () => {
  const failed = createComposioToolAdapter({
    apiKey,
    fetchImpl: async () => jsonResponse({ error: 'private upstream detail' }, 403),
  });
  await assert.rejects(failed({ arguments: {}, version: '20251120_00' }, context), /upstream request failed/);

  const oversized = createComposioToolAdapter({
    apiKey,
    maxResponseBytes: 1024,
    fetchImpl: async () => new Response('x'.repeat(2048), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  });
  await assert.rejects(oversized({ arguments: {}, version: '20251120_00' }, context), /response exceeds/);
});
