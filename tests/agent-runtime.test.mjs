import test from 'node:test';
import assert from 'node:assert/strict';
import runtime, { handleRuntimeFetch } from '../workers/runtime/index.mjs';

const token = 'agent-runtime-test-token-with-at-least-32-characters';

class AgentMemoryD1 {
  constructor() { this.runs = new Map(); this.events = []; }
  prepare(sql) {
    const db = this;
    return {
      values: [],
      bind(...values) { this.values = values; return this; },
      async first() {
        const v = this.values;
        if (sql.includes('WHERE idempotency_key = ?')) {
          return [...db.runs.values()].find((row) => row.idempotency_key === v[0]) || null;
        }
        if (sql.includes('UPDATE agent_runs SET status = \'running\'')) {
          const row = db.runs.get(v[2]);
          if (!row || !['queued', 'pending_dispatch'].includes(row.status)) return null;
          row.status = 'running'; row.attempts += 1; row.lease_until = v[0]; row.updated_at = v[1];
          return { attempts: row.attempts };
        }
        if (sql.includes('WHERE id = ?')) return db.runs.get(v[0]) || null;
        return null;
      },
      async all() {
        if (sql.includes("FROM agent_runs WHERE status = 'running'")) return { results: [] };
        if (sql.includes("FROM agent_runs WHERE status = 'pending_dispatch'")) {
          return { results: [...db.runs.values()].filter((row) => row.status === 'pending_dispatch').map((row) => ({ id: row.id })) };
        }
        return { results: [] };
      },
      async run() {
        const v = this.values;
        if (sql.includes('INSERT INTO agent_runs')) {
          if (v[3] && [...db.runs.values()].some((row) => row.idempotency_key === v[3])) return { meta: { changes: 0 } };
          db.runs.set(v[0], {
            id: v[0], objective: v[1], specialists_json: v[2], status: 'pending_dispatch',
            attempts: 0, idempotency_key: v[3], created_at: v[4], updated_at: v[5],
          });
          return { meta: { changes: 1 } };
        }
        if (sql.includes('INSERT INTO agent_run_events')) {
          db.events.push({ event_id: v[0], agent_run_id: v[1], event_type: v[2], detail_json: v[3], created_at: v[4] });
          return { meta: { changes: 1 } };
        }
        if (sql.includes("SET status = 'queued'")) {
          const row = db.runs.get(v[1]);
          if (row && row.status === 'pending_dispatch') { row.status = 'queued'; row.updated_at = v[0]; return { meta: { changes: 1 } }; }
          return { meta: { changes: 0 } };
        }
        if (sql.includes("SET status = 'planned'")) {
          const row = db.runs.get(v[2]);
          if (row && row.status === 'running' && row.attempts === v[3]) {
            row.status = 'planned'; row.plan_json = v[0]; row.updated_at = v[1]; row.lease_until = null;
            return { meta: { changes: 1 } };
          }
          return { meta: { changes: 0 } };
        }
        if (sql.includes("SET status = 'pending_dispatch'")) {
          const row = db.runs.get(v[1]);
          if (row && row.status === 'running') { row.status = 'pending_dispatch'; row.lease_until = null; return { meta: { changes: 1 } }; }
        }
        return { meta: { changes: 0 } };
      },
    };
  }
}

function makeEnv() {
  const DB = new AgentMemoryD1();
  const sent = [];
  let failNextSend = false;
  const JOBS = { async send(message) { if (failNextSend) { failNextSend = false; throw new Error('queue unavailable'); } sent.push(message); } };
  return { env: { AEGIS_JOB_TOKEN: token, DB, JOBS }, DB, sent, failSend() { failNextSend = true; } };
}

