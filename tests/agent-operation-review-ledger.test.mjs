import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appendAgentOperationReview,
  listAgentOperationReviews,
} from '../workers/runtime/agent-operation-review-ledger.mjs';
import { digestCanonicalInput } from '../functions/lib/canonical-input.mjs';

const digest = letter => 'sha256:' + letter.repeat(64);
const action = {
  actionId: 'action-review-0001',
  actionType: 'workspace_write',
  summary: 'Write a reviewed workspace draft.',
  target: 'workspace:/drafts/change.json',
  parametersDigest: digest('b'),
};
const evidence = [{ evidenceId: 'diff-review-0001', digest: digest('a') }];

async function requestRow() {
  const unsigned = {
    schemaVersion: 'aegis.agent-operation-request.v1',
    requestId: 'operation-review-0001',
    runId: 'run-review-0001',
    workflowId: 'workflow-review',
    definitionDigest: digest('c'),
    checkpointId: 'checkpoint-review-0001',
    checkpointDigest: digest('d'),
    checkpointSequence: 1,
    action,
    actionDigest: await digestCanonicalInput(action),
    evidence,
    evidenceDigest: await digestCanonicalInput(evidence),
    createdAt: '2026-11-21T15:10:00.000Z',
    status: 'awaiting_human_review',
    authority: {
      sentinelApprovalRequired: true,
      approvalGranted: false,
      execution: 'not_authorised',
      capabilitiesGranted: false,
      selfApproval: false,
    },
  };
  const request = { ...unsigned, requestDigest: await digestCanonicalInput(unsigned) };
  return {
    principal_id: 'owner-a',
    request_id: request.requestId,
    run_id: request.runId,
    workflow_id: request.workflowId,
    definition_digest: request.definitionDigest,
    checkpoint_digest: request.checkpointDigest,
    action_digest: request.actionDigest,
    evidence_digest: request.evidenceDigest,
    request_digest: request.requestDigest,
    request_json: JSON.stringify(request),
    created_at: request.createdAt,
  };
}

class FakeD1 {
  constructor(requests = []) {
    this.requests = new Map(requests.map(row => [row.principal_id + ':' + row.request_id, row]));
    this.events = new Map();
  }
  prepare(sql) {
    const db = this;
    let values = [];
    return {
      bind(...args) {
        values = args;
        return {
          async first() {
            if (sql.includes('FROM agent_operation_requests')) {
              const [principalId, requestId] = values;
              return db.requests.get(principalId + ':' + requestId) || null;
            }
            if (sql.includes('FROM agent_operation_review_events')) {
              const [principalId, eventId] = values;
              return db.events.get(principalId + ':' + eventId) || null;
            }
            throw new Error('Unexpected first SQL: ' + sql);
          },
          async run() {
            if (!sql.startsWith('INSERT INTO agent_operation_review_events')) {
              throw new Error('Unexpected run SQL: ' + sql);
            }
            const [eventId, principalId, requestId, requestDigest, actionDigest,
              evidenceDigest, decision, note, createdAt] = values;
            const key = principalId + ':' + eventId;
            if (db.events.has(key)) return { meta: { changes: 0 } };
            db.events.set(key, {
              event_id: eventId, principal_id: principalId, request_id: requestId,
              request_digest: requestDigest, action_digest: actionDigest,
              evidence_digest: evidenceDigest, decision, note, created_at: createdAt,
            });
            return { meta: { changes: 1 } };
          },
          async all() {
            if (!sql.includes('FROM agent_operation_review_events')) {
              throw new Error('Unexpected all SQL: ' + sql);
            }
            const [principalId, requestId, limit] = values;
            return {
              results: [...db.events.values()]
                .filter(row => row.principal_id === principalId && row.request_id === requestId)
                .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.event_id.localeCompare(a.event_id))
                .slice(0, limit),
            };
          },
        };
      },
    };
  }
}

const reviewInput = {
  eventId: 'review-event-0001',
  requestId: 'operation-review-0001',
  requestDigest: null,
  actionDigest: null,
  evidenceDigest: null,
  decision: 'accepted_for_sentinel_evaluation',
  note: 'The evidence supports forwarding this exact proposal for independent Sentinel evaluation.',
  createdAt: '2026-11-21T15:20:00.000Z',
};

async function fixture() {
  const row = await requestRow();
  const db = new FakeD1([row]);
  const input = {
    ...reviewInput,
    requestDigest: row.request_digest,
    actionDigest: row.action_digest,
    evidenceDigest: row.evidence_digest,
  };
  return { db, row, input };
}

