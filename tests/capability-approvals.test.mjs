import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createApprovalRequest,
  validatePermissionRequest,
  decideApprovalRequest,
  listPendingApprovals,
  loadApproval,
  loadApprovedApprovalById,
  loadConsumedApprovalById,
  consumeApproval,
} from '../functions/lib/capability-approvals.mjs';

class MemoryD1 {
  constructor() { this.rows = new Map(); }
  prepare(sql) {
    const db = this;
    return {
      values: [],
      bind(...values) {
        this.values = values;
        if (sql.includes('INSERT INTO capability_approvals') || sql.includes('UPDATE capability_approvals')) {
          assert.equal((sql.match(/\?/g) || []).length, values.length, 'SQL placeholders must match bound values');
        }
        return this;
      },
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
      async all() {
        return { results: [...db.rows.values()].filter(row => row.status === 'pending').map(row => ({ ...row })) };
      },
      async first() {
        const v = this.values;
        if (sql.includes('UPDATE capability_approvals') && sql.includes("status = 'approved'") && sql.includes("status = 'consumed'")) {
          const [consumedAt, id, now, principal, capability, version, action, resource, summary, connection, digest] = v;
          const row = db.rows.get(id);
          if (!row || row.status !== 'approved' || row.consumed_at || row.expires_at <= now ||
              row.principal_id !== principal || row.capability_id !== capability ||
              row.capability_version !== version || row.action_id !== action ||
              row.resource_id !== resource || row.operation_summary !== summary || row.connection_id !== connection ||
              row.input_digest !== digest) return null;
          row.status = 'consumed'; row.consumed_at = consumedAt;
          return { ...row };
        }
        if (sql.includes('UPDATE capability_approvals') && sql.includes("status = 'pending'")) {
          const [decision, decidedBy, decidedAt, id, now, principalId, _principalIdAgain, capabilityId] = v;
          const row = db.rows.get(id);
          if (!row || row.status !== 'pending' || row.expires_at <= now ||
              (principalId !== null && row.principal_id !== principalId) ||
              (capabilityId !== null && row.capability_id !== capabilityId)) return null;
          row.status = decision; row.decided_by = decidedBy; row.decided_at = decidedAt;
          return { ...row };
        }
        if (sql.includes('SELECT * FROM capability_approvals') && sql.includes("status = 'consumed'")) {
          const [id, principal, capability] = v;
          const row = db.rows.get(id);
          return row && row.principal_id === principal && row.capability_id === capability &&
            row.status === 'consumed' && row.consumed_at ? { ...row } : null;
        }
        if (sql.includes('SELECT * FROM capability_approvals') && sql.includes('id = ? AND principal_id = ?')) {
          const [id, principal, capability, now] = v;
          const row = db.rows.get(id);
          return row && row.principal_id === principal && row.capability_id === capability &&
            row.status === 'approved' && !row.consumed_at && row.expires_at > now ? { ...row } : null;
        }
        if (sql.includes('SELECT * FROM capability_approvals') && sql.includes('principal_id = ?')) {
          const [principal, capability, version, action, resource, digest, now] = v;
          const row = [...db.rows.values()].find(item =>
            item.principal_id === principal && item.capability_id === capability &&
            item.capability_version === version && item.action_id === action &&
            item.resource_id === resource && item.input_digest === digest &&
            item.status === 'approved' && !item.consumed_at && item.expires_at > now);
          return row ? { ...row } : null;
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
  assert.equal(record.operationSummary, binding.operationSummary);
  assert.equal(record.consumedAt, null);
});

test('rejects incomplete or already-expired approval requests', async () => {
  const db = new MemoryD1();
  await assert.rejects(() => createApprovalRequest(db, request({ inputDigest: '' })), /invalid/i);
  await assert.rejects(() => createApprovalRequest(db, request({
    expiresAt: new Date(Date.now() - 1000).toISOString(),
  })), /expiry/i);
});

test('pending approval listing is bounded and returns the human-readable operation summary', async () => {
  const db = new MemoryD1();
  await createApprovalRequest(db, request(), Date.now());
  const records = await listPendingApprovals(db, 10);
  assert.equal(records.length, 1);
  assert.equal(records[0].operationSummary, binding.operationSummary);
  await assert.rejects(() => listPendingApprovals(db, 101), /limit/i);
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
test('loads only an approved, unused approval bound to the exact principal, action, resource and digest', async () => {
  const db = new MemoryD1();
  const pending = await createApprovalRequest(db, request(), Date.now());
  await decideApprovalRequest(db, {
    id: pending.id, decision: 'approved', decidedBy: 'owner', now: Date.now(),
  });
  const loaded = await loadApproval(db, {
    principalId: binding.principalId,
    capabilityId: binding.capabilityId,
    capabilityVersion: binding.capabilityVersion,
    actionId: binding.actionId,
    resourceId: binding.resourceId,
    inputDigest: binding.inputDigest,
  }, Date.now());
  assert.equal(loaded.id, pending.id);
  assert.equal(loaded.connectionId, binding.connectionId);
  assert.equal(await loadApproval(db, {
    principalId: 'another-owner',
    capabilityId: binding.capabilityId,
    capabilityVersion: binding.capabilityVersion,
    actionId: binding.actionId,
    resourceId: binding.resourceId,
    inputDigest: binding.inputDigest,
  }, Date.now()), null);
  assert.equal(await loadApproval(db, {
    principalId: binding.principalId,
    capabilityId: binding.capabilityId,
    capabilityVersion: binding.capabilityVersion,
    actionId: binding.actionId,
    resourceId: binding.resourceId,
    inputDigest: 'sha256:' + 'a'.repeat(64),
  }, Date.now()), null);
  await consumeApproval(db, { id: pending.id, ...binding, now: Date.now() });
  assert.equal(await loadApproval(db, {
    principalId: binding.principalId,
    capabilityId: binding.capabilityId,
    capabilityVersion: binding.capabilityVersion,
    actionId: binding.actionId,
    resourceId: binding.resourceId,
    inputDigest: binding.inputDigest,
  }, Date.now()), null);
});


test('owner-scoped decision cannot approve another principal\'s pending request', async () => {
  const db = new MemoryD1();
  const pending = await createApprovalRequest(db, request({ principalId: 'another-owner' }), Date.now());
  const result = await decideApprovalRequest(db, {
    id: pending.id, decision: 'approved', decidedBy: 'owner',
    principalId: 'owner', now: Date.now(),
  });
  assert.equal(result, null);
  assert.equal(db.rows.get(pending.id).status, 'pending');
});


test('agent-run decision cannot approve a different capability owned by the same principal', async () => {
  const db = new MemoryD1();
  const pending = await createApprovalRequest(db, request({ capabilityId: 'another-capability' }), Date.now());
  const result = await decideApprovalRequest(db, {
    id: pending.id, decision: 'approved', decidedBy: 'owner',
    principalId: 'owner', capabilityId: 'aegis-agent-run', now: Date.now(),
  });
  assert.equal(result, null);
  assert.equal(db.rows.get(pending.id).status, 'pending');
});

test('Sentinel can retrieve a specific approved owner capability by its opaque approval ID', async () => {
  const db = new MemoryD1();
  const pending = await createApprovalRequest(db, request({
    principalId: 'owner',
    capabilityId: 'aegis-agent-run',
    capabilityVersion: '0.1.0',
    actionId: 'approve-execution',
    resourceId: 'agent-run:00000000-0000-4000-8000-000000000001',
    connectionId: null,
  }), Date.now());
  await decideApprovalRequest(db, {
    id: pending.id, decision: 'approved', decidedBy: 'owner',
    principalId: 'owner', capabilityId: 'aegis-agent-run', now: Date.now(),
  });
  const loaded = await loadApprovedApprovalById(db, pending.id, {
    principalId: 'owner', capabilityId: 'aegis-agent-run', now: Date.now(),
  });
  assert.equal(loaded.id, pending.id);
  assert.equal(loaded.status, 'approved');
  assert.equal(await loadApprovedApprovalById(db, pending.id, {
    principalId: 'other', capabilityId: 'aegis-agent-run', now: Date.now(),
  }), null);
  assert.equal(await loadApprovedApprovalById(db, pending.id, {
    principalId: 'owner', capabilityId: 'other', now: Date.now(),
  }), null);
});


test('loads a consumed approval only for its exact owner and capability for idempotent recovery', async () => {
  const db = new MemoryD1();
  const pending = await createApprovalRequest(db, request({
    principalId: 'owner',
    capabilityId: 'aegis-agent-run',
    capabilityVersion: '0.1.0',
    actionId: 'approve-execution',
    resourceId: 'agent-run:00000000-0000-4000-8000-000000000001',
    connectionId: null,
  }), Date.now());
  await decideApprovalRequest(db, {
    id: pending.id, decision: 'approved', decidedBy: 'owner',
    principalId: 'owner', capabilityId: 'aegis-agent-run', now: Date.now(),
  });
  const consumed = await consumeApproval(db, {
    id: pending.id,
    principalId: 'owner',
    capabilityId: 'aegis-agent-run',
    capabilityVersion: '0.1.0',
    actionId: 'approve-execution',
    resourceId: 'agent-run:00000000-0000-4000-8000-000000000001',
    operationSummary: pending.operationSummary,
    connectionId: null,
    inputDigest: pending.inputDigest,
    now: Date.now(),
  });
  assert.equal(consumed.status, 'consumed');
  assert.equal((await loadConsumedApprovalById(db, pending.id, {
    principalId: 'owner', capabilityId: 'aegis-agent-run',
  })).id, pending.id);
  assert.equal(await loadConsumedApprovalById(db, pending.id, {
    principalId: 'another-owner', capabilityId: 'aegis-agent-run',
  }), null);
  assert.equal(await loadConsumedApprovalById(db, pending.id, {
    principalId: 'owner', capabilityId: 'another-capability',
  }), null);
});

test('versioned permission request binds one exact principal, capability, resource and payload digest', () => {
  const now = Date.now();
  const canonical = {
    schemaVersion: '1.0',
    ...request({ expiresAt: new Date(now + 60_000).toISOString() }),
  };
  assert.equal(validatePermissionRequest(canonical, now), true);
});

test('permission request contract rejects version drift, extra authority and invalid expiry', () => {
  const now = Date.now();
  const canonical = {
    schemaVersion: '1.0',
    ...request({ expiresAt: new Date(now + 60_000).toISOString() }),
  };
  for (const candidate of [
    { ...canonical, schemaVersion: '2.0' },
    { ...canonical, permissions: ['shell.execute'] },
    { ...canonical, inputDigest: 'not-a-digest' },
    { ...canonical, expiresAt: new Date(now - 1).toISOString() },
    { ...canonical, expiresAt: new Date(now + 16 * 60_000).toISOString() },
    { ...canonical, operationSummary: '' },
    { ...canonical, connectionId: '../private' },
  ]) assert.throws(() => validatePermissionRequest(candidate, now));
});

test('approval creation rejects unexpected fields instead of silently accepting them', async () => {
  const db = new MemoryD1();
  await assert.rejects(() => createApprovalRequest(db, request({ executionAuthority: true }), Date.now()));
});
