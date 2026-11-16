import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken } from '../functions/lib/auth.mjs';
import {
  createAgentRunApprovalHandlers,
  createAgentRunApprovalDecisionHandlers,
} from '../functions/lib/agent-run-approval-routes.mjs';

const secret = 'agent-run-approval-test-session-secret-with-entropy';
const envBase = {
  AEGIS_PASSWORD: 'test-password-long-enough',
  AEGIS_SESSION_SECRET: secret,
  AEGIS_DB: { prepare() { throw new Error('Unexpected database access'); } },
};
const runId = '00000000-0000-4000-8000-000000000001';
const plan = {
  runId,
  objective: 'Review the AEGIS runtime',
  execution: 'plan-only',
  requiresHumanApprovalBeforeExecution: true,
  steps: [{ id: 'step-1', specialist: 'reviewer', status: 'planned', tools: [], output: null }],
  safety: {
    toolsInvoked: false,
    externalEffects: false,
    sentinelRequiredForExecution: true,
    approvalRequiredForProtectedActions: true,
  },
};

async function makeRequest(path, method, body, { authenticated = true, origin = 'https://aegis.example' } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (authenticated) headers.Cookie = '__Host-aegis_session=' + await createSessionToken(secret);
  if (origin !== null) headers.Origin = origin;
  return new Request('https://aegis.example' + path, {
    method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

test('agent approval request requires an authenticated same-origin owner', async () => {
  const handler = createAgentRunApprovalHandlers();
  const unauthenticated = await handler.onRequestPost({
    request: await makeRequest('/api/sentinel/agent-run-approval', 'POST', { runId }, { authenticated: false }),
    env: envBase,
  });
  assert.equal(unauthenticated.status, 401);

  const crossOrigin = await handler.onRequestPost({
    request: await makeRequest('/api/sentinel/agent-run-approval', 'POST', { runId }, { origin: 'https://attacker.example' }),
    env: envBase,
  });
  assert.equal(crossOrigin.status, 403);
});

test('agent approval request is bound to the exact completed plan, not a caller-supplied digest', async () => {
  let saved;
  const handler = createAgentRunApprovalHandlers({
    proxy: async ({ method, path }) => {
      assert.equal(method, 'GET');
      assert.equal(path, '/v1/agent-runs/' + runId);
      return Response.json({ run: { id: runId, status: 'planned', plan } });
    },
    createRequest: async (_db, binding) => {
      saved = binding;
      return { id: 'approval-1', ...binding, status: 'pending' };
    },
  });
  const response = await handler.onRequestPost({
    request: await makeRequest('/api/sentinel/agent-run-approval', 'POST', { runId }),
    env: envBase,
  });
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.approval.status, 'pending');
  assert.equal(saved.principalId, 'owner');
  assert.equal(saved.capabilityId, 'aegis-agent-run');
  assert.equal(saved.actionId, 'approve-execution');
  assert.equal(saved.resourceId, 'agent-run:' + runId);
  assert.match(saved.inputDigest, /^sha256:[a-f0-9]{64}$/);
});

test('agent approval request rejects runs that are not in planned state', async () => {
  const handler = createAgentRunApprovalHandlers({
    proxy: async () => Response.json({ run: { id: runId, status: 'queued', plan: null } }),
    createRequest: async () => assert.fail('must not create approval'),
  });
  const response = await handler.onRequestPost({
    request: await makeRequest('/api/sentinel/agent-run-approval', 'POST', { runId }),
    env: envBase,
  });
  assert.equal(response.status, 409);
});

test('agent approval request rejects extra fields and malformed run identifiers', async () => {
  const handler = createAgentRunApprovalHandlers({
    proxy: async () => assert.fail('must not load a run'),
  });
  for (const body of [{ runId, digest: 'caller-controlled' }, { runId: '../other' }]) {
    const response = await handler.onRequestPost({
      request: await makeRequest('/api/sentinel/agent-run-approval', 'POST', body),
      env: envBase,
    });
    assert.equal(response.status, 400);
  }
});

test('owner decision endpoint records only explicit approve or deny decisions', async () => {
  let decision;
  const handler = createAgentRunApprovalDecisionHandlers({
    decideRequest: async (_db, input) => {
      decision = input;
      return {
        id: input.id, principalId: 'owner', capabilityId: 'aegis-agent-run',
        status: input.decision, decidedBy: input.decidedBy,
      };
    },
  });
  const response = await handler.onRequestPatch({
    request: await makeRequest('/api/sentinel/agent-run-approval/approval-1', 'PATCH', { decision: 'approved' }),
    env: envBase,
    params: { id: 'approval-1' },
  });
  assert.equal(response.status, 200);
  assert.equal(decision.id, 'approval-1');
  assert.equal(decision.decision, 'approved');
  assert.equal(decision.decidedBy, 'owner');
  assert.equal(decision.principalId, 'owner');
  assert.equal(decision.capabilityId, 'aegis-agent-run');
});

test('owner decision endpoint rejects an approval belonging to another principal or capability', async () => {
  const handler = createAgentRunApprovalDecisionHandlers({
    decideRequest: async () => ({ id: 'approval-1', principalId: 'other', capabilityId: 'other-capability' }),
  });
  const response = await handler.onRequestPatch({
    request: await makeRequest('/api/sentinel/agent-run-approval/approval-1', 'PATCH', { decision: 'approved' }),
    env: envBase,
    params: { id: 'approval-1' },
  });
  assert.equal(response.status, 404);
});
