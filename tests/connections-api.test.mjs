import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken } from '../functions/lib/auth.mjs';
import { resolveVaultSecret } from '../functions/lib/secret-vault.mjs';
import { onRequestGet, onRequestPost, onRequestDelete } from '../functions/api/connections.js';

const sessionSecret = 'connections-api-test-session-secret-with-enough-entropy';
const rawKey = new Uint8Array(32).fill(23);
const keyBase64 = btoa(String.fromCharCode(...rawKey));
const keyringEnv = {
  AEGIS_PASSWORD: 'test-password-long-enough',
  AEGIS_SESSION_SECRET: sessionSecret,
  AEGIS_VAULT_KEYRING: JSON.stringify({ v1: keyBase64 }),
  AEGIS_VAULT_ACTIVE_KEY_VERSION: 'v1',
};

class MemoryD1 {
  constructor() {
    this.connections = new Map();
    this.secrets = new Map();
  }
  prepare(sql) {
    const db = this;
    return {
      values: [],
      bind(...values) { this.values = values; return this; },
      async run() {
        const v = this.values;
        if (sql.includes('INSERT INTO capability_secrets')) {
          const [secretId, principalId, providerId, keyVersion, ivB64, ciphertextB64, createdAt, updatedAt] = v;
          db.secrets.set(secretId, {
            secret_id: secretId, principal_id: principalId, provider_id: providerId,
            key_version: keyVersion, iv_b64: ivB64, ciphertext_b64: ciphertextB64,
            created_at: createdAt, updated_at: updatedAt, status: 'active', revoked_at: null,
          });
          return { meta: { changes: 1 } };
        }
        if (sql.includes('INSERT INTO capability_connections')) {
          const [id, principalId, providerId, secretRef, scopesJson, createdBy, createdAt, expiresAt] = v;
          const existing = [...db.connections.values()].find(row =>
            row.principal_id === principalId && row.provider_id === providerId &&
            row.status === 'active' && (!row.expires_at || row.expires_at > createdAt));
          if (existing) return { meta: { changes: 0 } };
          db.connections.set(id, {
            id, principal_id: principalId, provider_id: providerId, secret_ref: secretRef,
            scopes_json: scopesJson, created_by: createdBy, created_at: createdAt,
            expires_at: expiresAt, status: 'active', revoked_at: null,
          });
          return { meta: { changes: 1 } };
        }
        if (sql.includes('UPDATE capability_secrets')) {
          const [updatedAt, revokedAt, secretId, principalId, providerId] = v;
          const row = db.secrets.get(secretId);
          if (!row || row.principal_id !== principalId || row.provider_id !== providerId || row.status !== 'active') {
            return { meta: { changes: 0 } };
          }
          Object.assign(row, { status: 'revoked', iv_b64: null, ciphertext_b64: null, updated_at: updatedAt, revoked_at: revokedAt });
          return { meta: { changes: 1 } };
        }
        if (sql.includes('UPDATE capability_connections')) {
          if (sql.includes('WHERE principal_id = ? AND provider_id = ?')) {
            const [revokedAt, principalId, providerId, expiry] = v;
            let changes = 0;
            for (const row of db.connections.values()) {
              if (row.principal_id === principalId && row.provider_id === providerId &&
                  row.status === 'active' && row.expires_at && row.expires_at <= expiry) {
                Object.assign(row, { status: 'revoked', revoked_at: revokedAt });
                changes += 1;
              }
            }
            return { meta: { changes } };
          }
          const [revokedAt, id, principalId] = v;
          const row = db.connections.get(id);
          if (!row || row.principal_id !== principalId || row.status !== 'active') return { meta: { changes: 0 } };
          Object.assign(row, { status: 'revoked', revoked_at: revokedAt });
          return { meta: { changes: 1 } };
        }
        return { meta: { changes: 0 } };
      },
      async first() {
        const v = this.values;
        if (sql.includes('FROM capability_connections') && sql.includes('WHERE id = ?')) {
          const row = db.connections.get(v[0]);
          return row && row.principal_id === v[1] ? { ...row } : null;
        }
        if (sql.includes('FROM capability_connections') && sql.includes('WHERE principal_id = ? AND provider_id = ?')) {
          const row = [...db.connections.values()].find(item =>
            item.principal_id === v[0] && item.provider_id === v[1] &&
            item.status === 'active' && item.expires_at > v[2]);
          return row ? { ...row } : null;
        }
        if (sql.includes('FROM capability_secrets')) {
          const row = db.secrets.get(v[0]);
          return row && row.principal_id === v[1] && row.provider_id === v[2] ? { ...row } : null;
        }
        return null;
      },
      async all() {
        if (sql.includes('FROM capability_connections')) {
          const principalId = this.values[0];
          return { results: [...db.connections.values()].filter(row => row.principal_id === principalId).map(row => ({ ...row })) };
        }
        return { results: [] };
      },
    };
  }
}

