import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRuntimeFetch } from '../workers/runtime/index.mjs';
import { createAgentWorkflowDefinition } from '../workers/runtime/agent-workflow-definition.mjs';
import { createAgentWorkflowRun } from '../workers/runtime/agent-workflow-run.mjs';
import { createAgentWorkflowCheckpoint } from '../workers/runtime/agent-workflow-checkpoint.mjs';
import { createSessionToken } from '../functions/lib/auth.mjs';
import { onRequest as agentOperationsApi } from '../functions/api/agent-operations.js';
import { onRequest as agentOperationReviewsApi } from '../functions/api/agent-operations/reviews.js';

const token = 'agent-operations-runtime-token-with-at-least-32-characters';
const sessionSecret = 'agent-operations-pages-session-secret';
const session = await createSessionToken(sessionSecret);

const definition = createAgentWorkflowDefinition({
  workflowId: 'http-agent-ops',
  title: 'HTTP Agent Operations',
  version: 1,
  createdAt: '2026-11-20T09:00:00.000Z',
  steps: [{
    stepId: 'prepare-change', kind: 'propose', dependsOn: [],
    capabilities: ['workspace_write'], evidenceRequired: true, approval: 'human_required',
  }],
});
const run = await createAgentWorkflowRun({
  definition, runId: 'run-http-agent-ops-0001',
  createdAt: '2026-11-20T09:05:00.000Z',
  observedAt: '2026-11-20T10:00:00.000Z',
});
const checkpoint = await createAgentWorkflowCheckpoint({
  run, definition, checkpointId: 'checkpoint-http-agent-ops-0001', sequence: 1,
  observedAt: '2026-11-20T09:10:00.000Z',
  eventType: 'evidence_reference_observed', stepId: 'prepare-change',
  evidence: [{ evidenceId: 'diff-http-agent-ops', digest: 'sha256:' + 'a'.repeat(64) }],
});
const action = {
  actionId: 'action-http-agent-ops-0001',
  actionType: 'workspace_write',
  summary: 'Write the reviewed draft to the workspace.',
  target: 'workspace:/drafts/agent-ops.json',
  parametersDigest: 'sha256:' + 'b'.repeat(64),
};

class OperationsD1 {
  constructor({ seedCheckpoint = true } = {}) {
    this.checkpoints = [];
    this.requests = new Map();
    this.reviews = new Map();
    if (seedCheckpoint) this.checkpoints.push({
      principal_id: 'owner', run_id: run.runId, sequence: checkpoint.sequence,
      checkpoint_id: checkpoint.checkpointId, workflow_id: checkpoint.workflowId,
      definition_digest: checkpoint.definitionDigest,
      checkpoint_digest: checkpoint.checkpointDigest,
      checkpoint_json: JSON.stringify(checkpoint), observed_at: checkpoint.observedAt,
    });
  }
  prepare(sql) {
    const db = this;
    let values = [];
    return {
      bind(...args) {
        values = args;
        return {
          async run() {
            if (sql.startsWith('INSERT INTO agent_operation_requests')) {
              const [principalId, requestId, runId, workflowId, definitionDigest,
                checkpointDigest, actionDigest, evidenceDigest, requestDigest,
                requestJson, createdAt] = values;
              const key = principalId + ':' + requestId;
              if (db.requests.has(key)) return { meta: { changes: 0 } };
              db.requests.set(key, {
                principal_id: principalId, request_id: requestId, run_id: runId,
                workflow_id: workflowId, definition_digest: definitionDigest,
                checkpoint_digest: checkpointDigest, action_digest: actionDigest,
                evidence_digest: evidenceDigest, request_digest: requestDigest,
                request_json: requestJson, created_at: createdAt,
              });
              return { meta: { changes: 1 } };
            }
            if (sql.startsWith('INSERT INTO agent_operation_review_events')) {
              const [eventId, principalId, requestId, requestDigest, actionDigest,
                evidenceDigest, decision, note, createdAt] = values;
              const key = principalId + ':' + eventId;
              if (db.reviews.has(key)) return { meta: { changes: 0 } };
              db.reviews.set(key, {
                event_id: eventId, principal_id: principalId, request_id: requestId,
                request_digest: requestDigest, action_digest: actionDigest,
                evidence_digest: evidenceDigest, decision, note, created_at: createdAt,
              });
              return { meta: { changes: 1 } };
            }
            throw new Error('Unexpected SQL run: ' + sql);
          },
          async first() {
            if (sql.includes('FROM agent_operation_requests')) {
              const [principalId, requestId] = values;
              return db.requests.get(principalId + ':' + requestId) || null;
            }
            if (sql.includes('FROM agent_operation_review_events')) {
              const [principalId, eventId] = values;
              return db.reviews.get(principalId + ':' + eventId) || null;
            }
            throw new Error('Unexpected SQL first: ' + sql);
          },
          async all() {
            if (sql.includes('FROM agent_workflow_checkpoints')) {
              const [principalId, runId, afterSequence, limit] = values;
              return { results: db.checkpoints
                .filter(row => row.principal_id === principalId && row.run_id === runId && row.sequence > afterSequence)
                .sort((a, b) => a.sequence - b.sequence).slice(0, limit) };
            }
            if (sql.includes('FROM agent_operation_requests')) {
              const [principalId, cursorNull, beforeCreatedAt, sameCreatedAt, beforeRequestId, limit] = values;
              return { results: [...db.requests.values()]
                .filter(row => row.principal_id === principalId &&
                  (cursorNull === null || row.created_at < beforeCreatedAt ||
                    (row.created_at === sameCreatedAt && row.request_id < beforeRequestId)))
                .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.request_id.localeCompare(a.request_id))
                .slice(0, limit) };
            }
            if (sql.includes('FROM agent_operation_review_events')) {
              const [principalId, requestId, limit] = values;
              return { results: [...db.reviews.values()]
                .filter(row => row.principal_id === principalId && row.request_id === requestId)
                .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.event_id.localeCompare(a.event_id))
                .slice(0, limit) };
            }
            throw new Error('Unexpected SQL all: ' + sql);
          },
        };
      },
    };
  }
}

