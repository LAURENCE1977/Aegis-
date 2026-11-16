import test from 'node:test';
import assert from 'node:assert/strict';
import { storeVaultSecret } from '../functions/lib/secret-vault.mjs';
import { createSentinelDependencies } from '../functions/lib/sentinel-composition.mjs';

const rawKey = new Uint8Array(32).fill(19);
const env = {
  AEGIS_VAULT_KEYRING: JSON.stringify({ v1: btoa(String.fromCharCode(...rawKey)) }),
  AEGIS_VAULT_ACTIVE_KEY_VERSION: 'v1',
};

class VaultD1 {
  constructor() { this.secrets = new Map(); this.connection = null; }
  prepare(sql) {
    const db = this;
    return {
      values: [],
      bind(...values) { this.values = values; return this; },
      async run() {
        if (sql.includes('INSERT INTO capability_secrets')) {
          const [id, principalId, providerId, keyVersion, ivB64, ciphertextB64, createdAt, updatedAt] = this.values;
          db.secrets.set(id, {
            secret_id: id, principal_id: principalId, provider_id: providerId,
            key_version: keyVersion, iv_b64: ivB64, ciphertext_b64: ciphertextB64,
            created_at: createdAt, updated_at: updatedAt, status: 'active', revoked_at: null,
          });
        }
        return { meta: { changes: 1 } };
      },
      async first() {
        if (sql.includes('FROM capability_connections')) {
          const [id, principalId] = this.values;
          return db.connection && db.connection.id === id && db.connection.principal_id === principalId
            ? { ...db.connection } : null;
        }
        if (sql.includes('FROM capability_secrets')) {
          const [id, principalId, providerId] = this.values;
          const row = db.secrets.get(id);
          return row && row.principal_id === principalId && row.provider_id === providerId ? { ...row } : null;
        }
        return null;
      },
    };
  }
}

const now = Date.parse('2026-11-16T02:30:00.000Z');
const context = {
  invocationId: 'invocation-1',
  principalId: 'owner',
  capabilityId: 'aegis-github-private-metadata',
  capabilityVersion: '0.1.0',
  actionId: 'discover',
  resourceId: 'github:private:Example/Repo',
  scopes: ['github:private-metadata:read'],
  connectionId: 'connection-1',
  inputDigest: 'sha256:' + 'a'.repeat(64),
};

async function connectedDb() {
  const db = new VaultD1();
  const stored = await storeVaultSecret(db, {
    principalId: 'owner',
    providerId: 'github',
    secret: 'github-private-token-test',
  }, env, now);
  db.connection = {
    id: 'connection-1',
    principal_id: 'owner',
    provider_id: 'github',
    secret_ref: stored.secretRef,
    scopes_json: JSON.stringify(['github:private-metadata:read']),
    status: 'active',
    expires_at: new Date(now + 60_000).toISOString(),
    revoked_at: null,
  };
  return db;
}

test('composition root resolves an OAuth secret only for the exact active authorized connection', async () => {
  const db = await connectedDb();
  const adapters = {
    'aegis-github-private-metadata:discover': async (_input, adapterContext) => ({
      credential: adapterContext.credential,
      connectionId: adapterContext.connectionId,
    }),
  };
  const dependencies = createSentinelDependencies({ db, env, adapters, clock: () => now });
  const result = await dependencies.execute({ sourceUrl: 'https://github.com/Example/Repo' }, context);
  assert.equal(result.credential, 'github-private-token-test');
  assert.equal(result.connectionId, 'connection-1');
});

test('composition root refuses mismatched, expired or missing connections before adapter dispatch', async () => {
  const db = await connectedDb();
  let calls = 0;
  const adapters = {
    'aegis-github-private-metadata:discover': async () => { calls += 1; return {}; },
  };
  const dependencies = createSentinelDependencies({ db, env, adapters, clock: () => now });
  await assert.rejects(() => dependencies.execute({}, { ...context, connectionId: 'another-connection' }));
  db.connection.expires_at = new Date(now - 1).toISOString();
  await assert.rejects(() => dependencies.execute({}, context));
  assert.equal(calls, 0);
});

test('session-only adapters never receive a vault credential', async () => {
  const db = new VaultD1();
  const adapters = {
    'aegis-module-catalogue:list': async (_input, adapterContext) => adapterContext,
  };
  const dependencies = createSentinelDependencies({ db, adapters, clock: () => now });
  const result = await dependencies.execute({}, {
    ...context,
    capabilityId: 'aegis-module-catalogue',
    capabilityVersion: '0.1.0',
    actionId: 'list',
    resourceId: 'aegis:modules',
    scopes: ['aegis:module-catalogue:read'],
    connectionId: null,
  });
  assert.equal('credential' in result, false);
});

test('OAuth adapter fails closed when vault keyring is unavailable', async () => {
  const db = await connectedDb();
  let calls = 0;
  const adapters = {
    'aegis-github-private-metadata:discover': async () => { calls += 1; return {}; },
  };
  const dependencies = createSentinelDependencies({ db, adapters, clock: () => now });
  await assert.rejects(() => dependencies.execute({}, context));
  assert.equal(calls, 0);
});
