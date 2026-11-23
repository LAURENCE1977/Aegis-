import test from 'node:test';
import assert from 'node:assert/strict';
import { createComposioBridge } from '../functions/lib/composio-bridge.mjs';

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('bridge refuses to initialise without a project API key and stable user ID', () => {
  assert.throws(() => createComposioBridge({ apiKey: '', userId: 'aegis-owner' }), /configuration/i);
  assert.throws(() => createComposioBridge({ apiKey: 'project-key', userId: '' }), /configuration/i);
});

test('lists only safe connection metadata for the configured Composio user', async () => {
  const calls = [];
  const bridge = createComposioBridge({
    apiKey: 'project-key',
    userId: 'aegis-owner',
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return response({ data: [
        { id: 'ca-gh', status: 'ACTIVE', toolkit: { slug: 'github' }, state: { val: { access_token: 'never-return-this' } } },
        { id: 'ca-cf', status: 'INACTIVE', toolkit: { slug: 'cloudflare_api_key' } },
      ] });
    },
  });

  const accounts = await bridge.listConnectedAccounts();
  assert.deepEqual(accounts, [
    { id: 'ca-gh', toolkit: 'github', status: 'ACTIVE' },
    { id: 'ca-cf', toolkit: 'cloudflare_api_key', status: 'INACTIVE' },
  ]);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /connected_accounts/);
  assert.match(calls[0].url, /user_ids=aegis-owner/);
  assert.equal(calls[0].init.headers['x-api-key'], 'project-key');
  assert.equal(JSON.stringify(accounts).includes('never-return-this'), false);
});

test('rejects any tool outside the explicit read-only allowlist before network access', async () => {
  let calls = 0;
  const bridge = createComposioBridge({
    apiKey: 'project-key',
    userId: 'aegis-owner',
    fetchImpl: async () => { calls += 1; return response({ data: [] }); },
  });

  await assert.rejects(
    bridge.executeReadOnlyTool({ toolSlug: 'GITHUB_DELETE_REPOSITORY', connectedAccountId: 'ca-gh', arguments: {} }),
    /not allowlisted/i,
  );
  assert.equal(calls, 0);
});

test('requires an active matching connection before executing an allowlisted read-only tool', async () => {
  const calls = [];
  const bridge = createComposioBridge({
    apiKey: 'project-key',
    userId: 'aegis-owner',
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      if (String(url).includes('/connected_accounts')) {
        return response({ data: [{ id: 'ca-gh', status: 'ACTIVE', toolkit: { slug: 'github' } }] });
      }
      return response({ data: { ok: true } });
    },
  });

  await assert.rejects(
    bridge.executeReadOnlyTool({ toolSlug: 'GITHUB_GET_THE_AUTHENTICATED_USER', connectedAccountId: 'ca-other', arguments: {} }),
    /active matching connection/i,
  );
  assert.equal(calls.length, 1);
});

test('executes an allowlisted read-only tool through the fixed Composio origin', async () => {
  const calls = [];
  const bridge = createComposioBridge({
    apiKey: 'project-key',
    userId: 'aegis-owner',
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      if (String(url).includes('/connected_accounts')) {
        return response({ data: [{ id: 'ca-gh', status: 'ACTIVE', toolkit: { slug: 'github' } }] });
      }
      return response({ data: { login: 'LAURENCE1977' } });
    },
  });

  const result = await bridge.executeReadOnlyTool({
    toolSlug: 'GITHUB_GET_THE_AUTHENTICATED_USER',
    connectedAccountId: 'ca-gh',
    arguments: {},
  });
  assert.deepEqual(result, { data: { login: 'LAURENCE1977' } });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].url, 'https://backend.composio.dev/api/v3.1/tools/execute/GITHUB_GET_THE_AUTHENTICATED_USER');
  assert.equal(calls[1].init.headers['x-api-key'], 'project-key');
  assert.equal(JSON.parse(calls[1].init.body).connected_account_id, 'ca-gh');
  assert.equal(JSON.parse(calls[1].init.body).user_id, 'aegis-owner');
  assert.equal(JSON.parse(calls[1].init.body).version, 'latest');
});

test('normalises provider failures without leaking response bodies', async () => {
  const bridge = createComposioBridge({
    apiKey: 'project-key',
    userId: 'aegis-owner',
    fetchImpl: async (url) => String(url).includes('/connected_accounts')
      ? response({ data: [{ id: 'ca-gh', status: 'ACTIVE', toolkit: { slug: 'github' } }] })
      : response({ error: 'private provider diagnostic' }, 500),
  });

  await assert.rejects(
    bridge.executeReadOnlyTool({ toolSlug: 'GITHUB_GET_THE_AUTHENTICATED_USER', connectedAccountId: 'ca-gh', arguments: {} }),
    (error) => error.code === 'COMPOSIO_UPSTREAM_ERROR' && !error.message.includes('private provider diagnostic'),
  );
});