function runtimeRequest(path, { method = 'GET', body, principal = 'owner', authorization = 'Bearer ' + token } = {}) {
  const headers = {};
  if (authorization) headers.Authorization = authorization;
  if (principal !== null) headers['X-Aegis-Principal'] = principal;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return new Request('https://runtime.example' + path, {
    method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function pagesRequest(path, { method = 'GET', body, origin = 'https://aegis.example', authenticated = true } = {}) {
  const headers = {};
  if (authenticated) headers.Cookie = '__Host-aegis_session=' + session;
  if (origin) headers.Origin = origin;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return new Request('https://aegis.example' + path, {
    method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

const pagesEnv = {
  AEGIS_PASSWORD: 'test-password',
  AEGIS_SESSION_SECRET: sessionSecret,
  AEGIS_RUNTIME_URL: 'https://runtime.example/',
  AEGIS_JOB_TOKEN: token,
};

test('runtime Agent Operations routes authenticate before touching D1 and require trusted owner context', async () => {
  let calls = 0;
  const env = { AEGIS_JOB_TOKEN: token, DB: { prepare() { calls += 1; throw new Error('must not query'); } } };
  const unauthenticated = await handleRuntimeFetch(runtimeRequest('/v1/agent-operations', { authorization: 'Bearer wrong' }), env);
  assert.equal(unauthenticated.status, 401);
  const noPrincipal = await handleRuntimeFetch(runtimeRequest('/v1/agent-operations', { principal: null }), env);
  assert.equal(noPrincipal.status, 400);
  const otherPrincipal = await handleRuntimeFetch(runtimeRequest('/v1/agent-operations', { principal: 'other-owner' }), env);
  assert.equal(otherPrincipal.status, 400);
  assert.equal(calls, 0);
});

test('runtime creates an inbox request only when its exact evidence checkpoint is persisted', async () => {
  const DB = new OperationsD1();
  const response = await handleRuntimeFetch(runtimeRequest('/v1/agent-operations', {
    method: 'POST',
    body: { requestId: 'operation-http-0001', definition, run, checkpoint, action },
  }), { AEGIS_JOB_TOKEN: token, DB });
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.request.status, 'awaiting_human_review');
  assert.equal(body.request.authority.approvalGranted, false);
  assert.equal(body.request.authority.execution, 'not_authorised');
  assert.equal(DB.requests.size, 1);

  const missingDb = new OperationsD1({ seedCheckpoint: false });
  const missing = await handleRuntimeFetch(runtimeRequest('/v1/agent-operations', {
    method: 'POST',
    body: { requestId: 'operation-http-0002', definition, run, checkpoint, action },
  }), { AEGIS_JOB_TOKEN: token, DB: missingDb });
  assert.equal(missing.status, 409);
  assert.equal(missingDb.requests.size, 0);
});

test('runtime inbox GET returns owner-scoped requests with bounded pagination', async () => {
  const DB = new OperationsD1();
  await handleRuntimeFetch(runtimeRequest('/v1/agent-operations', {
    method: 'POST', body: { requestId: 'operation-http-0003', definition, run, checkpoint, action },
  }), { AEGIS_JOB_TOKEN: token, DB });
  const response = await handleRuntimeFetch(runtimeRequest('/v1/agent-operations?limit=10'), {
    AEGIS_JOB_TOKEN: token, DB,
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.requests.length, 1);
  assert.equal(body.requests[0].requestId, 'operation-http-0003');
});

test('runtime records a human review bound to all exact digests and never authorizes execution', async () => {
  const DB = new OperationsD1();
  const created = await handleRuntimeFetch(runtimeRequest('/v1/agent-operations', {
    method: 'POST', body: { requestId: 'operation-http-0004', definition, run, checkpoint, action },
  }), { AEGIS_JOB_TOKEN: token, DB });
  const request = (await created.json()).request;
  const review = await handleRuntimeFetch(runtimeRequest('/v1/agent-operations/reviews', {
    method: 'POST',
    body: {
      eventId: 'review-event-http-0004',
      requestId: request.requestId,
      requestDigest: request.requestDigest,
      actionDigest: request.actionDigest,
      evidenceDigest: request.evidenceDigest,
      decision: 'accepted_for_sentinel_evaluation',
      note: 'Send this exact proposal for independent Sentinel evaluation.',
    },
  }), { AEGIS_JOB_TOKEN: token, DB });
  assert.equal(review.status, 201);
  const body = await review.json();
  assert.equal(body.review.requestDigest, request.requestDigest);
  assert.equal(body.review.actionDigest, request.actionDigest);
  assert.equal(body.review.evidenceDigest, request.evidenceDigest);
  assert.equal(body.review.authority.approvalGranted, false);
  assert.equal(body.review.authority.execution, 'not_authorised');

  const history = await handleRuntimeFetch(runtimeRequest(
    '/v1/agent-operations/reviews?requestId=' + encodeURIComponent(request.requestId),
  ), { AEGIS_JOB_TOKEN: token, DB });
  assert.equal(history.status, 200);
  assert.equal((await history.json()).reviews.length, 1);
});

test('runtime rejects stale review digests and approval-like review decisions', async () => {
  const DB = new OperationsD1();
  const created = await handleRuntimeFetch(runtimeRequest('/v1/agent-operations', {
    method: 'POST', body: { requestId: 'operation-http-0005', definition, run, checkpoint, action },
  }), { AEGIS_JOB_TOKEN: token, DB });
  const request = (await created.json()).request;
  const stale = await handleRuntimeFetch(runtimeRequest('/v1/agent-operations/reviews', {
    method: 'POST',
    body: {
      eventId: 'review-event-http-stale-0005',
      requestId: request.requestId, requestDigest: request.requestDigest,
      actionDigest: 'sha256:' + 'f'.repeat(64), evidenceDigest: request.evidenceDigest,
      decision: 'accepted_for_sentinel_evaluation', note: 'Stale action digest.',
    },
  }), { AEGIS_JOB_TOKEN: token, DB });
  assert.equal(stale.status, 409);
  const approvalLike = await handleRuntimeFetch(runtimeRequest('/v1/agent-operations/reviews', {
    method: 'POST',
    body: {
      eventId: 'review-event-http-invalid-0005',
      requestId: request.requestId, requestDigest: request.requestDigest,
      actionDigest: request.actionDigest, evidenceDigest: request.evidenceDigest,
      decision: 'approved', note: 'Must not become an approval.',
    },
  }), { AEGIS_JOB_TOKEN: token, DB });
  assert.equal(approvalLike.status, 400);
  assert.equal(DB.reviews.size, 0);
});

test('Pages Agent Operations API requires owner auth and same-origin writes', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return new Response(JSON.stringify({ requests: [] })); };
  try {
    const unauthenticated = await agentOperationsApi({
      request: pagesRequest('/api/agent-operations', { method: 'GET', authenticated: false }),
      env: pagesEnv,
    });
    assert.equal(unauthenticated.status, 401);
    const crossOrigin = await agentOperationsApi({
      request: pagesRequest('/api/agent-operations', {
        method: 'POST', origin: 'https://attacker.example',
        body: { requestId: 'operation-http-0006', definition, run, checkpoint, action },
      }),
      env: pagesEnv,
    });
    assert.equal(crossOrigin.status, 403);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Pages review API proxies exact digest-bound review fields without exposing the runtime token', async () => {
  const originalFetch = globalThis.fetch;
  let captured = null;
  globalThis.fetch = async (url, init) => {
    captured = { url: String(url), init };
    return new Response(JSON.stringify({
      review: {
        eventId: 'review-event-0001', requestId: 'operation-http-0007',
        requestDigest: 'sha256:' + 'a'.repeat(64),
        actionDigest: 'sha256:' + 'b'.repeat(64),
        evidenceDigest: 'sha256:' + 'c'.repeat(64),
        decision: 'accepted_for_sentinel_evaluation',
        authority: { approvalGranted: false, execution: 'not_authorised', sentinelApprovalRequired: true },
      },
    }), { status: 201 });
  };
  try {
    const response = await agentOperationReviewsApi({
      request: pagesRequest('/api/agent-operations/reviews', {
        method: 'POST',
        body: {
          eventId: 'review-event-http-0007',
          requestId: 'operation-http-0007',
          requestDigest: 'sha256:' + 'a'.repeat(64),
          actionDigest: 'sha256:' + 'b'.repeat(64),
          evidenceDigest: 'sha256:' + 'c'.repeat(64),
          decision: 'accepted_for_sentinel_evaluation',
          note: 'Forward for independent Sentinel evaluation.',
        },
      }),
      env: pagesEnv,
    });
    assert.equal(response.status, 201);
    assert.equal(captured.url, 'https://runtime.example/v1/agent-operations/reviews');
    assert.equal(captured.init.headers.Authorization, 'Bearer ' + token);
    assert.equal(captured.init.headers['X-Aegis-Principal'], 'owner');
    assert.equal((await response.json()).review.authority.approvalGranted, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
