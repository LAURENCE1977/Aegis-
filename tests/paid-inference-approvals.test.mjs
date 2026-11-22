import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPaidInferenceApprovalBinding,
  requestPaidInferenceApproval,
  consumePaidInferenceApproval,
} from '../functions/lib/paid-inference-approvals.mjs';

const request = (overrides = {}) => ({
  threadId: 'thread-123',
  runId: 'run-123',
  providerId: 'anthropic',
  modelId: 'claude-sonnet-4-5',
  estimatedTokens: 2400,
  maxTokensPerRun: 5000,
  requestDigest: 'sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  ...overrides,
});

class ApprovalMemoryD1 {
  constructor() { this.rows = new Map(); }
  prepare(sql) {
    const db = this;
    return {
      values: [],
      bind(...values) { this.values = values; return this; },
      async run() {
        if (sql.includes('INSERT INTO capability_approvals')) {
          const v = this.values;
          db.rows.set(v[0], {
            id: v[0], principal_id: v[1], capability_id: v[2],
            capability_version: v[3], action_id: v[4], resource_id: v[5],
            operation_summary: v[6], connection_id: v[7], input_digest: v[8],
            requested_by: v[9], requested_at: v[10], expires_at: v[11],
            status: 'pending', decided_by: null, decided_at: null, consumed_at: null,
          });
        }
        return { meta: { changes: 1 } };
      },
      async first() {
        const v = this.values;
        if (sql.includes('SELECT * FROM capability_approvals WHERE id = ?')) {
          const row = db.rows.get(v[0]);
          return row ? { ...row } : null;
        }
        if (sql.includes('SELECT * FROM capability_approvals') && sql.includes('input_digest = ?')) {
          const row = [...db.rows.values()].find(item =>
            item.principal_id === v[0] && item.capability_id === v[1] &&
            item.capability_version === v[2] && item.action_id === v[3] &&
            item.resource_id === v[4] && item.input_digest === v[5] &&
            ['pending', 'approved', 'denied', 'consumed'].includes(item.status)
          );
          return row ? { ...row } : null;
        }
        if (sql.includes("UPDATE capability_approvals")) {
          const [consumedAt, id, expiresAt, principal, capability, version, action, resource, summary, connection, digest] = v;
          const row = db.rows.get(id);
          if (!row || row.status !== 'approved' || row.consumed_at ||
              row.expires_at <= expiresAt || row.principal_id !== principal ||
              row.capability_id !== capability || row.capability_version !== version ||
              row.action_id !== action || row.resource_id !== resource ||
              row.operation_summary !== summary || row.connection_id !== connection ||
              row.input_digest !== digest) return null;
          row.status = 'consumed';
          row.consumed_at = consumedAt;
          return { ...row };
        }
        return null;
      },
    };
  }
}

test('paid approval binding is exact to the run, provider, model, token ceiling and request digest', async () => {
  const base = await buildPaidInferenceApprovalBinding(request());
  for (const change of [
    { runId: 'run-456' },
    { providerId: 'alibaba-qwen' },
    { modelId: 'claude-opus-4-5' },
    { estimatedTokens: 2401 },
    { maxTokensPerRun: 5001 },
    { requestDigest: 'sha256:abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789' },
  ]) {
    const changed = await buildPaidInferenceApprovalBinding(request(change));
    assert.notEqual(changed.inputDigest, base.inputDigest);
  }
  assert.equal(base.capabilityId, 'paid-inference');
  assert.equal(base.actionId, 'dispatch');
  assert.match(base.resourceId, /run-123/);
  assert.doesNotMatch(base.operationSummary, /Hello|prompt text/i);
});

test('paid inference creates one pending owner approval with a short expiry', async () => {
  const db = new ApprovalMemoryD1();
  const now = Date.parse('2026-11-22T18:00:00.000Z');
  const result = await requestPaidInferenceApproval(db, request(), now);
  assert.equal(result.status, 'pending');
  assert.equal(result.approval.requestedBy, 'owner:ag-ui');
  assert.equal(Date.parse(result.approval.expiresAt), now + 10 * 60 * 1000);
  assert.equal(result.approval.resourceId, 'paid-inference:anthropic:claude-sonnet-4-5:run-123');
});

test('repeated identical paid requests reuse the same pending approval instead of creating duplicates', async () => {
  const db = new ApprovalMemoryD1();
  const first = await requestPaidInferenceApproval(db, request(), Date.parse('2026-11-22T18:00:00.000Z'));
  const second = await requestPaidInferenceApproval(db, request(), Date.parse('2026-11-22T18:01:00.000Z'));
  assert.equal(second.approval.id, first.approval.id);
  assert.equal(db.rows.size, 1);
});

test('an approval is consumed once for the same exact paid run and cannot be replayed', async () => {
  const db = new ApprovalMemoryD1();
  const created = await requestPaidInferenceApproval(db, request(), Date.parse('2026-11-22T18:00:00.000Z'));
  const row = db.rows.get(created.approval.id);
  row.status = 'approved';
  row.decided_by = 'owner';
  row.decided_at = '2026-11-22T18:00:30.000Z';
  const consumed = await consumePaidInferenceApproval(db, request({ approvalId: created.approval.id }), Date.parse('2026-11-22T18:01:00.000Z'));
  assert.equal(consumed.status, 'consumed');
  const replay = await consumePaidInferenceApproval(db, request({ approvalId: created.approval.id }), Date.parse('2026-11-22T18:01:01.000Z'));
  assert.equal(replay, null);
});
