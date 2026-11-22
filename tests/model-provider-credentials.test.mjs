import test from 'node:test';
import assert from 'node:assert/strict';
import { storeVaultSecret } from '../functions/lib/secret-vault.mjs';
import { resolveConnectedProviderCredential } from '../functions/lib/model-provider-credentials.mjs';

const rawKey = crypto.getRandomValues(new Uint8Array(32));
const keyB64 = btoa(String.fromCharCode(...rawKey));
const vaultEnv = {
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
          const [id, principal, provider, version, iv, ciphertext, createdAt] = v;
          db.secrets.set(id, {
            secret_id: id, principal_id: principal, provider_id: provider,
            key_version: version, iv_b64: iv, ciphertext_b64: ciphertext,
            created_at: createdAt, updated_at: createdAt, status: 'active',
          });
          return { meta: { changes: 1 } };
        }
        return { meta: { changes: 0 } };
      },
      async first() {
        const v = this.values;
        if (sql.includes('FROM capability_connections') && sql.includes('ORDER BY created_at DESC, id DESC')) {
          const [principal, provider] = v;
          const row = [...db.connections.values()]
            .filter(item => item.principal_id === principal && item.provider_id === provider)
            .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))[0];
          return row ? { ...row } : null;
        }
        if (sql.includes('FROM capability_connections')) {
          const [principal, provider, now] = v;
          const row = [...db.connections.values()].find(item =>
            item.principal_id === principal && item.provider_id === provider &&
            item.status === 'active' && !item.revoked_at &&
            (!item.expires_at || item.expires_at > now));
          return row ? { ...row } : null;
        }
        if (sql.includes('FROM capability_secrets')) {
          const [id, principal, provider] = v;
          const row = db.secrets.get(id);
          return row && row.principal_id === principal && row.provider_id === provider
            ? { ...row } : null;
        }
        return null;
      },
    };
  }
}

async function connect(db, providerId, apiKey, scopes = [providerId + ':inference:chat']) {
  const stored = await storeVaultSecret(db, { principalId: 'owner', providerId, secret: apiKey }, vaultEnv);
  db.connections.set('connection-' + providerId, {
    id: 'connection-' + providerId,
    principal_id: 'owner',
    provider_id: providerId,
    secret_ref: stored.secretRef,
    scopes_json: JSON.stringify(scopes),
    created_at: new Date().toISOString(),
    status: 'active',
    revoked_at: null,
    expires_at: null,
  });
}

test('resolves a connected provider key only for its exact owner/provider and inference scope', async () => {
  const db = new MemoryD1();
  await connect(db, 'anthropic', 'anthropic-server-secret-123456');
  const result = await resolveConnectedProviderCredential({
    db, env: vaultEnv, principalId: 'owner', providerId: 'anthropic',
  });
  assert.equal(result.apiKey, 'anthropic-server-secret-123456');
  assert.equal(result.connectionId, 'connection-anthropic');
  assert.equal(Object.hasOwn(result, 'secretRef'), false);
});

test('does not silently fall back to a legacy key after a stored provider connection is revoked', async () => {
  const db = new MemoryD1();
  await connect(db, 'anthropic', 'anthropic-server-secret-123456');
  const row = db.connections.get('connection-anthropic');
  row.status = 'revoked';
  row.revoked_at = new Date().toISOString();
  await assert.rejects(() => resolveConnectedProviderCredential({
    db, env: vaultEnv, principalId: 'owner', providerId: 'anthropic',
  }), /inactive/i);
});

test('returns null only when no provider connection has ever been created', async () => {
  const db = new MemoryD1();
  assert.equal(await resolveConnectedProviderCredential({
    db, env: vaultEnv, principalId: 'owner', providerId: 'anthropic',
  }), null);
});

test('refuses a connection that lacks the exact chat inference scope', async () => {
  const db = new MemoryD1();
  await connect(db, 'anthropic', 'anthropic-server-secret-123456', ['anthropic:metadata:read']);
  await assert.rejects(() => resolveConnectedProviderCredential({
    db, env: vaultEnv, principalId: 'owner', providerId: 'anthropic',
  }), /scope/i);
});

test('does not resolve another owner or another provider credential', async () => {
  const db = new MemoryD1();
  await connect(db, 'anthropic', 'anthropic-server-secret-123456');
  assert.equal(await resolveConnectedProviderCredential({
    db, env: vaultEnv, principalId: 'different-owner', providerId: 'anthropic',
  }), null);
  assert.equal(await resolveConnectedProviderCredential({
    db, env: vaultEnv, principalId: 'owner', providerId: 'alibaba-qwen',
  }), null);
});

test('fails closed when a connection exists but its vault key cannot be decrypted', async () => {
  const db = new MemoryD1();
  await connect(db, 'anthropic', 'anthropic-server-secret-123456');
  await assert.rejects(() => resolveConnectedProviderCredential({
    db, env: {}, principalId: 'owner', providerId: 'anthropic',
  }), /vault/i);
});


test('an expired provider connection also disables legacy credential fallback', async () => {
  const db = new MemoryD1();
  await connect(db, 'anthropic', 'anthropic-server-secret-123456');
  const row = db.connections.get('connection-anthropic');
  row.expires_at = new Date(Date.now() - 60_000).toISOString();
  await assert.rejects(() => resolveConnectedProviderCredential({
    db, env: vaultEnv, principalId: 'owner', providerId: 'anthropic',
  }), /inactive/i);
});
test('resolves an APInex credential only for the owner and exact chat-inference scope', async () => {
  const db = new MemoryD1();
  await connect(db, 'apinex', 'apinex-server-secret-123456');
  const result = await resolveConnectedProviderCredential({
    db, env: vaultEnv, principalId: 'owner', providerId: 'apinex',
  });
  assert.equal(result.apiKey, 'apinex-server-secret-123456');
  assert.equal(result.connectionId, 'connection-apinex');
  assert.equal(Object.hasOwn(result, 'secretRef'), false);
});

test('revoked APInex connections fail closed and cannot fall back to an environment key', async () => {
  const db = new MemoryD1();
  await connect(db, 'apinex', 'apinex-server-secret-123456');
  const row = db.connections.get('connection-apinex');
  row.status = 'revoked';
  row.revoked_at = new Date().toISOString();
  await assert.rejects(() => resolveConnectedProviderCredential({
    db, env: { ...vaultEnv, APINEX_API_KEY: 'legacy-apinex-key-123456' },
    principalId: 'owner', providerId: 'apinex',
  }), /inactive/i);
});
