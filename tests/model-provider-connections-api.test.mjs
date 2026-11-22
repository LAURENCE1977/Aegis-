import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken } from '../functions/lib/auth.mjs';
import { onRequestGet, onRequestPost, onRequestDelete } from '../functions/api/model-provider-connections.js';

const secretKey = crypto.getRandomValues(new Uint8Array(32));
const keyB64 = btoa(String.fromCharCode(...secretKey));
const sessionSecret = 'model-provider-api-test-session-secret-with-enough-entropy';
const envBase = {
  AEGIS_PASSWORD: 'test-password-long-enough',
  AEGIS_SESSION_SECRET: sessionSecret,
  AEGIS_VAULT_KEYRING: JSON.stringify({ v1: keyB64 }),
  AEGIS_VAULT_ACTIVE_KEY_VERSION: 'v1',
};

class MemoryD1 {
  constructor() { this.secrets = new Map(); this.connections = new Map(); }
  prepare(sql) {
    const db = this;
    return {
      values: [],
      bind(...values) { this.values = values; return this; },
      async run() {
        const v = this.values;
        if (sql.includes('INSERT INTO capability_secrets')) {
          const [id, principal, provider, keyVersion, iv, ciphertext, createdAt] = v;
          db.secrets.set(id, {
            secret_id: id, principal_id: principal, provider_id: provider,
            key_version: keyVersion, iv_b64: iv, ciphertext_b64: ciphertext,
            created_at: createdAt, updated_at: createdAt, status: 'active', revoked_at: null,
          });
          return { meta: { changes: 1 } };
        }
        if (sql.includes('UPDATE capability_secrets') && sql.includes("status = 'revoked'")) {
          const [updatedAt, revokedAt, id, principal, provider] = v;
          const row = db.secrets.get(id);
          if (!row || row.principal_id !== principal || row.provider_id !== provider || row.status !== 'active') {
            return { meta: { changes: 0 } };
          }
          Object.assign(row, { status: 'revoked', iv_b64: null, ciphertext_b64: null, updated_at: updatedAt, revoked_at: revokedAt });
          return { meta: { changes: 1 } };
        }
        if (sql.includes('UPDATE capability_connections') && sql.includes('expires_at <= ?')) {
          const [revokedAt, principal, provider, now] = v;
          let changes = 0;
          for (const row of db.connections.values()) {
            if (row.principal_id === principal && row.provider_id === provider && row.status === 'active' &&
                row.expires_at && row.expires_at <= now) {
              row.status = 'revoked'; row.revoked_at = revokedAt; changes += 1;
            }
          }
          return { meta: { changes } };
        }
        if (sql.includes('INSERT INTO capability_connections')) {
          const [id, principal, provider, secretRef, scopes, createdBy, createdAt, expiresAt] = v;
          if ([...db.connections.values()].some(row => row.principal_id === principal && row.provider_id === provider &&
              row.status === 'active' && !row.revoked_at)) {
            throw new Error('UNIQUE constraint failed: capability_connections.principal_id, capability_connections.provider_id');
          }
          db.connections.set(id, {
            id, principal_id: principal, provider_id: provider, secret_ref: secretRef,
            scopes_json: scopes, created_by: createdBy, created_at: createdAt,
            expires_at: expiresAt, status: 'active', revoked_at: null,
          });
          return { meta: { changes: 1 } };
        }
        if (sql.includes('UPDATE capability_connections') && sql.includes("SET status = 'revoked'")) {
          const [revokedAt, id, principal] = v;
          const row = db.connections.get(id);
          if (!row || row.principal_id !== principal || row.status !== 'active') return { meta: { changes: 0 } };
          row.status = 'revoked'; row.revoked_at = revokedAt;
          return { meta: { changes: 1 } };
        }
        return { meta: { changes: 0 } };
      },
      async first() {
        const v = this.values;
        if (sql.includes('SELECT * FROM capability_secrets')) {
          const [id, principal, provider] = v;
          const row = db.secrets.get(id);
          return row && row.principal_id === principal && row.provider_id === provider ? { ...row } : null;
        }
        if (sql.includes('SELECT * FROM capability_connections')) {
          if (sql.includes('WHERE id = ?')) {
            const row = db.connections.get(v[0]);
            return row ? { ...row } : null;
          }
          const [principal, provider, now] = v;
          const row = [...db.connections.values()].find(item => item.principal_id === principal &&
            item.provider_id === provider && item.status === 'active' && !item.revoked_at &&
            (!item.expires_at || item.expires_at > now));
          return row ? { ...row } : null;
        }
        return null;
      },
      async all() {
        const [principal, limit] = this.values;
        return { results: [...db.connections.values()].filter(row => row.principal_id === principal)
          .sort((a,b) => b.created_at.localeCompare(a.created_at)).slice(0,limit).map(row => ({ ...row })) };
      },
    };
  }
}