async function makeRequest(method, body, { authenticated = true, origin = 'https://aegis.example' } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (authenticated) headers.Cookie = '__Host-aegis_session=' + await createSessionToken(sessionSecret);
  if (origin !== null) headers.Origin = origin;
  return new Request('https://aegis.example/api/connections', {
    method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function connectionInput(secret = 'github-oauth-access-token-test') {
  return {
    providerId: 'github',
    capabilityId: 'aegis-github-private-metadata',
    actionIds: ['discover'],
    secret,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

test('connections API rejects unauthenticated and cross-origin writes before database access', async () => {
  const db = new MemoryD1();
  const unauth = await onRequestPost({
    request: await makeRequest('POST', connectionInput(), { authenticated: false }),
    env: { ...keyringEnv, AEGIS_DB: db },
  });
  assert.equal(unauth.status, 401);
  const crossOrigin = await onRequestPost({
    request: await makeRequest('POST', connectionInput(), { origin: 'https://attacker.example' }),
    env: { ...keyringEnv, AEGIS_DB: db },
  });
  assert.equal(crossOrigin.status, 403);
  assert.equal(db.secrets.size, 0);
});

test('connections API requires an approved OAuth capability and derives scopes server-side', async () => {
  const db = new MemoryD1();
  const bad = await onRequestPost({
    request: await makeRequest('POST', { ...connectionInput(), scopes: ['admin:*'] }),
    env: { ...keyringEnv, AEGIS_DB: db },
  });
  assert.equal(bad.status, 400);
  const unknown = await onRequestPost({
    request: await makeRequest('POST', { ...connectionInput(), capabilityId: 'unknown-capability' }),
    env: { ...keyringEnv, AEGIS_DB: db },
  });
  assert.equal(unknown.status, 400);
  assert.equal(db.secrets.size, 0);
});

test('connections API refuses to store credentials when the vault keyring is missing', async () => {
  const db = new MemoryD1();
  const response = await onRequestPost({
    request: await makeRequest('POST', connectionInput()),
    env: { AEGIS_PASSWORD: keyringEnv.AEGIS_PASSWORD, AEGIS_SESSION_SECRET: sessionSecret, AEGIS_DB: db },
  });
  assert.equal(response.status, 503);
  assert.equal(db.secrets.size, 0);
  assert.equal(db.connections.size, 0);
});

test('connections API encrypts the token, returns safe metadata and lists no secret references', async () => {
  const db = new MemoryD1();
  const secret = 'github-oauth-access-token-test';
  const response = await onRequestPost({
    request: await makeRequest('POST', connectionInput(secret)),
    env: { ...keyringEnv, AEGIS_DB: db },
  });
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.connection.providerId, 'github');
  assert.deepEqual(body.connection.scopes, ['github:private-metadata:read']);
  assert.equal('secretRef' in body.connection, false);
  assert.equal(JSON.stringify(body).includes(secret), false);
  assert.equal(db.secrets.size, 1);
  const secretRow = [...db.secrets.values()][0];
  assert.notEqual(secretRow.ciphertext_b64, secret);
  assert.equal(await resolveVaultSecret(db, {
    principalId: 'owner', providerId: 'github', secretRef: 'vault://connections/' + secretRow.secret_id,
  }, keyringEnv), secret);

  const listed = await onRequestGet({
    request: await makeRequest('GET'),
    env: { ...keyringEnv, AEGIS_DB: db },
  });
  assert.equal(listed.status, 200);
  const listBody = await listed.json();
  assert.equal(listBody.connections.length, 1);
  assert.equal('secretRef' in listBody.connections[0], false);
});

test('connections API revocation erases ciphertext and deactivates the connection', async () => {
  const db = new MemoryD1();
  const created = await onRequestPost({
    request: await makeRequest('POST', connectionInput()),
    env: { ...keyringEnv, AEGIS_DB: db },
  });
  const connection = (await created.json()).connection;
  const row = [...db.connections.values()][0];
  const secretRef = row.secret_ref;
  const response = await onRequestDelete({
    request: await makeRequest('DELETE', { id: connection.id }),
    env: { ...keyringEnv, AEGIS_DB: db },
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.revoked, true);
  assert.equal(body.vaultErased, true);
  assert.equal(db.connections.get(connection.id).status, 'revoked');
  const secretRow = [...db.secrets.values()][0];
  assert.equal(secretRow.status, 'revoked');
  assert.equal(secretRow.iv_b64, null);
  assert.equal(secretRow.ciphertext_b64, null);
  assert.equal(await resolveVaultSecret(db, {
    principalId: 'owner', providerId: 'github', secretRef,
  }, keyringEnv), null);
});

test('connections API cannot revoke another principal connection', async () => {
  const db = new MemoryD1();
  const response = await onRequestDelete({
    request: await makeRequest('DELETE', { id: 'not-owned' }),
    env: { ...keyringEnv, AEGIS_DB: db },
  });
  assert.equal(response.status, 404);
});
