import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createConnection,
  loadConnection,
  listConnections,
  revokeConnection,
} from '../functions/lib/capability-connections.mjs';

class MemoryD1 {
  constructor() { this.rows = new Map(); }
  prepare(sql) {
    const db = this;
    return {
      values: [],
      bind(...values) { this.values = values; return this; },
      async run() {
        const v = this.values;
        if (sql.includes('UPDATE capability_connections') && sql.includes("SET status = 'revoked'") && sql.includes('expires_at <= ?')) {
          const [revokedAt, principal, provider, now] = v;
          let changes = 0;
          for (const row of db.rows.values()) {
            if (row.principal_id === principal && row.provider_id === provider &&
                row.status === 'active' && row.expires_at && row.expires_at <= now) {
              row.status = 'revoked';
              row.revoked_at = revokedAt;
              changes += 1;
            }
          }
          return { meta: { changes } };
        }
        if (sql.includes('INSERT INTO capability_connections')) {
          const [id, principal, provider, secretRef, scopes, createdBy, createdAt, expiresAt] = v;
          for (const row of db.rows.values()) {
            if (row.principal_id === principal && row.provider_id === provider &&
                row.status === 'active' && !row.revoked_at) {
              return { meta: { changes: 0 }, error: 'UNIQUE' };
            }
          }
          db.rows.set(id, {
            id, principal_id: principal, provider_id: provider, secret_ref: secretRef,
            scopes_json: scopes, created_by: createdBy, created_at: createdAt,
            expires_at: expiresAt, status: 'active', revoked_at: null,
          });
          return { meta: { changes: 1 } };
        }
        if (sql.includes('UPDATE capability_connections') && sql.includes("SET status = 'revoked'")) {
          const [revokedAt, id, principal] = v;
          const row = db.rows.get(id);
          if (!row || row.principal_id !== principal || row.status !== 'active') {
            return { meta: { changes: 0 } };
          }
          row.status = 'revoked';
          row.revoked_at = revokedAt;
          return { meta: { changes: 1 } };
        }
        return { meta: { changes: 0 } };
      },
      async first() {
        const v = this.values;
        if (sql.includes('SELECT * FROM capability_connections')) {
          if (sql.includes('WHERE id = ?')) {
            const row = db.rows.get(v[0]);
            return row ? { ...row } : null;
          }
          const [principal, provider, now] = v;
          const row = [...db.rows.values()].find(item =>
            item.principal_id === principal && item.provider_id === provider &&
            item.status === 'active' && !item.revoked_at &&
            (!item.expires_at || item.expires_at > now));
          return row ? { ...row } : null;
        }
        return null;
      },
      async all() {
        const [principal, limit] = this.values;
        return { results: [...db.rows.values()]
          .filter(row => row.principal_id === principal)
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .slice(0, limit).map(row => ({ ...row })) };
      },
    };
  }
}

const input = (overrides = {}) => ({
  principalId: 'owner-1',
  providerId: 'github',
  secretRef: 'vault://connections/github-owner-1',
  scopes: ['github:public-metadata:read', 'github:issues:read'],
  createdBy: 'owner',
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  ...overrides,
});

test('creates owner-attributed connection metadata without storing credential values', async () => {
  const db = new MemoryD1();
  const record = await createConnection(db, input(), Date.now());
  assert.equal(record.status, 'active');
  assert.equal(record.secretRef, 'vault://connections/github-owner-1');
  assert.deepEqual(record.scopes, input().scopes);
  assert.equal(record.createdBy, 'owner');
});

test('rejects raw secrets, malformed vault references and wildcard scopes', async () => {
  const db = new MemoryD1();
  await assert.rejects(() => createConnection(db, input({ secretRef: 'ghp_plaintexttoken' })), /secret reference/i);
  await assert.rejects(() => createConnection(db, input({ secretRef: 'vault://connections/../token' })), /secret reference/i);
  await assert.rejects(() => createConnection(db, input({ scopes: ['github:*'] })), /scope/i);
  await assert.rejects(() => createConnection(db, input({ createdBy: 'agent' })), /owner/i);
});

test('enforces bounded expiry and rejects duplicate active provider connections', async () => {
  const db = new MemoryD1();
  await assert.rejects(() => createConnection(db, input({
    expiresAt: new Date(Date.now() + 366 * 24 * 60 * 60 * 1000).toISOString(),
  })), /expiry/i);
  await createConnection(db, input(), Date.now());
  await assert.rejects(() => createConnection(db, input(), Date.now()), /already exists/i);
});

test('Sentinel loader returns only the exact owner provider active unexpired connection', async () => {
  const db = new MemoryD1();
  await createConnection(db, input(), Date.now());
  const connection = await loadConnection(db, { principalId: 'owner-1', providerId: 'github' }, Date.now());
  assert.equal(connection.providerId, 'github');
  assert.equal(await loadConnection(db, { principalId: 'owner-2', providerId: 'github' }, Date.now()), null);
  assert.equal(await loadConnection(db, { principalId: 'owner-1', providerId: 'gitlab' }, Date.now()), null);
});

test('lists safe metadata without exposing the vault reference', async () => {
  const db = new MemoryD1();
  const created = await createConnection(db, input(), Date.now());
  const records = await listConnections(db, 'owner-1', 10);
  assert.equal(records.length, 1);
  assert.equal(records[0].id, created.id);
  assert.equal('secretRef' in records[0], false);
});

test('revoked and expired connections cannot be loaded', async () => {
  const db = new MemoryD1();
  const created = await createConnection(db, input(), Date.now());
  assert.equal(await revokeConnection(db, created.id, 'owner-2', Date.now()), false);
  assert.equal(await revokeConnection(db, created.id, 'owner-1', Date.now()), true);
  assert.equal(await loadConnection(db, { principalId: 'owner-1', providerId: 'github' }, Date.now()), null);
  const expired = await createConnection(db, input({
    providerId: 'gitlab',
    secretRef: 'vault://connections/gitlab-owner-1',
    expiresAt: new Date(Date.now() + 1000).toISOString(),
  }), Date.now());
  assert.ok(expired.id);
  assert.equal(await loadConnection(db, { principalId: 'owner-1', providerId: 'gitlab' }, Date.now() + 2000), null);
});

test('expired active metadata is retired before a replacement provider connection is created', async () => {
  const db = new MemoryD1();
  const now = Date.now();
  await createConnection(db, input({ expiresAt: new Date(now + 1000).toISOString() }), now);
  const replacement = await createConnection(db, input({
    secretRef: 'vault://connections/github-owner-1-new',
    expiresAt: new Date(now + 60_000).toISOString(),
  }), now + 2000);
  assert.equal(replacement.status, 'active');
  assert.equal(await loadConnection(db, { principalId: 'owner-1', providerId: 'github' }, now + 2000).then(x => x.id), replacement.id);
});
