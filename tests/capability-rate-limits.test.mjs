import test from 'node:test';
import assert from 'node:assert/strict';
import { reserveCapabilityInvocation } from '../functions/lib/capability-rate-limits.mjs';

class MemoryD1 {
  constructor() { this.rows = new Map(); }
  prepare(sql) {
    const db = this;
    return {
      values: [],
      bind(...values) { this.values = values; return this; },
      async run() {
        if (sql.includes('DELETE FROM capability_invocation_limits')) {
          const cutoff = this.values[0];
          let changes = 0;
          for (const [key, row] of db.rows) {
            if (row.window_start_ms < cutoff) {
              db.rows.delete(key);
              changes += 1;
            }
          }
          return { meta: { changes } };
        }
        return { meta: { changes: 0 } };
      },
      async first() {
        if (!sql.includes('INSERT INTO capability_invocation_limits')) return null;
        const [principal, capability, action, windowStart, updatedAt, limit] = this.values;
        const key = [principal, capability, action, windowStart].join('|');
        let row = db.rows.get(key);
        if (!row) {
          row = { principal_id: principal, capability_id: capability, action_id: action,
            window_start_ms: windowStart, request_count: 0, updated_at: updatedAt };
        }
        if (row.request_count >= limit) return null;
        row.request_count += 1;
        row.updated_at = updatedAt;
        db.rows.set(key, row);
        return { request_count: row.request_count };
      },
    };
  }
}

const binding = {
  principalId: 'owner',
  capabilityId: 'aegis-github-public-discovery',
  actionId: 'discover',
  requestsPerMinute: 2,
};

test('reserves exactly the configured number of invocations in a minute window', async () => {
  const db = new MemoryD1();
  const now = Date.parse('2026-11-16T02:00:15Z');
  assert.equal(await reserveCapabilityInvocation(db, { ...binding, now }), true);
  assert.equal(await reserveCapabilityInvocation(db, { ...binding, now: now + 1000 }), true);
  assert.equal(await reserveCapabilityInvocation(db, { ...binding, now: now + 2000 }), false);
  assert.equal([...db.rows.values()][0].request_count, 2);
});

test('rate limits are isolated by principal, capability and action', async () => {
  const db = new MemoryD1();
  const now = Date.parse('2026-11-16T02:00:15Z');
  assert.equal(await reserveCapabilityInvocation(db, { ...binding, now }), true);
  assert.equal(await reserveCapabilityInvocation(db, { ...binding, principalId: 'another-owner', now }), true);
  assert.equal(await reserveCapabilityInvocation(db, { ...binding, actionId: 'other-action', now }), true);
  assert.equal(db.rows.size, 3);
});

test('a new minute window resets the counter and old buckets are pruned', async () => {
  const db = new MemoryD1();
  const now = Date.parse('2026-11-16T02:00:15Z');
  await reserveCapabilityInvocation(db, { ...binding, now });
  assert.equal(await reserveCapabilityInvocation(db, { ...binding, now: now + 24 * 60 * 60 * 1000 + 60_000 }), true);
  assert.equal(db.rows.size, 1);
  assert.equal([...db.rows.values()][0].request_count, 1);
});

test('rejects invalid rate limits, identifiers and clocks', async () => {
  const db = new MemoryD1();
  await assert.rejects(() => reserveCapabilityInvocation(db, { ...binding, requestsPerMinute: 0 }));
  await assert.rejects(() => reserveCapabilityInvocation(db, { ...binding, requestsPerMinute: 10001 }));
  await assert.rejects(() => reserveCapabilityInvocation(db, { ...binding, principalId: '' }));
  await assert.rejects(() => reserveCapabilityInvocation(db, { ...binding, now: NaN }));
});

test('fails closed when the D1 rate-limit store is unavailable', async () => {
  const db = { prepare() { throw new Error('D1 unavailable'); } };
  await assert.rejects(() => reserveCapabilityInvocation(db, { ...binding, now: Date.now() }));
});