function postRun(body, headers = {}) {
  return new Request('https://runtime.example/v1/agent-runs', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

test('persists a bounded agent run before queue dispatch and returns its durable ID', async () => {
  const { env, DB, sent } = makeEnv();
  const response = await handleRuntimeFetch(postRun({ objective: 'Review the runtime' }), env);
  assert.equal(response.status, 201);
  const { run } = await response.json();
  assert.equal(run.status, 'queued');
  assert.deepEqual(run.specialists, ['researcher', 'engineer', 'reviewer']);
  assert.ok(DB.runs.has(run.id));
  assert.deepEqual(sent, [{ agentRunId: run.id }]);
  assert.ok(DB.events.some((event) => event.event_type === 'queued'));
});

test('idempotency keys prevent duplicate durable agent runs and queue messages', async () => {
  const { env, DB, sent } = makeEnv();
  const headers = { 'Idempotency-Key': 'agent-request-0001' };
  const first = await handleRuntimeFetch(postRun({ objective: 'Review runtime' }, headers), env);
  const second = await handleRuntimeFetch(postRun({ objective: 'Review runtime' }, headers), env);
  assert.equal((await first.json()).run.id, (await second.json()).run.id);
  assert.equal(DB.runs.size, 1);
  assert.equal(sent.length, 1);
});

test('rejects unknown fields and unsafe specialist roles before persistence', async () => {
  const { env, DB } = makeEnv();
  const response = await handleRuntimeFetch(postRun({ objective: 'Review runtime', tools: ['shell.exec'] }), env);
  assert.equal(response.status, 400);
  assert.equal(DB.runs.size, 0);
  const second = await handleRuntimeFetch(postRun({ objective: 'Review runtime', specialists: ['shell'] }), env);
  assert.equal(second.status, 400);
});

test('queue consumer creates a plan-only result and never invokes tools', async () => {
  const { env, DB } = makeEnv();
  const response = await handleRuntimeFetch(postRun({
    objective: 'Improve the AEGIS runtime',
    specialists: ['reviewer', 'engineer', 'researcher'],
  }), env);
  const { run } = await response.json();
  let acked = false;
  await runtime.queue({ messages: [{ body: { agentRunId: run.id }, ack() { acked = true; }, retry() { assert.fail('unexpected retry'); } }] }, env);
  const saved = DB.runs.get(run.id);
  const plan = JSON.parse(saved.plan_json);
  assert.equal(saved.status, 'planned');
  assert.equal(plan.execution, 'plan-only');
  assert.equal(plan.safety.toolsInvoked, false);
  assert.deepEqual(plan.steps.map((step) => step.specialist), ['researcher', 'engineer', 'reviewer']);
  assert.ok(plan.steps.every((step) => step.tools.length === 0));
  assert.equal(acked, true);
  assert.ok(DB.events.some((event) => event.event_type === 'planned'));
});

test('status endpoint returns the durable plan without exposing internal storage fields', async () => {
  const { env } = makeEnv();
  const response = await handleRuntimeFetch(postRun({ objective: 'Review the runtime' }), env);
  const { run } = await response.json();
  const status = await handleRuntimeFetch(new Request('https://runtime.example/v1/agent-runs/' + run.id, {
    headers: { Authorization: 'Bearer ' + token },
  }), env);
  assert.equal(status.status, 200);
  const body = await status.json();
  assert.equal(body.run.id, run.id);
  assert.equal('specialists_json' in body.run, false);
});

test('outbox recovery re-dispatches a run when the initial queue send fails', async () => {
  const { env, DB, sent, failSend } = makeEnv();
  failSend();
  const response = await handleRuntimeFetch(postRun({ objective: 'Recover a pending run' }), env);
  assert.equal(response.status, 202);
  const { run } = await response.json();
  assert.equal(run.status, 'pending_dispatch');
  const scheduledContext = { waitUntil(promise) { this.promise = promise; } };\n  runtime.scheduled({}, env, scheduledContext);\n  await scheduledContext.promise;
  const saved = DB.runs.get(run.id);
  assert.equal(saved.status, 'queued');
  assert.deepEqual(sent, [{ agentRunId: run.id }]);
});


test('accepts JSON requests with a charset parameter and exposes the run status route', async () => {
  const { env } = makeEnv();
  const request = postRun({ objective: 'Review the runtime' }, {
    'Content-Type': 'application/json; charset=utf-8',
  });
  const response = await handleRuntimeFetch(request, env);
  assert.equal(response.status, 201);
  const { run } = await response.json();
  const status = await handleRuntimeFetch(new Request(
    'https://runtime.example/v1/agent-runs/' + run.id,
    { headers: { Authorization: 'Bearer ' + token } },
  ), env);
  assert.equal(status.status, 200);
  assert.equal((await status.json()).run.id, run.id);
});
