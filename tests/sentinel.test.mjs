import test from 'node:test';
import assert from 'node:assert/strict';
import { getCapabilityManifest } from '../functions/lib/capability-registry.mjs';
import { createApprovalRequest, decideApprovalRequest } from '../functions/lib/capability-approvals.mjs';
import {
  createOperationDigest,
  authorizeSentinelInvocation,
} from '../functions/lib/sentinel.mjs';

const principalId = 'owner';
const resourceId = 'github:repo:owner/project';
const input = { title: 'A safe change', nested: { z: 2, a: 1 } };
const future = () => new Date(Date.now() + 60_000).toISOString();

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
          db.rows.set(v[0], {
            id: v[0], principal_id: v[1], capability_id: v[2], capability_version: v[3],
            action_id: v[4], resource_id: v[5], operation_summary: v[6],
            connection_id: v[7], input_digest: v[8], requested_by: v[9],
            requested_at: v[10], expires_at: v[11], status: 'pending',
            decided_by: null, decided_at: null, consumed_at: null,
          });
          return { meta: { changes: 1 } };
        }
        return { meta: { changes: 0 } };
      },
      async first() {
        const v = this.values;
        if (sql.includes("SET status = 'consumed'")) {
          const [consumedAt, id, now, principal, capability, version, action, resource, summary, connection, digest] = v;
          const row = db.rows.get(id);
          if (!row || row.status !== 'approved' || row.consumed_at || row.expires_at <= now ||
              row.principal_id !== principal || row.capability_id !== capability ||
              row.capability_version !== version || row.action_id !== action ||
              row.resource_id !== resource || row.operation_summary !== summary ||
              row.connection_id !== connection || row.input_digest !== digest) return null;
          row.status = 'consumed'; row.consumed_at = consumedAt;
          return { ...row };
        }
        if (sql.includes("status = 'pending'")) {
          const [decision, decidedBy, decidedAt, id, now] = v;
          const row = db.rows.get(id);
          if (!row || row.status !== 'pending' || row.expires_at <= now) return null;
          row.status = decision; row.decided_by = decidedBy; row.decided_at = decidedAt;
          return { ...row };
        }
        if (sql.includes('SELECT * FROM capability_approvals WHERE id = ?')) {
          const row = db.rows.get(v[0]);
          return row ? { ...row } : null;
        }
        return null;
      },
    };
  }
}

function writeManifest() {
  const manifest = getCapabilityManifest('aegis-github-public-discovery');
  manifest.actions = [{
    id: 'update',
    capability: 'github.repository-update',
    effect: 'write',
    risk: 'medium',
    approval: 'human-always',
    requiredScopes: ['github:repository:write'],
  }];
  return manifest;
}

function grantFor(manifest) {
  return {
    status: 'active',
    principalId,
    capabilityId: manifest.id,
    capabilityVersion: manifest.version,
    scopes: ['github:repository:write'],
    resourceIds: [resourceId],
    expiresAt: future(),
  };
}

test('operation digest is stable regardless of object key order', async () => {
  const first = await createOperationDigest({ title: 'x', nested: { b: 2, a: 1 } });
  const second = await createOperationDigest({ nested: { a: 1, b: 2 }, title: 'x' });
  assert.equal(first, second);
  assert.match(first, /^sha256:[a-f0-9]{64}$/);
});

test('operation digest rejects values that cannot be represented as canonical JSON', async () => {
  await assert.rejects(() => createOperationDigest({ value: undefined }), /JSON|operation/i);
  await assert.rejects(() => createOperationDigest({ value: Number.NaN }), /JSON|operation/i);
});

test('Sentinel denies invocation when the grant is absent', async () => {
  const manifest = getCapabilityManifest('aegis-github-public-discovery');
  const result = await authorizeSentinelInvocation({
    capabilityId: manifest.id,
    actionId: 'discover',
    principalId,
    resourceId,
    input,
    registryLookup: () => manifest,
    now: Date.now(),
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, 'GRANT_REQUIRED');
});

test('Sentinel permits a registered read action only with its exact active grant', async () => {
  const manifest = getCapabilityManifest('aegis-github-public-discovery');
  const result = await authorizeSentinelInvocation({
    capabilityId: manifest.id,
    actionId: 'discover',
    principalId,
    resourceId,
    input,
    grant: {
      status: 'active', principalId, capabilityId: manifest.id,
      capabilityVersion: manifest.version,
      scopes: ['github:public-metadata:read'], resourceIds: [resourceId],
      expiresAt: future(),
    },
    registryLookup: () => manifest,
  });
  assert.equal(result.allowed, true);
  assert.equal(result.reasonCode, 'ALLOW');
  assert.match(result.inputDigest, /^sha256:[a-f0-9]{64}$/);
});

test('Sentinel consumes an exact human approval once before allowing a write action', async () => {
  const db = new MemoryD1();
  const manifest = writeManifest();
  const digest = await createOperationDigest(input);
  const pending = await createApprovalRequest(db, {
    principalId, capabilityId: manifest.id, capabilityVersion: manifest.version,
    actionId: 'update', resourceId, operationSummary: 'Update owner/project',
    connectionId: null, inputDigest: digest, requestedBy: 'agent:forge',
    expiresAt: future(),
  });
  await decideApprovalRequest(db, {
    id: pending.id, decision: 'approved', decidedBy: 'owner',
  });

  const args = {
    capabilityId: manifest.id, actionId: 'update', principalId, resourceId, input,
    grant: grantFor(manifest), approvalId: pending.id, approvalDb: db,
    registryLookup: () => manifest,
  };
  const first = await authorizeSentinelInvocation(args);
  assert.equal(first.allowed, true);
  assert.equal(first.approvalConsumed, true);
  assert.equal(db.rows.get(pending.id).status, 'consumed');

  const replay = await authorizeSentinelInvocation(args);
  assert.equal(replay.allowed, false);
  assert.equal(replay.reasonCode, 'APPROVAL_REPLAYED');
});

test('Sentinel does not consume approval when the operation payload changes', async () => {
  const db = new MemoryD1();
  const manifest = writeManifest();
  const digest = await createOperationDigest(input);
  const pending = await createApprovalRequest(db, {
    principalId, capabilityId: manifest.id, capabilityVersion: manifest.version,
    actionId: 'update', resourceId, operationSummary: 'Update owner/project',
    connectionId: null, inputDigest: digest, requestedBy: 'agent:forge',
    expiresAt: future(),
  });
  await decideApprovalRequest(db, {
    id: pending.id, decision: 'approved', decidedBy: 'owner',
  });

  const result = await authorizeSentinelInvocation({
    capabilityId: manifest.id, actionId: 'update', principalId, resourceId,
    input: { ...input, title: 'A different change' },
    grant: grantFor(manifest), approvalId: pending.id, approvalDb: db,
    registryLookup: () => manifest,
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, 'APPROVAL_MISMATCH');
  assert.equal(db.rows.get(pending.id).status, 'approved');
});

test('Sentinel refuses a protected write when no approval ID is supplied', async () => {
  const manifest = writeManifest();
  const result = await authorizeSentinelInvocation({
    capabilityId: manifest.id, actionId: 'update', principalId, resourceId,
    input, grant: grantFor(manifest), registryLookup: () => manifest,
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, 'APPROVAL_REQUIRED');
});