test('appends a human review bound to exact request, action and evidence digests', async () => {
  const { db, row, input } = await fixture();
  const result = await appendAgentOperationReview(db, 'owner-a', input);
  assert.equal(result.created, true);
  assert.equal(result.review.requestId, row.request_id);
  assert.equal(result.review.requestDigest, row.request_digest);
  assert.equal(result.review.actionDigest, row.action_digest);
  assert.equal(result.review.evidenceDigest, row.evidence_digest);
  assert.equal(result.review.decision, 'accepted_for_sentinel_evaluation');
  assert.equal(result.review.authority.approvalGranted, false);
  assert.equal(result.review.authority.execution, 'not_authorised');
  assert.equal(result.review.authority.sentinelApprovalRequired, true);
  assert.equal((await listAgentOperationReviews(db, 'owner-a', row.request_id)).length, 1);
});

test('rejects review events when any bound request, action or evidence digest differs', async () => {
  const { db, input } = await fixture();
  await assert.rejects(
    () => appendAgentOperationReview(db, 'owner-a', { ...input, requestDigest: digest('f') }),
    /request|digest/i,
  );
  await assert.rejects(
    () => appendAgentOperationReview(db, 'owner-a', { ...input, actionDigest: digest('f') }),
    /action|digest/i,
  );
  await assert.rejects(
    () => appendAgentOperationReview(db, 'owner-a', { ...input, evidenceDigest: digest('f') }),
    /evidence|digest/i,
  );
  assert.equal(db.events.size, 0);
});

test('rejects missing, cross-owner and tampered inbox requests', async () => {
  const { db, input, row } = await fixture();
  await assert.rejects(() => appendAgentOperationReview(db, 'owner-b', input), /not found|ownership/i);
  await assert.rejects(
    () => appendAgentOperationReview(db, 'owner-a', { ...input, requestId: 'missing-request-0001' }),
    /not found/i,
  );
  row.request_json = row.request_json.replace('awaiting_human_review', 'approved');
  await assert.rejects(() => appendAgentOperationReview(db, 'owner-a', input), /integrity|digest|request/i);
  assert.equal(db.events.size, 0);
});

test('makes exact event retries idempotent and rejects event identity reuse with changed content', async () => {
  const { db, input } = await fixture();
  assert.equal((await appendAgentOperationReview(db, 'owner-a', input)).created, true);
  assert.equal((await appendAgentOperationReview(db, 'owner-a', input)).created, false);
  await assert.rejects(
    () => appendAgentOperationReview(db, 'owner-a', { ...input, note: 'Changed review note.' }),
    /different immutable content/i,
  );
  assert.equal(db.events.size, 1);
});

test('rejects approval-like decisions, unsafe notes and caller-selected ownership', async () => {
  const { db, input } = await fixture();
  await assert.rejects(() => appendAgentOperationReview(db, 'owner-a', { ...input, decision: 'approved' }), /decision/i);
  await assert.rejects(() => appendAgentOperationReview(db, 'owner-a', { ...input, decision: 'execute' }), /decision/i);
  await assert.rejects(() => appendAgentOperationReview(db, 'owner-a', { ...input, note: '   ' }), /note/i);
  await assert.rejects(() => appendAgentOperationReview(db, 'owner-a', { ...input, note: 'bad\nforged' }), /note/i);
  await assert.rejects(() => appendAgentOperationReview(db, 'owner-a', { ...input, ownerId: 'owner-b' }), /owner|unsupported/i);
  assert.equal(db.events.size, 0);
});

test('rejects review timestamps before request creation and invalid pagination limits', async () => {
  const { db, input, row } = await fixture();
  await assert.rejects(
    () => appendAgentOperationReview(db, 'owner-a', { ...input, createdAt: '2026-11-21T15:09:00.000Z' }),
    /predate|timestamp/i,
  );
  await assert.rejects(() => listAgentOperationReviews(db, 'owner-a', row.request_id, { limit: 101 }), /limit/i);
});

test('lists review history newest-first and isolates other principals', async () => {
  const { db, input, row } = await fixture();
  await appendAgentOperationReview(db, 'owner-a', input);
  await appendAgentOperationReview(db, 'owner-a', {
    ...input, eventId: 'review-event-0002', decision: 'needs_more_evidence',
    createdAt: '2026-11-21T15:21:00.000Z',
  });
  const events = await listAgentOperationReviews(db, 'owner-a', row.request_id);
  assert.deepEqual(events.map(item => item.decision), [
    'needs_more_evidence', 'accepted_for_sentinel_evaluation',
  ]);
  assert.deepEqual(await listAgentOperationReviews(db, 'owner-b', row.request_id), []);
});
