import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appendAgentOperationRequest,
  listAgentOperationRequests,
} from '../workers/runtime/agent-operation-inbox-store.mjs';
import { createAgentOperationRequest } from '../workers/runtime/agent-operation-request.mjs';
import { createAgentWorkflowDefinition } from '../workers/runtime/agent-workflow-definition.mjs';
import { createAgentWorkflowRun } from '../workers/runtime/agent-workflow-run.mjs';
import { createAgentWorkflowCheckpoint } from '../workers/runtime/agent-workflow-checkpoint.mjs';

const definition = createAgentWorkflowDefinition({
  workflowId: 'ops-inbox-store',
  title: 'Operations inbox persistence',
  version: 1,
  createdAt: '2026-11-21T15:00:00.000Z',
  steps: [{
    stepId: 'prepare-change', kind: 'propose', dependsOn: [],
    capabilities: ['workspace_write'], evidenceRequired: true, approval: 'human_required',
  }],
});
const run = await createAgentWorkflowRun({
  definition, runId: 'run-ops-inbox-store-001',
  createdAt: '2026-11-21T15:05:00.000Z',
  observedAt: '2026-11-21T15:30:00.000Z',
});
const checkpoint = await createAgentWorkflowCheckpoint({
  run, definition, checkpointId: 'checkpoint-ops-inbox-store-001', sequence: 1,
  observedAt: '2026-11-21T15:10:00.000Z',
  eventType: 'evidence_reference_observed', stepId: 'prepare-change',
  evidence: [{ evidenceId: 'diff-ops-inbox-001', digest: 'sha256:' + 'a'.repeat(64) }],
});
const now = '2026-11-21T15:30:00.000Z';

async function makeRequest(requestId, createdAt = '2026-11-21T15:15:00.000Z') {
  return createAgentOperationRequest({
    requestId, definition, run, checkpoint,
    action: {
      actionId: 'action-' + requestId,
      actionType: 'workspace_write',
      summary: 'Write the reviewed draft to the workspace.',
      target: 'workspace:/drafts/change.json',
      parametersDigest: 'sha256:' + 'b'.repeat(64),
    },
    createdAt,
    observedAt: now,
  });
}

class FakeD1 {
  constructor() { this.rows = new Map(); }
  prepare(sql) {
    const db = this;
    let values = [];
    return {
      bind(...args) {
        values = args;
        return {
          async run() {
            if (!sql.startsWith('INSERT INTO agent_operation_requests')) {
              throw new Error('Unexpected SQL: ' + sql);
            }
            const [principalId, requestId, runId, workflowId, definitionDigest,
              checkpointDigest, actionDigest, evidenceDigest, requestDigest,
              requestJson, createdAt] = values;
            const key = principalId + ':' + requestId;
            if (db.rows.has(key)) return { meta: { changes: 0 } };
            db.rows.set(key, {
              principal_id: principalId, request_id: requestId, run_id: runId,
              workflow_id: workflowId, definition_digest: definitionDigest,
              checkpoint_digest: checkpointDigest, action_digest: actionDigest,
              evidence_digest: evidenceDigest, request_digest: requestDigest,
              request_json: requestJson, created_at: createdAt,
            });
            return { meta: { changes: 1 } };
          },
          async first() {
            const [principalId, requestId] = values;
            return db.rows.get(principalId + ':' + requestId) || null;
          },
          async all() {
            const [principalId, nullCursor, beforeCreatedAt, sameCreatedAt, beforeRequestId, limit] = values;
            return {
              results: [...db.rows.values()]
                .filter(row => row.principal_id === principalId &&
                  (nullCursor === null || row.created_at < beforeCreatedAt ||
                    (row.created_at === sameCreatedAt && row.request_id < beforeRequestId)))
                .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.request_id.localeCompare(a.request_id))
                .slice(0, limit),
            };
          },
        };
      },
    };
  }
}

test('appends immutable operation requests and lists only the authenticated principal inbox', async () => {
  const db = new FakeD1();
  const request = await makeRequest('operation-request-store-0001');
  const saved = await appendAgentOperationRequest({
    db, principalId: 'owner-a', definition, run, checkpoint, request, now,
  });
  assert.equal(saved.status, 'appended');
  assert.equal(saved.requestDigest, request.requestDigest);
  const page = await listAgentOperationRequests({ db, principalId: 'owner-a' });
  assert.equal(page.requests.length, 1);
  assert.equal(page.requests[0].requestId, request.requestId);
  assert.equal(page.requests[0].authority.approvalGranted, false);
  assert.equal(page.requests[0].authority.execution, 'not_authorised');
  assert.deepEqual((await listAgentOperationRequests({ db, principalId: 'owner-b' })).requests, []);
});

