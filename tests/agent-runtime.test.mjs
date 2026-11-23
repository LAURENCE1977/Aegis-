import test from 'node:test';
import assert from 'node:assert/strict';
import runtime, { handleRuntimeFetch } from '../workers/runtime/index.mjs';

const token = 'agent-runtime-test-token-with-at-least-32-characters';

class AgentMemoryD1 {
  constructor() { this.runs = new Map(); this.events = []; this.failAuditInsert = false; }
  async batch(statements) {
    const db = this;
    const runsSnapshot = new Map([...this.runs].map(([id, row]) => [id, { ...row }]));
    const eventsSnapshot = [...this.events];
    try {
      const results = [];
      for (const statement of statements) {
        if (statement.sql.includes('RETURNING attempts')) {
          const claim = await statement.first();
          db.lastBatchChanges = claim ? 1 : 0;
          results.push({ results: claim ? [claim] : [], meta: { changes: claim ? 1 : 0 } });
        } else {
          const result = await statement.run();
          db.lastBatchChanges = result?.meta?.changes || 0;
          results.push(result);
        }
      }
      return results;
    } catch (error) {
      this.runs = runsSnapshot;
      this.events = eventsSnapshot;
      throw error;
    }
  }
  prepare(sql) {
    const db = this;
    return {
      sql,
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
          if (db.failAuditInsert) throw new Error('agent audit unavailable');
          if (sql.includes('SELECT ?, id, ?, ?, ?')) {
            if (db.failAuditInsert || db.failAuditEventType === v[1]) throw new Error('agent audit unavailable');
            if (db.lastBatchChanges !== 1) return { meta: { changes: 0 } };
            const row = db.runs.get(v[4]);
            if (!row || row.status !== v[5] || row.updated_at !== v[6]) return { meta: { changes: 0 } };
            if (db.events.some(event => event.event_id === v[0])) return { meta: { changes: 0 } };
            db.events.push({ event_id: v[0], agent_run_id: row.id, event_type: v[1], detail_json: v[2], created_at: v[3] });
            return { meta: { changes: 1 } };
          }
          if (sql.includes('SELECT')) {
            if (db.lastBatchChanges !== 1) return { meta: { changes: 0 } };
            const row = db.runs.get(v[2]);
            if (!row || row.status !== 'running' || row.updated_at !== v[3]) return { meta: { changes: 0 } };
            if (db.events.some(event => event.event_id === v[0])) return { meta: { changes: 0 } };
            db.events.push({ event_id: v[0], agent_run_id: row.id, event_type: 'running', detail_json: JSON.stringify({ attempt: row.attempts }), created_at: v[1] });
            return { meta: { changes: 1 } };
          }
          if (db.events.some(event => event.event_id === v[0])) return { meta: { changes: 0 } };
          db.events.push({ event_id: v[0], agent_run_id: v[1], event_type: v[2], detail_json: v[3], created_at: v[4] });
          return { meta: { changes: 1 } };
        }
        if (sql.includes("SET status = 'failed'") && sql.includes('AGENT_PLAN_FAILED')) {
          const row = db.runs.get(v[1]);
          if (row && row.status === 'running' && row.attempts === v[2]) {
            row.status = 'failed'; row.error_code = 'AGENT_PLAN_FAILED'; row.lease_until = null; row.updated_at = v[0];
            return { meta: { changes: 1 } };
          }
          return { meta: { changes: 0 } };
        }
        if (sql.includes("SET status = 'queued'") && sql.includes('AGENT_PLAN_RETRY')) {
          const row = db.runs.get(v[1]);
          if (row && row.status === 'running' && row.attempts === v[2]) {
            row.status = 'queued'; row.error_code = 'AGENT_PLAN_RETRY'; row.lease_until = null; row.updated_at = v[0];
            return { meta: { changes: 1 } };
          }
          return { meta: { changes: 0 } };
        }
        if (sql.includes("SET status = 'failed'") && sql.includes('AGENT_DELIVERY_EXHAUSTED')) {
          const row = db.runs.get(v[1]);
          const now = v[2];
          if (row && (['queued', 'pending_dispatch'].includes(row.status) ||
              (row.status === 'running' && (!row.lease_until || row.lease_until <= now)))) {
            row.status = 'failed'; row.error_code = 'AGENT_DELIVERY_EXHAUSTED';
            row.lease_until = null; row.updated_at = v[0];
            return { meta: { changes: 1 } };
          }
          return { meta: { changes: 0 } };
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
  return { env: { AEGIS_JOB_TOKEN: token, AGENT_RUNS_ENABLED: 'true', DB, JOBS }, DB, sent, failSend() { failNextSend = true; } };
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

test('an agent run claim rolls back when its audit event cannot be persisted', async () => {
  const { env, DB } = makeEnv();
  const response = await handleRuntimeFetch(postRun({ objective: 'Protect audited agent claims' }), env);
  const { run } = await response.json();
  DB.failAuditInsert = true;

  await assert.rejects(() => runtime.queue({
    queue: 'aegis-jobs',
    messages: [{
      body: { agentRunId: run.id },
      ack() { assert.fail('a failed audited claim must not be acknowledged'); },
      retry() {},
    }],
  }, env), /agent audit unavailable/);

  assert.equal(DB.runs.get(run.id).status, 'queued');
  assert.equal(DB.runs.get(run.id).attempts, 0);
  assert.equal(DB.events.some((event) => event.event_type === 'running'), false);
});

test('agent plan completion rolls back when its audit event cannot be persisted', async () => {
  const { env, DB } = makeEnv();
  const response = await handleRuntimeFetch(postRun({ objective: 'Protect audited plan completion' }), env);
  const { run } = await response.json();
  DB.failAuditEventType = 'planned';

  let retried = false;
  await runtime.queue({
    queue: 'aegis-jobs',
    messages: [{
      body: { agentRunId: run.id },
      ack() { assert.fail('a failed audited completion must not be acknowledged'); },
      retry() { retried = true; },
    }],
  }, env);
  assert.equal(retried, true);

  assert.equal(DB.runs.get(run.id).status, 'queued');
  assert.equal(DB.runs.get(run.id).plan_json, undefined);
  assert.equal(DB.events.some((event) => event.event_type === 'planned'), false);
  assert.equal(DB.events.some((event) => event.event_type === 'retry_scheduled'), true);
});

test('queue consumer creates a plan-only result and never invokes tools', async () => {
  const { env, DB } = makeEnv();
  const response = await handleRuntimeFetch(postRun({
    objective: 'Improve the AEGIS runtime',
    specialists: ['reviewer', 'engineer', 'researcher'],
  }), env);
  const { run } = await response.json();
  let acked = false;
  await runtime.queue({ queue: 'aegis-jobs', messages: [{ body: { agentRunId: run.id }, ack() { acked = true; }, retry() { assert.fail('unexpected retry'); } }] }, env);
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
  const scheduledContext = { waitUntil(promise) { this.promise = promise; } };
  runtime.scheduled({}, env, scheduledContext);
  await scheduledContext.promise;
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

test('agent dead-letter marks exhausted runs failed and audits redelivery idempotently', async () => {
  const { env, DB } = makeEnv();
  const response = await handleRuntimeFetch(postRun({ objective: 'Test agent dead-letter' }), env);
  const { run } = await response.json();
  const message = { body: { agentRunId: run.id }, ack() {}, retry() { assert.fail('dead-letter must be acknowledged'); } };
  await runtime.queue({ queue: 'aegis-jobs-dlq', messages: [message] }, env);
  await runtime.queue({ queue: 'aegis-jobs-dlq', messages: [message] }, env);
  assert.equal(DB.runs.get(run.id).status, 'failed');
  assert.equal(DB.runs.get(run.id).error_code, 'AGENT_DELIVERY_EXHAUSTED');
  assert.equal(DB.events.filter(event => event.event_type === 'delivery_exhausted').length, 1);
});

test('agent dead-letter cannot overwrite a completed plan', async () => {
  const { env, DB } = makeEnv();
  const response = await handleRuntimeFetch(postRun({ objective: 'Protect completed plan' }), env);
  const { run } = await response.json();
  await runtime.queue({ queue: 'aegis-jobs', messages: [{
    body: { agentRunId: run.id }, ack() {}, retry() { assert.fail('unexpected retry'); },
  }] }, env);
  await runtime.queue({ queue: 'aegis-jobs-dlq', messages: [{
    body: { agentRunId: run.id }, ack() {}, retry() { assert.fail('unexpected retry'); },
  }] }, env);
  assert.equal(DB.runs.get(run.id).status, 'planned');
  assert.equal(DB.events.filter(event => event.event_type === 'delivery_exhausted').length, 0);
});
