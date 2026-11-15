import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createApprovalRequest,
  decideApprovalRequest,
  consumeApproval,
} from '../functions/lib/capability-approvals.mjs';

class MemoryD1 {
  constructor() { this.rows = new Map(); }
  prepare(sql) {
    const db = this;
    return {
      values: [],
      bind(...values) { this.values = values; return this; },
      async run() {
        const v = this.values;
        if (sql.includes('INSERT INTO capability_approvals')) {
          if (db.rows.has(v[0])) return { meta: { changes: 0 } };
          db.rows.set(v[0], {
            id: v[0], principal_id: v[1], capability_id: v[2], capability_version: v[3],
            action_id: v[4], resource_id: v[5], operation_summary: v[6], connection_id: v[7], input_digest: v[8],
            requested_by: v[9], requested_at: v[10], expires_at: v[11],
            status: 'pending', decided_by: null, decided_at: null, consumed_at: null,
          });
          return { meta: { changes: 1 } };
        }
        return { meta: { changes: 0 } };
      },
      async first() {
        const v = this.values;
        if (sql.includes('UPDATE capability_approvals') && sql.includes("status = 'approved'") && sql.includes("status = 'consumed'")) {
          const [consumedAt, id, now, principal, capability, version, action, resource, connection, digest] = v;
          const row = db.rows.get(id);
          if (!row || row.status !== 'approved' || row.consumed_at || row.expires_at <= now ||
              row.principal_id !== principal || row.capability_id !== capability ||
              row.capability_version !== version || row.action_id !== action ||
              row.resource_id !== resource || row.connection_id !== connection ||
              row.input_digest !== digest) return null;
          row.status = 'consumed'; row.consumed_at = consumedAt;
          return { ...row };
        }
        if (sql.includes('UPDATE capability_approvals') && sql.includes("status = 'pending'")) {
          const [decision, decidedBy, decidedAt, id, now] = v;
          const row = db.rows.get(id);
          if (!row || row.status !== 'pending' || row.expires_at <= now) return null;
          row.status = decision; row.decided_by = decidedBy; row.decided_at = decidedAt;
          return { ...row };
        }
        if (sql.includes('SELECT * FROM capability_approvals')) {
          const row = db.rows.get(v[0]);
          return row ? { ...row } : null;
        }
        return null;
      },
    };
  }
}

const binding = {
  principalId: 'owner',
  capabilityId: 'github-repository',
  capabilityVersion: '1.2.0',
  actionId: 'update-description',
  resourceId: 'github:repo:owner/project',
  operationSummary: 'Update the description of owner/project on GitHub',
  connectionId: 'connection-1',
  inputDigest: 'sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
};
const future = new Date(Date.now() + 60_000).toISOString();
const request = (overrides = {}) => ({
  ...binding,
  requestedBy: 'agent:forge',
  expiresAt: future,
  ...overrides,
});

test('creates a pending approval bound to an exact operation without granting it', async () => {
  const db = new MemoryD1();
  const record = await createApprovalRequest(db, request(), Date.now());
  assert.equal(record.status, 'pending');
  assert.equal(record.capabilityId, binding.capabilityId);
  assert.equal(record.inputDigest, binding.inputDigest);
  assert.equal(record.consumedAt, null);
});

test('rejects incomplete or already-expired approval requests', async () => {
  const db = new MemoryD1();
  await assert.rejects(() => createApprovalRequest(db, request({ inputDigest: '' })), /invalid/i);
  await assert.rejects(() => createApprovalRequest(db, request({
    expiresAt: new Date(Date.now() - 1000).toISOString(),
  })), /expiry/i);
});

test('human decision can approve or deny only a pending unexpired request', async () => {
  const db = new MemoryD1();
  const approved = await createApprovalRequest(db, request(), Date.now());
  const decision = await decideApprovalRequest(db, {
    id: approved.id, decision: 'approved', decidedBy: 'owner', now: Date.now(),
  });
  assert.equal(decision.status, 'approved');
  assert.equal(decision.decidedBy, 'owner');
  assert.equal(await decideApprovalRequest(db, {
    id: approved.id, decision: 'denied', decidedBy: 'owner', now: Date.now(),
  }), null);
});

test('approval cannot be consumed for a different principal, target or payload', async () => {
  const db = new MemoryD1();
  const pending = await createApprovalRequest(db, request(), Date.now());
  await decideApprovalRequest(db, {
    id: pending.id, decision: 'approved', decidedBy: 'owner', now: Date.now(),
  });
  assert.equal(await consumeApproval(db, {
    id: pending.id, ...binding, resourceId: 'github:repo:owner/other', now: Date.now(),
  }), null);
  assert.equal(await consumeApproval(db, {
    id: pending.id, ...binding, inputDigest: 'sha256:abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789', now: Date.now(),
  }), null);
});

test('approval is atomically consumable once and cannot be replayed', async () => {
  const db = new MemoryD1();
  const pending = await createApprovalRequest(db, request(), Date.now());
  await decideApprovalRequest(db, {
    id: pending.id, decision: 'approved', decidedBy: 'owner', now: Date.now(),
  });
  const consumed = await consumeApproval(db, {
    id: pending.id, ...binding, now: Date.now(),
  });
  assert.equal(consumed.status, 'consumed');
  assert.ok(consumed.consumedAt);
  assert.equal(await consumeApproval(db, {
    id: pending.id, ...binding, now: Date.now(),
  }), null);
});

test('expired and denied approvals cannot be consumed', async () => {
  const db = new MemoryD1();
  const denied = await createApprovalRequest(db, request(), Date.now());
  await decideApprovalRequest(db, {
    id: denied.id, decision: 'denied', decidedBy: 'owner', now: Date.now(),
  });
  assert.equal(await consumeApproval(db, {
    id: denied.id, ...binding, now: Date.now(),
  }), null);
});

test('two concurrent consumers cannot both claim the same approval', async () => {
  const db = new MemoryD1();
  const pending = await createApprovalRequest(db, request(), Date.now());
  await decideApprovalRequest(db, {
    id: pending.id, decision: 'approved', decidedBy: 'owner', now: Date.now(),
  });
  const attempts = await Promise.all([
    consumeApproval(db, { id: pending.id, ...binding, now: Date.now() }),
    consumeApproval(db, { id: pending.id, ...binding, now: Date.now() }),
  ]);
  assert.equal(attempts.filter(Boolean).length, 1);
});

test('an expired pending request cannot be approved', async () => {
  const db = new MemoryD1();
  const pending = await createApprovalRequest(db, request({
    expiresAt: new Date(Date.now() + 1000).toISOString(),
  }), Date.now());
  const result = await decideApprovalRequest(db, {
    id: pending.id, decision: 'approved', decidedBy: 'owner',
    now: Date.now() + 2000,
  });
  assert.equal(result, null);
});
