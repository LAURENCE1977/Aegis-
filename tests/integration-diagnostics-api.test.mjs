import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet } from '../functions/api/integrations/diagnostics.js';
import { createSessionToken, sessionCookie } from '../functions/lib/auth.mjs';

const env = {
  AEGIS_PASSWORD: 'aegis-test-password',
  AEGIS_SESSION_SECRET: 'test-session-secret-that-is-long-enough-for-hmac',
};

async function request() {
  const token = await createSessionToken(env.AEGIS_SESSION_SECRET);
  return new Request('https://aegis.example/api/integrations/diagnostics', {
    headers: { Cookie: sessionCookie(token) },
  });
}

function database(rows) {
  return {
    prepare(sql) {
      return {
        values: [],
        bind(...values) { this.values = values; return this; },
        async all() {
          const [principalId, limit] = this.values;
          return {
            results: rows.filter(row => row.principal_id === principalId)
              .sort((a, b) => b.created_at.localeCompare(a.created_at))
              .slice(0, limit),
          };
        },
      };
    },
  };
}

test('connector diagnostics requires an authenticated owner session', async () => {
  const response = await onRequestGet({
    request: new Request('https://aegis.example/api/integrations/diagnostics'),
    env,
  });
  assert.equal(response.status, 401);
});

test('connector diagnostics returns a read-only baseline when connection storage is absent', async () => {
  const response = await onRequestGet({ request: await request(), env });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.storageConfigured, false);
  assert.equal(body.liveChecksEnabled, false);
  assert.equal(body.writesEnabled, false);
  assert.equal(body.executionEnabled, false);
  assert.ok(body.connectors.length >= 7);
  assert.ok(body.connectors.every(item => item.status === 'not_connected'));
});

test('vault-only provider metadata is not misreported as a verified live connection', async () => {
  const response = await onRequestGet({
    request: await request(),
    env: {
      ...env,
      AEGIS_DB: database([{
        id: 'connection-1',
        principal_id: 'owner',
        provider_id: 'instagram',
        secret_ref: 'vault://connections/550e8400-e29b-41d4-a716-446655440000',
        scopes_json: JSON.stringify(['instagram:profile:read']),
        status: 'active',
        created_by: 'owner',
        created_at: '2026-11-23T10:00:00.000Z',
        expires_at: null,
        revoked_at: null,
      }]),
    },
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  const instagram = body.connectors.find(item => item.providerId === 'instagram');
  assert.equal(instagram.status, 'configuration_error');
  assert.equal(instagram.credentialStored, true);
  assert.equal(instagram.readEnabled, false);
  assert.equal(instagram.writeEnabled, false);
  assert.equal(instagram.verificationState, 'pending');
  assert.equal(instagram.lastErrorCode, 'INVALID_CONFIGURATION');
  assert.equal(JSON.stringify(body).includes('vault://'), false);
});

test('diagnostics are owner-scoped and ignore unrelated provider connection records', async () => {
  const response = await onRequestGet({
    request: await request(),
    env: {
      ...env,
      AEGIS_DB: database([{
        id: 'foreign-connection',
        principal_id: 'another-owner',
        provider_id: 'github',
        secret_ref: 'vault://connections/550e8400-e29b-41d4-a716-446655440001',
        scopes_json: '[]',
        status: 'active',
        created_by: 'owner',
        created_at: '2026-11-23T10:00:00.000Z',
        expires_at: null,
        revoked_at: null,
      }]),
    },
  });
  const body = await response.json();
  const github = body.connectors.find(item => item.providerId === 'github');
  assert.equal(github.status, 'not_connected');
  assert.equal(github.credentialStored, false);
});
