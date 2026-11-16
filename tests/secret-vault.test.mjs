import test from 'node:test';
import assert from 'node:assert/strict';
import {
  storeVaultSecret,
  resolveVaultSecret,
  revokeVaultSecret,
} from '../functions/lib/secret-vault.mjs';

class MemoryD1 {
  constructor() { this.rows = new Map(); }
  prepare(sql) {
    const db = this;
    return {
      values: [],
      bind(...values) { this.values = values; return this; },
      async run() {
        const v = this.values;
        if (sql.includes('INSERT INTO capability_secrets')) {
          const [id, principal, provider, keyVersion, iv, ciphertext, createdAt] = v;
          db.rows.set(id, {
            secret_id: id, principal_id: principal, provider_id: provider,
            key_version: keyVersion, iv_b64: iv, ciphertext_b64: ciphertext,
            created_at: createdAt, updated_at: createdAt, status: 'active', revoked_at: null,
          });
          return { meta: { changes: 1 } };
        }
        if (sql.includes('UPDATE capability_secrets') && sql.includes("status = 'revoked'")) {
          const [updatedAt, revokedAt, id, principal, provider] = v;
          const row = db.rows.get(id);
          if (!row || row.principal_id !== principal || row.provider_id !== provider ||
              row.status !== 'active') return { meta: { changes: 0 } };
          row.status = 'revoked';
          row.iv_b64 = null;
          row.ciphertext_b64 = null;
          row.updated_at = updatedAt;
          row.revoked_at = revokedAt;
          return { meta: { changes: 1 } };
        }
        return { meta: { changes: 0 } };
      },
      async first() {
        const v = this.values;
        if (sql.includes('SELECT * FROM capability_secrets')) {
          const [id, principal, provider] = v;
          const row = db.rows.get(id);
          return row && row.principal_id === principal && row.provider_id === provider
            ? { ...row } : null;
        }
        return null;
      },
    };
  }
}

const rawKey = crypto.getRandomValues(new Uint8Array(32));
const keyB64 = btoa(String.fromCharCode(...rawKey));
const env = {
  AEGIS_VAULT_KEYRING: JSON.stringify({ v1: keyB64 }),
  AEGIS_VAULT_ACTIVE_KEY_VERSION: 'v1',
};
const identity = { principalId: 'owner-1', providerId: 'github' };

test('stores only AES-GCM ciphertext and resolves the secret for the exact owner/provider', async () => {
  const db = new MemoryD1();
  const secret = 'ghp_example_sensitive_token_value';
  const stored = await storeVaultSecret(db, { ...identity, secret }, env, Date.now());
  assert.match(stored.secretRef, /^vault:\/\/connections\/[0-9a-f-]{36}$/);
  const row = [...db.rows.values()][0];
  assert.equal(row.ciphertext_b64.includes(secret), false);
  assert.equal(row.iv_b64.length > 0, true);
  assert.equal(row.key_version, 'v1');
  assert.equal(await resolveVaultSecret(db, { ...identity, secretRef: stored.secretRef }, env), secret);
  assert.equal(await resolveVaultSecret(db, { principalId: 'owner-2', providerId: 'github', secretRef: stored.secretRef }, env), null);
  assert.equal(await resolveVaultSecret(db, { ...identity, providerId: 'gitlab', secretRef: stored.secretRef }, env), null);
});

test('rejects malformed inputs, unknown fields and oversized secret material', async () => {
  const db = new MemoryD1();
  await assert.rejects(() => storeVaultSecret(db, { ...identity, secret: '' }, env), /secret/i);
  await assert.rejects(() => storeVaultSecret(db, { ...identity, secret: 'x'.repeat(16_385) }, env), /size/i);
  await assert.rejects(() => storeVaultSecret(db, { ...identity, secret: 'token', principalId: '../owner' }, env), /principal/i);
  await assert.rejects(() => storeVaultSecret(db, { ...identity, secret: 'token', extra: true }, env), /fields/i);
});

test('fails closed when the vault keyring or active key is invalid', async () => {
  const db = new MemoryD1();
  await assert.rejects(() => storeVaultSecret(db, { ...identity, secret: 'token' }, {}), /vault key/i);
  await assert.rejects(() => storeVaultSecret(db, { ...identity, secret: 'token' }, {
    AEGIS_VAULT_KEYRING: JSON.stringify({ v1: 'not-a-32-byte-key' }),
    AEGIS_VAULT_ACTIVE_KEY_VERSION: 'v1',
  }), /vault key/i);
});

test('tampered ciphertext fails authentication instead of returning plaintext', async () => {
  const db = new MemoryD1();
  const stored = await storeVaultSecret(db, { ...identity, secret: 'token-to-protect' }, env);
  const row = [...db.rows.values()][0];
  row.ciphertext_b64 = row.ciphertext_b64.slice(0, -2) + 'AA';
  await assert.rejects(() => resolveVaultSecret(db, { ...identity, secretRef: stored.secretRef }, env), /decrypt/i);
});

test('revocation is owner/provider scoped and cryptographically erases stored ciphertext', async () => {
  const db = new MemoryD1();
  const stored = await storeVaultSecret(db, { ...identity, secret: 'token-to-revoke' }, env);
  assert.equal(await revokeVaultSecret(db, { ...identity, secretRef: stored.secretRef }, Date.now()), true);
  const row = [...db.rows.values()][0];
  assert.equal(row.status, 'revoked');
  assert.equal(row.ciphertext_b64, null);
  assert.equal(row.iv_b64, null);
  assert.equal(await resolveVaultSecret(db, { ...identity, secretRef: stored.secretRef }, env), null);
  assert.equal(await revokeVaultSecret(db, { principalId: 'owner-2', providerId: 'github', secretRef: stored.secretRef }), false);
});
