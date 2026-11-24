import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRuntimeFetch } from '../workers/runtime/index.mjs';

const token = 'agent-runtime-test-token-with-at-least-32-characters';
const runId = '123e4567-e89b-42d3-a456-426614174000';
const principalId = 'owner';

class ProposalD1 {
  constructor(status = 'planned') {
    this.run = { id: runId, status };
    this.proposals = new Map();
    this.events = [];
  }
  prepare(sql) {
    const db = this;
    return {
      values: [],
      bind(...values) { this.values = values; return this; },
      async first() {
        const v = this.values;
        if (sql.includes('SELECT id, status FROM agent_runs') || sql.includes('SELECT id FROM agent_runs')) return db.run?.id === v[0] ? db.run : null;
        if (sql.includes('SELECT * FROM agent_capability_proposals WHERE agent_run_id')) {
          return [...db.proposals.values()].find((row) =>
            row.agent_run_id === v[0] && row.capability_id === v[1] &&
            row.action_id === v[2] && row.resource_id === v[3] && row.input_digest === v[4]) || null;
        }
        return null;
      },
      async all() {
        if (sql.includes('FROM agent_capability_proposals')) {
          return { results: [...db.proposals.values()].filter((row) => row.agent_run_id === this.values[0]) };
        }
        return { results: [] };
      },
      async run() {
        if (sql.includes('INSERT INTO agent_run_events')) {
          const v = this.values;
          db.events.push({ event_id: v[0], agent_run_id: v[1], event_type: 'capability_proposal_created', detail: { capabilityId: v[2], actionId: v[3], inputDigest: v[4] }, created_at: v[5] });
          return { meta: { changes: 1 } };
        }
        if (!sql.includes('INSERT INTO agent_capability_proposals')) return { meta: { changes: 1 } };
        const v = this.values;
        const existing = [...db.proposals.values()].find((row) =>
          row.agent_run_id === v[1] && row.capability_id === v[3] &&
          row.action_id === v[5] && row.resource_id === v[6] && row.input_digest === v[7]);
        if (existing) return { meta: { changes: 0 } };
        const row = {
          proposal_id: v[0], agent_run_id: v[1], principal_id: v[2], capability_id: v[3],
          capability_version: v[4], action_id: v[5], resource_id: v[6], input_digest: v[7],
          required_scopes_json: v[8], effect: v[9], risk: v[10], approval: v[11],
          status: 'proposed', execution: 'disabled', created_at: v[12],
        };
        db.proposals.set(row.proposal_id, row);
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

function env(status = 'planned', overrides = {}) {
  return {
    AEGIS_JOB_TOKEN: token,
    AEGIS_PRINCIPAL_ID: principalId,
    AGENT_RUNS_ENABLED: 'true',
    DB: new ProposalD1(status),
    JOBS: { async send() {} },
    ...overrides,
  };
}

function request(method, body) {
  return new Request(`https://runtime.example/v1/agent-runs/${runId}/capability-proposals`, {
    method,
    headers: {
      Authorization: 'Bearer ' + token,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

const proposalInput = {
  capabilityId: 'aegis-github-public-discovery',
  actionId: 'discover',
  resourceId: 'github:public:LAURENCE1977/Aegis-',
  input: { repository: 'LAURENCE1977/Aegis-' },
};

test('persists a metadata-only proposal for a completed agent plan', async () => {
  const runtimeEnv = env();
  const response = await handleRuntimeFetch(request('POST', proposalInput), runtimeEnv);
  assert.equal(response.status, 201);
  const { proposal } = await response.json();
  assert.equal(proposal.runId, runId);
  assert.equal(proposal.principalId, principalId);
  assert.equal(proposal.status, 'proposed');
  assert.equal(proposal.execution, 'disabled');
  assert.equal(proposal.effect, 'read');
  assert.match(proposal.inputDigest, /^sha256:[a-f0-9]{64}$/);
  assert.equal('input' in proposal, false);
  assert.equal(runtimeEnv.DB.proposals.size, 1);
  assert.equal(runtimeEnv.DB.events.length, 1);
  assert.equal(runtimeEnv.DB.events[0].event_type, 'capability_proposal_created');
});

test('returns the existing proposal for an identical retry', async () => {
  const runtimeEnv = env();
  const first = await handleRuntimeFetch(request('POST', proposalInput), runtimeEnv);
  const second = await handleRuntimeFetch(request('POST', proposalInput), runtimeEnv);
  assert.equal(first.status, 201);
  assert.equal(second.status, 200);
  assert.equal(runtimeEnv.DB.proposals.size, 1);
});

test('rejects proposal creation until the durable run has a completed plan', async () => {
  const response = await handleRuntimeFetch(request('POST', proposalInput), env('queued'));
  assert.equal(response.status, 409);
});

test('fails closed when the trusted principal binding is missing', async () => {
  const response = await handleRuntimeFetch(
    request('POST', proposalInput),
    env('planned', { AEGIS_PRINCIPAL_ID: undefined }),
  );
  assert.equal(response.status, 503);
});

test('rejects unknown capabilities and caller-supplied authority fields', async () => {
  const runtimeEnv = env();
  const unknown = await handleRuntimeFetch(request('POST', { ...proposalInput, capabilityId: 'unknown' }), runtimeEnv);
  assert.equal(unknown.status, 400);
  const injected = await handleRuntimeFetch(request('POST', { ...proposalInput, principalId: 'attacker' }), runtimeEnv);
  assert.equal(injected.status, 400);
  assert.equal(runtimeEnv.DB.proposals.size, 0);
});

test('lists only persisted metadata proposals for the requested run', async () => {
  const runtimeEnv = env();
  await handleRuntimeFetch(request('POST', proposalInput), runtimeEnv);
  const response = await handleRuntimeFetch(request('GET'), runtimeEnv);
  assert.equal(response.status, 200);
  const { proposals } = await response.json();
  assert.equal(proposals.length, 1);
  assert.equal(proposals[0].execution, 'disabled');
  assert.equal('input' in proposals[0], false);
});
