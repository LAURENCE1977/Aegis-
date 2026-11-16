import test from 'node:test';
import assert from 'node:assert/strict';
import {
  recordCapabilityAudit,
  listCapabilityAudit,
} from '../functions/lib/capability-audit.mjs';

class MemoryD1 {
  constructor() { this.rows = []; }
  prepare(sql) {
    const db = this;
    return {
      values: [],
      bind(...values) { this.values = values; return this; },
      async run() {
        if (!sql.includes('INSERT INTO capability_invocation_audit')) {
          throw new Error('Append-only audit store rejects mutation');
        }
        const [id, invocationId, type, principal, capability, version, action, resource, digest, reason, occurredAt] = this.values;
        if (db.rows.some(row => row.id === id)) return { meta: { changes: 0 } };
        db.rows.push({
          id, invocation_id: invocationId, event_type: type, principal_id: principal,
          capability_id: capability, capability_version: version, action_id: action,
          resource_id: resource, input_digest: digest, reason_code: reason, occurred_at: occurredAt,
        });
        return { meta: { changes: 1 } };
      },
      async all() {
        const [principal, invocationId, _invocationIdAgain, limit] = this.values;
        return { results: db.rows
          .filter(row => row.principal_id === principal && (!invocationId || row.invocation_id === invocationId))
          .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
          .slice(0, limit).map(row => ({ ...row })) };
      },
    };
  }
}

const event = (overrides = {}) => ({
  invocationId: 'invocation-01',
  type: 'invocation_authorized',
  principalId: 'owner-1',
  capabilityId: 'aegis-github-public-discovery',
  capabilityVersion: '0.1.0',
  actionId: 'discover',
  resourceId: 'github:repo:owner/project',
  inputDigest: 'sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  reasonCode: 'ALLOW',
  occurredAt: '2026-11-15T19:00:00.000Z',
  ...overrides,
});

test('persists a bounded redacted Sentinel event without accepting raw payload fields', async () => {
  const db = new MemoryD1();
  const stored = await recordCapabilityAudit(db, event());
  assert.equal(stored.invocationId, 'invocation-01');
  assert.equal(stored.type, 'invocation_authorized');
  assert.equal(stored.inputDigest, event().inputDigest);
  assert.equal(db.rows.length, 1);
  assert.equal('input' in stored, false);
});

test('rejects raw inputs, unknown fields, malformed digests and invalid event types', async () => {
  const db = new MemoryD1();
  await assert.rejects(() => recordCapabilityAudit(db, event({ input: { token: 'secret' } })), /fields/i);
  await assert.rejects(() => recordCapabilityAudit(db, event({ inputDigest: 'raw-token' })), /digest/i);
  await assert.rejects(() => recordCapabilityAudit(db, event({ type: 'arbitrary-event' })), /event type/i);
  await assert.rejects(() => recordCapabilityAudit(db, event({ reasonCode: 'not safe!' })), /reason/i);
});

test('lists only the requested principal and optional invocation with a bounded limit', async () => {
  const db = new MemoryD1();
  await recordCapabilityAudit(db, event());
  await recordCapabilityAudit(db, event({ invocationId: 'invocation-02', type: 'invocation_succeeded' }));
  assert.equal((await listCapabilityAudit(db, 'owner-1', { limit: 10 })).length, 2);
  assert.equal((await listCapabilityAudit(db, 'owner-2', { limit: 10 })).length, 0);
  assert.equal((await listCapabilityAudit(db, 'owner-1', { invocationId: 'invocation-01', limit: 10 })).length, 1);
  await assert.rejects(() => listCapabilityAudit(db, 'owner-1', { limit: 101 }), /limit/i);
});

test('requires a valid audit clock and fails closed on storage errors', async () => {
  const db = new MemoryD1();
  await assert.rejects(() => recordCapabilityAudit(db, event({ occurredAt: 'yesterday' })), /timestamp/i);
  const broken = { prepare() { throw new Error('offline'); } };
  await assert.rejects(() => recordCapabilityAudit(broken, event()), /offline/);
});
