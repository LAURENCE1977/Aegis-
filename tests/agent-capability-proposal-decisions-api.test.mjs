import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRuntimeFetch } from '../workers/runtime/index.mjs';

const token = 'agent-runtime-test-token-with-at-least-32-characters';
const runId = '123e4567-e89b-42d3-a456-426614174000';
const proposalId = '223e4567-e89b-42d3-a456-426614174000';
const principalId = 'owner';

class DecisionD1 {
  constructor() {
    this.run = { id: runId, status: 'planned' };
    this.proposal = {
      proposal_id: proposalId, agent_run_id: runId, principal_id: principalId,
      status: 'proposed', execution: 'disabled',
    };
    this.decisions = new Map();
    this.events = [];
  }
  prepare(sql) {
    const db = this;
    return {
      values: [],
      bind(...values) { this.values = values; return this; },
      async first() {
        const v = this.values;
        if (sql.includes('SELECT id FROM agent_runs')) return db.run?.id === v[0] ? db.run : null;
        if (sql.includes('FROM agent_capability_proposals') && sql.includes('proposal_id = ?')) {
          return db.proposal?.proposal_id === v[0] && db.proposal.agent_run_id === v[1]
            ? db.proposal : null;
        }
        if (sql.includes('SELECT * FROM agent_capability_proposal_decisions')) {
          return db.decisions.get(v[0]) || null;
        }
        return null;
      },
      async run() {
        const v = this.values;
        if (sql.includes('INSERT INTO agent_capability_proposal_decisions')) {
          if (db.decisions.has(v[1])) return { meta: { changes: 0 } };
          const row = { decision_id: v[0], proposal_id: v[1], principal_id: v[2],
            decision: v[3], reason: v[4], created_at: v[5] };
          db.decisions.set(v[1], row);
          return { meta: { changes: 1 } };
        }
        if (sql.includes('INSERT INTO agent_run_events')) {
          db.events.push({ event_type: v[2] });
          return { meta: { changes: 1 } };
        }
        return { meta: { changes: 1 } };
      },
    };
  }
  async batch(statements) {
    const results = [];
    for (const statement of statements) results.push(await statement.run());
    return results;
  }
}

function makeEnv(overrides = {}) {
  return {
    AEGIS_JOB_TOKEN: token,
    AEGIS_PRINCIPAL_ID: principalId,
    AGENT_RUNS_ENABLED: 'true',
    DB: new DecisionD1(),
    JOBS: { async send() {} },
    ...overrides,
  };
}

function decisionRequest(decision, reason = 'Reviewed by owner') {
  return new Request(`https://runtime.example/v1/agent-runs/${runId}/capability-proposals/${proposalId}/decision`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision, reason }),
  });
}

test('records an owner approval without enabling proposal execution', async () => {
  const runtimeEnv = makeEnv();
  const response = await handleRuntimeFetch(decisionRequest('approved'), runtimeEnv);
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.decision.decision, 'approved');
  assert.equal(body.decision.principalId, principalId);
  assert.equal(body.execution, 'disabled');
  assert.equal(runtimeEnv.DB.decisions.size, 1);
  assert.equal(runtimeEnv.DB.events.length, 1);
});

test('records a rejection as an immutable decision', async () => {
  const runtimeEnv = makeEnv();
  const response = await handleRuntimeFetch(decisionRequest('rejected', 'Outside approved scope'), runtimeEnv);
  assert.equal(response.status, 201);
  assert.equal((await response.json()).decision.decision, 'rejected');
});

test('does not allow a second decision for the same proposal', async () => {
  const runtimeEnv = makeEnv();
  assert.equal((await handleRuntimeFetch(decisionRequest('approved'), runtimeEnv)).status, 201);
  assert.equal((await handleRuntimeFetch(decisionRequest('rejected'), runtimeEnv)).status, 409);
  assert.equal(runtimeEnv.DB.decisions.size, 1);
});

test('rejects invalid decisions, caller authority fields and missing principal context', async () => {
  const runtimeEnv = makeEnv();
  assert.equal((await handleRuntimeFetch(decisionRequest('execute'), runtimeEnv)).status, 400);
  const injected = decisionRequest('approved');
  const body = { decision: 'approved', principalId: 'attacker' };
  const request = new Request(injected.url, { method: 'POST', headers: injected.headers, body: JSON.stringify(body) });
  assert.equal((await handleRuntimeFetch(request, runtimeEnv)).status, 400);
  assert.equal((await handleRuntimeFetch(decisionRequest('approved'), makeEnv({ AEGIS_PRINCIPAL_ID: undefined }))).status, 503);
});

test('rejects decisions for proposals outside the requested run', async () => {
  const runtimeEnv = makeEnv();
  const request = new Request(`https://runtime.example/v1/agent-runs/${runId}/capability-proposals/323e4567-e89b-42d3-a456-426614174000/decision`, {
    method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision: 'approved' }),
  });
  assert.equal((await handleRuntimeFetch(request, runtimeEnv)).status, 404);
});
