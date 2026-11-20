import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken } from '../functions/lib/auth.mjs';
import { onRequestGet } from '../functions/api/integrations.js';

const secret = 'integration-api-test-session-secret-with-enough-entropy';
const envBase = {
  AEGIS_PASSWORD: 'integration-api-password-long',
  AEGIS_SESSION_SECRET: secret,
};

class MemoryD1 {
  constructor() {
    this.providers = [{
      id: 'composio',
      display_name: 'Composio',
      source_url: 'https://composio.dev/',
      verified_at: '2026-11-16T00:00:00.000Z',
      status: 'reviewed',
      created_by: 'owner',
      created_at: '2026-11-16T00:00:00.000Z',
    }];
    this.integrations = [{
      id: 'composio-github',
      provider_id: 'composio',
      slug: 'github',
      display_name: 'GitHub',
      description: 'GitHub toolkit.',
      auth_mode: 'shared_platform_account',
      source_url: 'https://composio.dev/toolkits/github',
      schema_version: 'v1',
      schema_hash: 'sha256:' + 'a'.repeat(64),
      status: 'reviewed',
      created_by: 'owner',
      created_at: '2026-11-16T00:00:00.000Z',
    }];
    this.connections = [{
      id: 'integration-connection-1',
      principal_id: 'owner',
      integration_id: 'composio-github',
      connection_key: 'github-personal',
      connection_type: 'instant_platform_managed',
      auth_mode: 'shared_platform_account',
      account_alias: 'Personal GitHub',
      platform_account_id: 'private-opaque-account-id',
      platform_connection_id: 'private-platform-credential-id',
      allowed_tool_slugs_json: '["GITHUB_GET_REPO"]',
      scopes_json: '["github:public-metadata:read"]',
      status: 'connected_unverified',
      last_observed_at: '2026-11-16T00:00:00.000Z',
      health_state: 'unknown',
      health_checked_at: null,
      created_by: 'owner',
      created_at: '2026-11-16T00:00:00.000Z',
      updated_at: '2026-11-16T00:00:00.000Z',
      revoked_at: null,
    }, {
      id: 'integration-connection-other-owner',
      principal_id: 'other-owner',
      integration_id: 'composio-github',
      connection_key: 'github-other',
      connection_type: 'instant_platform_managed',
      auth_mode: 'shared_platform_account',
      account_alias: 'Other owner',
      platform_account_id: 'other-account',
      platform_connection_id: null,
      allowed_tool_slugs_json: '["GITHUB_GET_REPO"]',
      scopes_json: '[]',
      status: 'connected_unverified',
      last_observed_at: '2026-11-16T00:00:00.000Z',
      health_state: 'unknown',
      health_checked_at: null,
      created_by: 'owner',
      created_at: '2026-11-16T00:00:00.000Z',
      updated_at: '2026-11-16T00:00:00.000Z',
      revoked_at: null,
    }];
  }
  prepare(sql) {
    const db = this;
    return {
      values: [],
      bind(...values) { this.values = values; return this; },
      async all() {
        if (sql.includes('FROM integration_providers')) {
          return { results: db.providers.slice(0, this.values[0]).map(row => ({ ...row })) };
        }
        if (sql.includes('FROM integration_definitions')) {
          return { results: db.integrations.slice(0, this.values[0]).map(row => ({ ...row })) };
        }
        if (sql.includes('FROM integration_connections')) {
          const [principalId, limit] = this.values;
          return { results: db.connections.filter(row => row.principal_id === principalId).slice(0, limit).map(row => ({ ...row })) };
        }
        return { results: [] };
      },
    };
  }
}

async function request(authenticated = true) {
  const headers = {};
  if (authenticated) headers.Cookie = '__Host-aegis_session=' + await createSessionToken(secret);
  return new Request('https://aegis.example/api/integrations', { headers });
}

test('integration inventory rejects unauthenticated reads before touching D1', async () => {
  const response = await onRequestGet({
    request: await request(false),
    env: { ...envBase, AEGIS_DB: { prepare() { throw new Error('must not access D1'); } } },
  });
  assert.equal(response.status, 401);
});

test('integration inventory fails closed when authentication is not configured', async () => {
  const response = await onRequestGet({
    request: await request(),
    env: { AEGIS_DB: new MemoryD1() },
  });
  assert.equal(response.status, 503);
});

test('integration inventory fails closed when D1 is unavailable', async () => {
  const response = await onRequestGet({ request: await request(), env: envBase });
  assert.equal(response.status, 503);
});

test('integration inventory returns owner-scoped safe provider, integration and connection metadata', async () => {
  const response = await onRequestGet({
    request: await request(),
    env: { ...envBase, AEGIS_DB: new MemoryD1() },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  const body = await response.json();
  assert.equal(body.providers.length, 1);
  assert.equal(body.integrations.length, 1);
  assert.equal(body.connections.length, 1);
  assert.equal(body.connections[0].accountAlias, 'Personal GitHub');
  assert.deepEqual(body.connections[0].allowedToolSlugs, ['GITHUB_GET_REPO']);
  assert.deepEqual(body.connections[0].scopes, ['github:public-metadata:read']);
  assert.equal('principalId' in body.connections[0], false);
  assert.equal('platformAccountId' in body.connections[0], false);
  assert.equal('platformConnectionId' in body.connections[0], false);
  assert.equal('secretRef' in body.connections[0], false);
  assert.equal('apiKey' in body.connections[0], false);
});

test('integration inventory rejects malformed or tampered session tokens', async () => {
  const response = await onRequestGet({
    request: new Request('https://aegis.example/api/integrations', {
      headers: { Cookie: '__Host-aegis_session=not.a.valid.token' },
    }),
    env: { ...envBase, AEGIS_DB: new MemoryD1() },
  });
  assert.equal(response.status, 401);
});