test('makes exact retries idempotent and rejects reuse of a request ID with changed content', async () => {
  const db = new FakeD1();
  const request = await makeRequest('operation-request-store-0002');
  const args = { db, principalId: 'owner-a', definition, run, checkpoint, request, now };
  assert.equal((await appendAgentOperationRequest(args)).status, 'appended');
  assert.equal((await appendAgentOperationRequest(args)).status, 'already_recorded');
  const changed = await makeRequest('operation-request-store-0002', '2026-11-21T15:16:00.000Z');
  await assert.rejects(
    () => appendAgentOperationRequest({ ...args, request: changed }),
    /different immutable content/i,
  );
  assert.equal(db.rows.size, 1);
});

test('rejects caller-selected ownership, forged request envelopes and invalid principals', async () => {
  const db = new FakeD1();
  const request = await makeRequest('operation-request-store-0003');
  await assert.rejects(() => appendAgentOperationRequest({
    db, principalId: '../owner', definition, run, checkpoint, request, now,
  }), /principal/i);
  await assert.rejects(() => appendAgentOperationRequest({
    db, principalId: 'owner-a', definition, run, checkpoint,
    request: { ...request, ownerId: 'owner-b' }, now,
  }), /request|owner|unsupported/i);
  await assert.rejects(() => appendAgentOperationRequest({
    db, principalId: 'owner-a', definition, run, checkpoint,
    request: { ...request, authority: { ...request.authority, approvalGranted: true } }, now,
  }), /request|contract|digest/i);
  assert.equal(db.rows.size, 0);
});

test('rejects a request newer than its server acceptance time', async () => {
  const db = new FakeD1();
  const request = await makeRequest('operation-request-store-0004');
  await assert.rejects(() => appendAgentOperationRequest({
    db, principalId: 'owner-a', definition, run, checkpoint, request,
    now: '2026-11-21T15:14:00.000Z',
  }), /future|observation/i);
});

test('detects tampering with persisted request bytes and row metadata', async () => {
  const db = new FakeD1();
  const request = await makeRequest('operation-request-store-0005');
  await appendAgentOperationRequest({ db, principalId: 'owner-a', definition, run, checkpoint, request, now });
  const row = db.rows.get('owner-a:' + request.requestId);
  row.request_json = row.request_json.replace('workspace_write', 'artifact_write');
  await assert.rejects(
    () => listAgentOperationRequests({ db, principalId: 'owner-a' }),
    /integrity|digest|metadata/i,
  );
});

test('paginates newest-first with a stable compound cursor', async () => {
  const db = new FakeD1();
  const older = await makeRequest('operation-request-store-0006', '2026-11-21T15:15:00.000Z');
  const newer = await makeRequest('operation-request-store-0007', '2026-11-21T15:16:00.000Z');
  await appendAgentOperationRequest({ db, principalId: 'owner-a', definition, run, checkpoint, request: older, now });
  await appendAgentOperationRequest({ db, principalId: 'owner-a', definition, run, checkpoint, request: newer, now });
  const first = await listAgentOperationRequests({ db, principalId: 'owner-a', limit: 1 });
  assert.deepEqual(first.requests.map(item => item.requestId), [newer.requestId]);
  assert.equal(first.hasMore, true);
  const second = await listAgentOperationRequests({
    db, principalId: 'owner-a', limit: 1,
    afterCreatedAt: first.nextCursor.createdAt,
    afterRequestId: first.nextCursor.requestId,
  });
  assert.deepEqual(second.requests.map(item => item.requestId), [older.requestId]);
  assert.equal(second.hasMore, false);
});

test('concurrent attempts for one request identity persist exactly one immutable row', async () => {
  const db = new FakeD1();
  const request = await makeRequest('operation-request-store-0008');
  const args = { db, principalId: 'owner-a', definition, run, checkpoint, request, now };
  const results = await Promise.all(Array.from({ length: 10 }, () => appendAgentOperationRequest(args)));
  assert.equal(results.filter(item => item.status === 'appended').length, 1);
  assert.equal(results.filter(item => item.status === 'already_recorded').length, 9);
  assert.equal(db.rows.size, 1);
});