async function request(path, { method = 'GET', body, origin = 'https://aegis.example' } = {}) {
  const token = await createSessionToken(sessionSecret);
  const headers = { Cookie: '__Host-aegis_session=' + token };
  if (origin !== null) headers.Origin = origin;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return new Request('https://aegis.example' + path, {
    method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

test('model provider connection list rejects unauthenticated access before D1', async () => {
  const response = await onRequestGet({
    request: new Request('https://aegis.example/api/model-provider-connections'),
    env: { ...envBase, AEGIS_DB: { prepare() { throw new Error('must not access D1'); } } },
  });
  assert.equal(response.status, 401);
});

test('owner can list supported providers without receiving credentials or vault references', async () => {
  const response = await onRequestGet({
    request: await request('/api/model-provider-connections'),
    env: { ...envBase, AEGIS_DB: new MemoryD1() },
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.ok(body.providers.some(provider => provider.id === 'openrouter'));
  assert.equal(body.connections.length, 0);
  assert.equal(JSON.stringify(body).includes('secretRef'), false);
  assert.equal(JSON.stringify(body).includes('apiKey'), false);
});

test('provider key storage rejects cross-origin writes and unknown providers', async () => {
  const db = new MemoryD1();
  const crossOrigin = await onRequestPost({
    request: await request('/api/model-provider-connections', {
      method: 'POST', origin: 'https://attacker.example', body: { providerId: 'openrouter', apiKey: 'sk-example-secret-value-12345' },
    }),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(crossOrigin.status, 403);

  const unknown = await onRequestPost({
    request: await request('/api/model-provider-connections', {
      method: 'POST', body: { providerId: 'unknown-provider', apiKey: 'sk-example-secret-value-12345' },
    }),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(unknown.status, 400);
  assert.equal(db.secrets.size, 0);
});

test('stores provider keys encrypted and returns only safe connection metadata', async () => {
  const db = new MemoryD1();
  const apiKey = 'sk-example-provider-secret-value-12345';
  const response = await onRequestPost({
    request: await request('/api/model-provider-connections', {
      method: 'POST', body: { providerId: 'openrouter', apiKey },
    }),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.connection.providerId, 'openrouter');
  assert.equal(body.runtimeStatus, 'vault_only');
  assert.equal(JSON.stringify(body).includes(apiKey), false);
  assert.equal(JSON.stringify(body).includes('secretRef'), false);
  const stored = [...db.secrets.values()][0];
  assert.equal(stored.ciphertext_b64.includes(apiKey), false);
  assert.equal(stored.status, 'active');
});

test('revokes provider connection and erases encrypted credential material', async () => {
  const db = new MemoryD1();
  const created = await onRequestPost({
    request: await request('/api/model-provider-connections', {
      method: 'POST', body: { providerId: 'openrouter', apiKey: 'sk-example-provider-secret-value-12345' },
    }),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(created.status, 201);
  const response = await onRequestDelete({
    request: await request('/api/model-provider-connections', {
      method: 'DELETE', body: { providerId: 'openrouter' },
    }),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(response.status, 200);
  assert.equal([...db.connections.values()][0].status, 'revoked');
  assert.equal([...db.secrets.values()][0].status, 'revoked');
  assert.equal([...db.secrets.values()][0].ciphertext_b64, null);
});


test('duplicate provider key maps a database uniqueness conflict and erases the rejected key', async () => {
  const db = new MemoryD1();
  const first = await onRequestPost({
    request: await request('/api/model-provider-connections', {
      method: 'POST', body: { providerId: 'openrouter', apiKey: 'sk-first-provider-secret-value-12345' },
    }),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(first.status, 201);

  const second = await onRequestPost({
    request: await request('/api/model-provider-connections', {
      method: 'POST', body: { providerId: 'openrouter', apiKey: 'sk-second-provider-secret-value-12345' },
    }),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(second.status, 409);
  const secrets = [...db.secrets.values()];
  assert.equal(secrets.length, 2);
  assert.equal(secrets[0].status, 'active');
  assert.equal(secrets[1].status, 'revoked');
  assert.equal(secrets[1].ciphertext_b64, null);
});

test('provider list reports the newest active connection after a revoked historical record', async () => {
  const db = new MemoryD1();
  const first = await onRequestPost({
    request: await request('/api/model-provider-connections', {
      method: 'POST', body: { providerId: 'openrouter', apiKey: 'sk-first-provider-secret-value-12345' },
    }),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(first.status, 201);
  const oldRow = [...db.connections.values()][0];
  oldRow.created_at = '2026-01-01T00:00:00.000Z';

  const revoked = await onRequestDelete({
    request: await request('/api/model-provider-connections', {
      method: 'DELETE', body: { providerId: 'openrouter' },
    }),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(revoked.status, 200);

  const second = await onRequestPost({
    request: await request('/api/model-provider-connections', {
      method: 'POST', body: { providerId: 'openrouter', apiKey: 'sk-second-provider-secret-value-12345' },
    }),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(second.status, 201);

  const listed = await onRequestGet({
    request: await request('/api/model-provider-connections'),
    env: { ...envBase, AEGIS_DB: db },
  });
  const body = await listed.json();
  assert.equal(body.providers.find(provider => provider.id === 'openrouter').connectionStatus, 'stored');
});
