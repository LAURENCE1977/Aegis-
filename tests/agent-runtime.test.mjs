import test from 'node:test';
import assert from 'node:assert/strict';
import runtime, { handleRuntimeFetch } from '../workers/runtime/index.mjs';

const token = 'agent-runtime-test-token-with-at-least-32-characters';

class AgentMemoryD1 {
  constructor() { this.runs = new Map(); this.events = []; this.steps = new Map(); this.stepEvents = []; }
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
        if (sql.includes('UPDATE agent_runs') && sql.includes('SET authorization_approval_id = COALESCE')) {
          const row = db.runs.get(this.values[4]);
          if (!row || row.status !== 'planned' || row.cancelled_at ||
              (row.authorization_approval_id && row.authorization_approval_id !== this.values[5]) ||
              (row.authorization_grant_id && row.authorization_grant_id !== this.values[6])) return null;
          row.authorization_approval_id ||= this.values[0];
          row.execution_authorized_at ||= this.values[1];
          row.authorization_grant_id ||= this.values[2];
          row.updated_at = this.values[3];
          return row;
        }
        if (sql.includes('UPDATE agent_runs SET status = \'running\'')) {
          const row = db.runs.get(v[2]);
          if (!row || !['queued', 'pending_dispatch'].includes(row.status)) return null;
          row.status = 'running'; row.attempts += 1; row.lease_until = v[0]; row.updated_at = v[1];
          if (db.afterClaim) db.afterClaim(row);
          return { attempts: row.attempts };
        }
        if (sql.includes('WHERE id = ?')) return db.runs.get(v[0]) || null;
        return null;
      },
      async all() {
        if (sql.includes('FROM agent_run_steps WHERE agent_run_id = ? ORDER BY step_index')) {
          const rows = [...db.steps.values()]
            .filter((step) => step.agent_run_id === this.values[0])
            .sort((a, b) => a.step_index - b.step_index);
          return { results: rows };
        }
        if (sql.includes('FROM agent_run_events WHERE agent_run_id = ? AND (created_at < ?')) {
          const rows = db.events
            .filter((event) => event.agent_run_id === this.values[0] &&
              (event.created_at < this.values[1] ||
                (event.created_at === this.values[2] && event.event_id < this.values[3])))
            .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.event_id.localeCompare(a.event_id))
            .slice(0, this.values[4]);
          return { results: rows };
        }
        if (sql.includes('FROM agent_run_events WHERE agent_run_id = ? ORDER BY')) {
          const rows = db.events
            .filter((event) => event.agent_run_id === this.values[0])
            .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.event_id.localeCompare(a.event_id))
            .slice(0, this.values[1]);
          return { results: rows };
        }
        if (sql.includes('FROM agent_runs WHERE created_at < ?')) {
          const rows = [...db.runs.values()]
            .filter((row) => row.created_at < this.values[0] ||
              (row.created_at === this.values[1] && row.id < this.values[2]))
            .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))
            .slice(0, this.values[3]);
          return { results: rows };
        }
        if (sql.includes('FROM agent_runs ORDER BY created_at DESC')) {
          const rows = [...db.runs.values()]
            .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))
            .slice(0, this.values[0]);
          return { results: rows };
        }
        if (sql.includes("FROM agent_runs WHERE status = 'running'")) return { results: [] };
        if (sql.includes("FROM agent_runs WHERE status = 'pending_dispatch'")) {
          return { results: [...db.runs.values()].filter((row) => row.status === 'pending_dispatch' && !row.cancelled_at).map((row) => ({ id: row.id })) };
        }
        return { results: [] };
      },
      async run() {
        const v = this.values;
        if (sql.includes('INSERT INTO agent_runs')) {
          if (v[3] && [...db.runs.values()].some((row) => row.idempotency_key === v[3])) return { meta: { changes: 0 } };
          db.runs.set(v[0], {
            id: v[0], objective: v[1], specialists_json: v[2], status: 'pending_dispatch',
            attempts: 0, idempotency_key: v[3], created_at: v[4], updated_at: v[5], cancelled_at: null,
          });
          return { meta: { changes: 1 } };
        }
        if (sql.includes('UPDATE agent_runs SET cancelled_at')) {
          const row = db.runs.get(v[2]);
          if (!row || row.cancelled_at || !['pending_dispatch', 'queued', 'running', 'planned'].includes(row.status)) {
            return { meta: { changes: 0 } };
          }
          row.cancelled_at = v[0]; row.lease_until = null; row.updated_at = v[1];
          return { meta: { changes: 1 } };
        }
        if (sql.includes("UPDATE agent_run_steps SET status = 'cancelled'")) {
          const [updatedAt, runId, parentId, cancelledAt] = v;
          const parent = db.runs.get(parentId);
          if (!parent || parent.cancelled_at !== cancelledAt) return { meta: { changes: 0 } };
          let changes = 0;
          for (const step of db.steps.values()) {
            if (step.agent_run_id === runId &&
                ['planned', 'pending_dispatch', 'queued', 'running'].includes(step.status)) {
              step.status = 'cancelled';
              step.lease_until = null;
              step.updated_at = updatedAt;
              changes += 1;
            }
          }
          return { meta: { changes } };
        }
        if (sql.includes('INSERT INTO agent_run_steps')) {
          const [stepId, stepIndex, specialist, stepJson, createdAt, updatedAt, runId, attempt, planJson] = v;
          const run = db.runs.get(runId);
          if (!run || run.status !== 'planned' || run.attempts !== attempt ||
              run.cancelled_at || run.plan_json !== planJson || db.steps.has(stepId)) {
            return { meta: { changes: 0 } };
          }
          db.steps.set(stepId, {
            id: stepId, agent_run_id: runId, step_index: stepIndex, specialist,
            status: 'planned', attempts: 0, step_json: stepJson, checkpoint_json: '{}',
            created_at: createdAt, updated_at: updatedAt,
          });
          return { meta: { changes: 1 } };
        }
        if (sql.includes('INSERT INTO agent_run_step_events') && sql.includes("SELECT 'cancelled:' || id")) {
          const [createdAt, runId, parentId, cancelledAt] = v;
          const parent = db.runs.get(parentId);
          if (!parent || parent.cancelled_at !== cancelledAt) return { meta: { changes: 0 } };
          let changes = 0;
          for (const step of db.steps.values()) {
            if (step.agent_run_id !== runId || step.status !== 'cancelled') continue;
            const eventId = 'cancelled:' + step.id;
            if (db.stepEvents.some((event) => event.event_id === eventId)) continue;
            db.stepEvents.push({
              event_id: eventId, agent_run_step_id: step.id, agent_run_id: runId,
              event_type: 'cancelled', detail_json: '{}', created_at: createdAt,
            });
            changes += 1;
          }
          return { meta: { changes } };
        }
        if (sql.includes('INSERT INTO agent_run_step_events')) {
          const [eventId, detailJson, createdAt, stepId, runId] = v;
          const step = db.steps.get(stepId);
          if (!step || step.agent_run_id !== runId ||
              db.stepEvents.some(event => event.event_id === eventId)) {
            return { meta: { changes: 0 } };
          }
          db.stepEvents.push({
            event_id: eventId, agent_run_step_id: stepId, agent_run_id: runId,
            event_type: 'planned', detail_json: detailJson, created_at: createdAt,
          });
          return { meta: { changes: 1 } };
        }
        if (sql.includes('INSERT INTO agent_run_events') && sql.includes('SELECT ?, id')) {
          const [eventId, createdAt, runId] = v;
          if (!db.runs.has(runId) || db.events.some(event => event.event_id === eventId)) {
            return { meta: { changes: 0 } };
          }
          db.events.push({
            event_id: eventId, agent_run_id: runId, event_type: 'created',
            detail_json: '{}', created_at: createdAt,
          });
          return { meta: { changes: 1 } };
        }
        if (sql.includes('INSERT INTO agent_run_events')) {
          if (db.events.some(event => event.event_id === v[0])) return { meta: { changes: 0 } };
          db.events.push({ event_id: v[0], agent_run_id: v[1], event_type: v[2], detail_json: v[3], created_at: v[4] });
          return { meta: { changes: 1 } };
        }
        if (sql.includes("SET status = 'failed'") && sql.includes('AGENT_DELIVERY_EXHAUSTED')) {
          const row = db.runs.get(v[1]);
          const now = v[2];
          if (row && !row.cancelled_at && (['queued', 'pending_dispatch'].includes(row.status) ||
              (row.status === 'running' && (!row.lease_until || row.lease_until <= now)))) {
            row.status = 'failed'; row.error_code = 'AGENT_DELIVERY_EXHAUSTED';
            row.lease_until = null; row.updated_at = v[0];
            return { meta: { changes: 1 } };
          }
          return { meta: { changes: 0 } };
        }
        if (sql.includes("SET status = 'queued'")) {
          const row = db.runs.get(v[1]);
          if (row && row.status === 'pending_dispatch' && !row.cancelled_at) { row.status = 'queued'; row.updated_at = v[0]; return { meta: { changes: 1 } }; }
          return { meta: { changes: 0 } };
        }
        if (sql.includes("SET status = 'planned'")) {
          const row = db.runs.get(v[2]);
          if (row && row.status === 'running' && row.attempts === v[3] && !row.cancelled_at) {
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

  async batch(statements) {
    const results = [];
    for (const statement of statements) results.push(await statement.run());
    return results;
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
  assert.ok(DB.events.some((event) => event.agent_run_id === run.id && event.event_type === 'created'));
  assert.deepEqual(sent, [{ agentRunId: run.id }]);
  assert.ok(DB.events.some((event) => event.event_type === 'queued'));
});

test('idempotency keys prevent duplicate durable agent runs and queue messages', async () => {
  const { env, DB, sent } = makeEnv();
  const headers = { 'Idempotency-Key': 'agent-request-0001' };
  const first = await handleRuntimeFetch(postRun({ objective: 'Review runtime' }, headers), env);
  const second = await handleRuntimeFetch(postRun({ objective: 'Review runtime' }, headers), env);
  const firstRun = (await first.json()).run;
  const secondRun = (await second.json()).run;
  assert.equal(firstRun.id, secondRun.id);
  assert.equal(DB.runs.size, 1);
  assert.equal(DB.events.filter((event) =>
    event.agent_run_id === firstRun.id && event.event_type === 'created').length, 1);
  assert.equal(sent.length, 1);
});

test('rejects reuse of an idempotency key with a different objective or specialist selection', async () => {
  const { env, DB, sent } = makeEnv();
  const headers = { 'Idempotency-Key': 'agent-request-0002' };
  const first = await handleRuntimeFetch(postRun({
    objective: 'Review runtime',
    specialists: ['researcher', 'reviewer'],
  }, headers), env);
  assert.equal(first.status, 201);

  const changedObjective = await handleRuntimeFetch(postRun({
    objective: 'Delete production data',
    specialists: ['researcher', 'reviewer'],
  }, headers), env);
  assert.equal(changedObjective.status, 409);
  assert.deepEqual(await changedObjective.json(), {
    error: 'Idempotency-Key was already used for a different agent run request.',
  });

  const changedSpecialists = await handleRuntimeFetch(postRun({
    objective: 'Review runtime',
    specialists: ['security'],
  }, headers), env);
  assert.equal(changedSpecialists.status, 409);
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
  await runtime.queue({ queue: 'aegis-jobs', messages: [{ body: { agentRunId: run.id }, ack() { acked = true; }, retry() { assert.fail('unexpected retry'); } }] }, env);
  const saved = DB.runs.get(run.id);
  const plan = JSON.parse(saved.plan_json);
  assert.equal(saved.status, 'planned');
  assert.equal(plan.execution, 'plan-only');
  assert.equal(plan.safety.toolsInvoked, false);
  assert.deepEqual(plan.steps.map((step) => step.specialist), ['researcher', 'engineer', 'reviewer']);
  assert.ok(plan.steps.every((step) => step.tools.length === 0));
  const persistedSteps = [...DB.steps.values()].sort((a, b) => a.step_index - b.step_index);
  assert.equal(persistedSteps.length, 3);
  assert.deepEqual(persistedSteps.map((step) => step.specialist), ['researcher', 'engineer', 'reviewer']);
  assert.ok(persistedSteps.every((step) => step.status === 'planned' && step.attempts === 0));
  assert.equal(DB.stepEvents.filter((event) => event.event_type === 'planned').length, 3);
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


test('owner can cancel a queued agent run and the cancellation is recorded durably', async () => {
  const { env, DB } = makeEnv();
  const submitted = await handleRuntimeFetch(postRun({ objective: 'Cancel before planning' }), env);
  const { run } = await submitted.json();
  const response = await handleRuntimeFetch(new Request(
    'https://runtime.example/v1/agent-runs/' + run.id + '/cancel',
    { method: 'POST', headers: { Authorization: 'Bearer ' + token } },
  ), env);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.run.id, run.id);
  assert.equal(body.run.status, 'cancelled');
  assert.ok(body.run.cancelledAt);
  assert.ok(DB.events.some((event) =>
    event.agent_run_id === run.id && event.event_type === 'cancelled'));
});


test('repeated cancellation is idempotent and a cancelled queue delivery is acknowledged without planning', async () => {
  const { env, DB } = makeEnv();
  const submitted = await handleRuntimeFetch(postRun({ objective: 'Cancel before planning' }), env);
  const { run } = await submitted.json();
  const cancelRequest = () => new Request(
    'https://runtime.example/v1/agent-runs/' + run.id + '/cancel',
    { method: 'POST', headers: { Authorization: 'Bearer ' + token } },
  );
  const first = await handleRuntimeFetch(cancelRequest(), env);
  const second = await handleRuntimeFetch(cancelRequest(), env);
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(DB.events.filter((event) =>
    event.agent_run_id === run.id && event.event_type === 'cancelled').length, 1);

  let acked = false;
  await runtime.queue({
    queue: 'aegis-jobs',
    messages: [{
      body: { agentRunId: run.id },
      ack() { acked = true; },
      retry() { assert.fail('cancelled run must not be retried'); },
    }],
  }, env);
  assert.equal(acked, true);
  assert.equal(DB.runs.get(run.id).status, 'queued');
  assert.equal(DB.runs.get(run.id).plan_json, undefined);
});

test('cannot cancel a failed agent run', async () => {
  const { env, DB } = makeEnv();
  const submitted = await handleRuntimeFetch(postRun({ objective: 'Already failed' }), env);
  const { run } = await submitted.json();
  DB.runs.get(run.id).status = 'failed';
  const response = await handleRuntimeFetch(new Request(
    'https://runtime.example/v1/agent-runs/' + run.id + '/cancel',
    { method: 'POST', headers: { Authorization: 'Bearer ' + token } },
  ), env);
  assert.equal(response.status, 409);
  assert.equal(DB.runs.get(run.id).cancelled_at, null);
});


test('cancellation racing with an active plan claim fences the worker result', async () => {
  const { env, DB } = makeEnv();
  const submitted = await handleRuntimeFetch(postRun({ objective: 'Cancel during planning' }), env);
  const { run } = await submitted.json();
  DB.afterClaim = (row) => {
    row.cancelled_at = new Date().toISOString();
    row.lease_until = null;
  };
  let acked = false;
  await runtime.queue({
    queue: 'aegis-jobs',
    messages: [{
      body: { agentRunId: run.id },
      ack() { acked = true; },
      retry() { assert.fail('cancelled plan must not be retried'); },
    }],
  }, env);
  const saved = DB.runs.get(run.id);
  assert.equal(acked, true);
  assert.equal(saved.cancelled_at !== null, true);
  assert.equal(saved.plan_json, undefined);
});


test('cancellation racing the initial queue send prevents the outbox from marking the run queued', async () => {
  const { env, DB, sent } = makeEnv();
  env.JOBS.send = async (message) => {
    sent.push(message);
    const cancelled = await handleRuntimeFetch(new Request(
      'https://runtime.example/v1/agent-runs/' + message.agentRunId + '/cancel',
      { method: 'POST', headers: { Authorization: 'Bearer ' + token } },
    ), env);
    assert.equal(cancelled.status, 200);
  };
  const response = await handleRuntimeFetch(postRun({ objective: 'Cancel during initial dispatch' }), env);
  assert.equal(response.status, 202);
  const { run } = await response.json();
  assert.equal(run.status, 'cancelled');
  assert.ok(run.cancelledAt);
  assert.equal(sent.length, 1);
  assert.equal(DB.runs.get(run.id).status, 'pending_dispatch');
  assert.ok(DB.runs.get(run.id).cancelled_at);
});


test('owner can list recent agent runs with a bounded page and stable next cursor', async () => {
  const { env, DB } = makeEnv();
  for (const [id, createdAt] of [
    ['00000000-0000-4000-8000-000000000003', '2026-11-16T12:02:00.000Z'],
    ['00000000-0000-4000-8000-000000000002', '2026-11-16T12:02:00.000Z'],
    ['00000000-0000-4000-8000-000000000001', '2026-11-16T12:01:00.000Z'],
  ]) {
    DB.runs.set(id, {
      id, objective: 'Run ' + id.slice(-1), specialists_json: '["researcher"]',
      status: 'queued', attempts: 0, created_at: createdAt, updated_at: createdAt,
      cancelled_at: null,
    });
  }
  const response = await handleRuntimeFetch(new Request(
    'https://runtime.example/v1/agent-runs?limit=2',
    { headers: { Authorization: 'Bearer ' + token } },
  ), env);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.runs.map((run) => run.id), [
    '00000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000002',
  ]);
  assert.deepEqual(body.nextCursor, {
    before: '2026-11-16T12:02:00.000Z',
    beforeId: '00000000-0000-4000-8000-000000000002',
  });
  const next = await handleRuntimeFetch(new Request(
    'https://runtime.example/v1/agent-runs?limit=2&before=2026-11-16T12%3A02%3A00.000Z&beforeId=00000000-0000-4000-8000-000000000002',
    { headers: { Authorization: 'Bearer ' + token } },
  ), env);
  const nextBody = await next.json();
  assert.deepEqual(nextBody.runs.map((run) => run.id), [
    '00000000-0000-4000-8000-000000000001',
  ]);
  assert.equal(nextBody.nextCursor, null);
});


test('agent run listing rejects malformed, duplicate and unbounded cursors', async () => {
  const { env } = makeEnv();
  for (const query of [
    '?limit=0',
    '?limit=51',
    '?limit=1&limit=2',
    '?before=2026-11-16T12%3A00%3A00.000Z',
    '?before=not-a-date&beforeId=00000000-0000-4000-8000-000000000001',
    '?before=2026-11-16T12%3A00%3A00.000Z&beforeId=not-a-uuid',
    '?unknown=true',
  ]) {
    const response = await handleRuntimeFetch(new Request(
      'https://runtime.example/v1/agent-runs' + query,
      { headers: { Authorization: 'Bearer ' + token } },
    ), env);
    assert.equal(response.status, 400, query);
  }
});

test('agent run listing exposes cancelled status and returns no next cursor on the final page', async () => {
  const { env, DB } = makeEnv();
  const id = '00000000-0000-4000-8000-000000000004';
  DB.runs.set(id, {
    id, objective: 'Cancelled task', specialists_json: '["researcher"]',
    status: 'queued', attempts: 0, created_at: '2026-11-16T12:04:00.000Z',
    updated_at: '2026-11-16T12:04:00.000Z', cancelled_at: '2026-11-16T12:05:00.000Z',
  });
  const response = await handleRuntimeFetch(new Request(
    'https://runtime.example/v1/agent-runs',
    { headers: { Authorization: 'Bearer ' + token } },
  ), env);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.runs[0].status, 'cancelled');
  assert.equal(body.runs[0].cancelledAt, '2026-11-16T12:05:00.000Z');
  assert.equal(body.nextCursor, null);
});


test('agent run event timeline is bounded, newest-first and cursor-stable across timestamp ties', async () => {
  const { env, DB } = makeEnv();
  const runId = '00000000-0000-4000-8000-000000000055';
  DB.runs.set(runId, {
    id: runId, objective: 'Inspect audit history', specialists_json: '["researcher"]',
    status: 'planned', attempts: 1, created_at: '2026-11-16T12:00:00.000Z',
    updated_at: '2026-11-16T12:00:00.000Z',
  });
  DB.events.push(
    { event_id: 'event-001', agent_run_id: runId, event_type: 'created', detail_json: '{"source":"api"}', created_at: '2026-11-16T12:01:00.000Z' },
    { event_id: 'event-002', agent_run_id: runId, event_type: 'queued', detail_json: '{}', created_at: '2026-11-16T12:02:00.000Z' },
    { event_id: 'event-003', agent_run_id: runId, event_type: 'running', detail_json: '{"attempt":1}', created_at: '2026-11-16T12:03:00.000Z' },
    { event_id: 'event-004', agent_run_id: runId, event_type: 'planned', detail_json: '{"steps":2}', created_at: '2026-11-16T12:03:00.000Z' },
  );

  const first = await handleRuntimeFetch(new Request(
    'https://runtime.example/v1/agent-runs/' + runId + '/events?limit=2',
    { headers: { Authorization: 'Bearer ' + token } },
  ), env);
  assert.equal(first.status, 200);
  const pageOne = await first.json();
  assert.deepEqual(pageOne.events.map((event) => event.id), ['event-004', 'event-003']);
  assert.deepEqual(pageOne.events[0].detail, { steps: 2 });
  assert.deepEqual(pageOne.nextCursor, {
    before: '2026-11-16T12:03:00.000Z',
    beforeId: 'event-003',
  });

  const cursor = new URLSearchParams(pageOne.nextCursor);
  const second = await handleRuntimeFetch(new Request(
    'https://runtime.example/v1/agent-runs/' + runId + '/events?' + cursor.toString() + '&limit=2',
    { headers: { Authorization: 'Bearer ' + token } },
  ), env);
  assert.equal(second.status, 200);
  const pageTwo = await second.json();
  assert.deepEqual(pageTwo.events.map((event) => event.id), ['event-002', 'event-001']);
  assert.equal(pageTwo.nextCursor, null);
});

test('agent run event timeline rejects malformed cursors and duplicate query parameters', async () => {
  const { env, DB } = makeEnv();
  const runId = '00000000-0000-4000-8000-000000000056';
  DB.runs.set(runId, {
    id: runId, objective: 'Inspect audit history', specialists_json: '["researcher"]',
    status: 'planned', attempts: 1, created_at: '2026-11-16T12:00:00.000Z',
    updated_at: '2026-11-16T12:00:00.000Z',
  });
  for (const query of [
    '?before=not-a-date&beforeId=event-001',
    '?before=2026-11-16T12%3A00%3A00.000Z',
    '?limit=2&limit=3',
    '?limit=51',
  ]) {
    const response = await handleRuntimeFetch(new Request(
      'https://runtime.example/v1/agent-runs/' + runId + '/events' + query,
      { headers: { Authorization: 'Bearer ' + token } },
    ), env);
    assert.equal(response.status, 400, query);
  }
});

test('runtime authorisation requires an exact one-time approval binding and never queues work', async () => {
  const { env, DB, sent } = makeEnv();
  const response = await handleRuntimeFetch(postRun({ objective: 'Review the runtime' }), env);
  const { run } = await response.json();
  await runtime.queue({ queue: 'aegis-jobs', messages: [{ body: { agentRunId: run.id }, ack() {}, retry() { assert.fail('unexpected retry'); } }] }, env);
  const saved = DB.runs.get(run.id);
  const plan = JSON.parse(saved.plan_json);
  const { digestCanonicalInput } = await import('../functions/lib/canonical-input.mjs');
  const inputDigest = await digestCanonicalInput(plan);
  const authorize = (body) => handleRuntimeFetch(new Request(
    'https://runtime.example/v1/agent-runs/' + run.id + '/authorize',
    { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  ), env);
  const binding = {
    approvalId: 'approval-once-001',
    capabilityId: 'aegis-agent-run',
    capabilityVersion: '0.1.0',
    actionId: 'approve-execution',
    inputDigest,
    grantId: 'grant-owner-agent-run-001',
  };
  const approved = await authorize(binding);
  assert.equal(approved.status, 200);
  const result = await approved.json();
  assert.equal(result.run.id, run.id);
  assert.equal(result.run.executionAuthorized, true);
  assert.equal(saved.authorization_approval_id, binding.approvalId);
  assert.equal(saved.authorization_grant_id, binding.grantId);
  assert.equal(sent.length, 1, 'authorisation must not enqueue or execute work');

  const replay = await authorize(binding);
  assert.equal(replay.status, 200, 'same approval retry is idempotent');
  const changedApproval = await authorize({ ...binding, approvalId: 'approval-replay-002' });
  assert.equal(changedApproval.status, 409, 'a second approval cannot re-authorise the same run');
  const changedDigest = await authorize({ ...binding, inputDigest: 'sha256:' + '0'.repeat(64) });
  assert.equal(changedDigest.status, 409, 'a different plan digest cannot be authorised');
  assert.equal(sent.length, 1);

  let staleAcked = false;
  await runtime.queue({ queue: 'aegis-jobs', messages: [{
    body: { agentRunId: run.id },
    ack() { staleAcked = true; },
    retry() { assert.fail('authorised plan must not be retried as work'); },
  }] }, env);
  assert.equal(staleAcked, true);
  assert.equal(saved.status, 'planned');
  assert.equal(saved.authorization_approval_id, binding.approvalId);
  assert.equal(saved.authorization_grant_id, binding.grantId);
  assert.equal(sent.length, 1, 'authorisation and stale delivery must not dispatch another worker');

  const cancelled = await handleRuntimeFetch(new Request(
    'https://runtime.example/v1/agent-runs/' + run.id + '/cancel',
    { method: 'POST', headers: { Authorization: 'Bearer ' + token } },
  ), env);
  assert.equal(cancelled.status, 200);
  const cancelledRun = (await cancelled.json()).run;
  assert.equal(cancelledRun.status, 'cancelled');
  assert.equal(cancelledRun.executionAuthorized, true);
  assert.equal(cancelledRun.steps.length, 3);
  assert.ok(cancelledRun.steps.every((step) => step.status === 'cancelled'));
  assert.ok([...DB.steps.values()].every((step) => step.status === 'cancelled'));
  assert.equal(DB.stepEvents.filter((event) =>
    event.agent_run_id === run.id && event.event_type === 'cancelled').length, 3);
});

test('runtime authorisation rejects missing credentials, non-planned runs and malformed claims', async () => {
  const { env } = makeEnv();
  const request = new Request('https://runtime.example/v1/agent-runs/00000000-0000-4000-8000-000000000001/authorize', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
  });
  assert.equal((await handleRuntimeFetch(request, env)).status, 401);
  const bad = await handleRuntimeFetch(new Request(request.url, {
    method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: '{"approvalId":"x"}',
  }), env);
  assert.equal(bad.status, 400);
});


test('runtime authorisation rejects oversized bodies even when Content-Length is absent', async () => {
  const { env } = makeEnv();
  const runId = '00000000-0000-4000-8000-000000000099';
  const oversized = JSON.stringify({
    approvalId: 'approval-once-001',
    capabilityId: 'aegis-agent-run',
    capabilityVersion: '0.1.0',
    actionId: 'approve-execution',
    inputDigest: 'sha256:' + 'a'.repeat(64),
    grantId: 'grant-owner-agent-run-001',
    padding: 'x'.repeat(4096),
  });
  const request = new Request('https://runtime.example/v1/agent-runs/' + runId + '/authorize', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: oversized,
  });
  assert.equal(request.headers.get('Content-Length'), null);
  const response = await handleRuntimeFetch(request, env);
  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), { error: 'Request body is too large.' });
});


test('agent-run submission rejects oversized streamed bodies before persistence when Content-Length is absent', async () => {
  const { env, DB } = makeEnv();
  const request = new Request('https://runtime.example/v1/agent-runs', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ objective: 'x'.repeat(9000) }),
  });
  assert.equal(request.headers.get('Content-Length'), null);
  const response = await handleRuntimeFetch(request, env);
  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), { error: 'Request body is too large.' });
  assert.equal(DB.runs.size, 0);
});
