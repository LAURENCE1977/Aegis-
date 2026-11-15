import test from 'node:test';
import assert from 'node:assert/strict';
import runtime, { handleRuntimeFetch } from '../workers/runtime/index.mjs';

const token = 'runtime-integration-token-with-at-least-32-characters';

class MemoryD1 {
  constructor() { this.jobs = new Map(); this.events = []; }
  prepare(sql) {
    const db = this;
    return {
      values: [],
      bind(...values) { this.values = values; return this; },
      async first() {
        const v = this.values;
        if (sql.includes('WHERE idempotency_key = ?')) {
          return [...db.jobs.values()].find((row) => row.idempotency_key === v[0]) || null;
        }
        if (sql.includes('UPDATE jobs SET status = \'running\'')) {
          const row = db.jobs.get(v[2]);
          if (!row || !['queued', 'pending_dispatch'].includes(row.status)) return null;
          row.status = 'running'; row.attempts += 1; row.lease_until = v[0]; row.updated_at = v[1];
          const claimedAttempt = row.attempts;
          if (db.afterClaim) db.afterClaim(row);
          return { attempts: claimedAttempt };
        }
        if (sql.includes('SELECT attempts FROM jobs')) {
          const row = db.jobs.get(v[0]);
          if (row && db.afterAttemptRead) db.afterAttemptRead(row);
          return row ? { attempts: row.attempts } : null;
        }
        if (sql.includes('WHERE id = ?')) return db.jobs.get(v[0]) || null;
        return null;
      },
      async all() {
        if (sql.includes("status = 'pending_dispatch'")) {
          return { results: [...db.jobs.values()].filter((row) => row.status === 'pending_dispatch').map((row) => ({ id: row.id })) };
        }
        return { results: [] };
      },
      async run() {
        const v = this.values;
        if (sql.includes('INSERT INTO jobs')) {
          if (v[3] && [...db.jobs.values()].some((row) => row.idempotency_key === v[3])) return { meta: { changes: 0 } };
          db.jobs.set(v[0], {
            id: v[0], type: v[1], payload_json: v[2], status: 'pending_dispatch',
            attempts: 0, idempotency_key: v[3], created_at: v[4], updated_at: v[5],
          });
          return { meta: { changes: 1 } };
        }
        if (sql.includes('INSERT INTO job_events')) {
          if (db.events.some((event) => event.event_id === v[0])) return { meta: { changes: 0 } };
          db.events.push({ event_id: v[0], job_id: v[1], event_type: v[2], detail_json: v[3], created_at: v[4] });
          return { meta: { changes: 1 } };
        }
        if (sql.includes(\"SET status = 'failed'\")) {
          const row = db.jobs.get(v[1]);
          if (row && !['succeeded', 'failed'].includes(row.status)) {
            row.status = 'failed'; row.error_code = 'JOB_DELIVERY_EXHAUSTED'; row.lease_until = null; row.updated_at = v[0];
            return { meta: { changes: 1 } };
          }
          return { meta: { changes: 0 } };
        }
        if (sql.includes("SET status = 'failed'") && sql.includes("JOB_DELIVERY_EXHAUSTED")) {
          const row = db.jobs.get(v[1]);
          const expiredLease = row?.status === 'running' && (!row.lease_until || row.lease_until <= v[2]);
          if (row && (['queued', 'pending_dispatch'].includes(row.status) || expiredLease)) {
            row.status = 'failed'; row.error_code = 'JOB_DELIVERY_EXHAUSTED'; row.lease_until = null; row.updated_at = v[0];
            return { meta: { changes: 1 } };
          }
          return { meta: { changes: 0 } };
        }
        if (sql.includes("SET status = 'queued'")) {
          const row = db.jobs.get(v[1]);
          if (row && row.status === 'pending_dispatch') { row.status = 'queued'; row.updated_at = v[0]; return { meta: { changes: 1 } }; }
          return { meta: { changes: 0 } };
        }
        if (sql.includes("SET status = 'running'")) {
          const row = db.jobs.get(v[2]);
          if (row && ['queued', 'pending_dispatch'].includes(row.status)) {
            row.status = 'running'; row.attempts += 1; row.lease_until = v[0]; row.updated_at = v[1];
            return { meta: { changes: 1 } };
          }
          return { meta: { changes: 0 } };
        }
        if (sql.includes("SET status = 'succeeded'")) {
          const row = db.jobs.get(v[2]);
          if (row && row.status === 'running' && row.attempts === v[3]) {
            row.status = 'succeeded'; row.result_json = v[0]; row.updated_at = v[1]; row.lease_until = null;
            return { meta: { changes: 1 } };
          }
          return { meta: { changes: 0 } };
        }
        return { meta: { changes: 0 } };
      },
    };
  }
}

function makeEnv() {
  const DB = new MemoryD1();
  const sent = [];
  const JOBS = { async send(message) { sent.push(message); } };
  return { env: { AEGIS_JOB_TOKEN: token, DB, JOBS }, DB, sent };
}

function postJob(body, extraHeaders = {}) {
  return new Request('https://runtime.example/v1/jobs', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
}

test('submits a whitelisted job durably before dispatch and returns its identifier', async () => {
  const { env, DB, sent } = makeEnv();
  const response = await handleRuntimeFetch(postJob({ type: 'aegis.health_check', payload: {} }), env);
  assert.equal(response.status, 201);
  const { job } = await response.json();
  assert.equal(job.status, 'queued');
  assert.equal(job.type, 'aegis.health_check');
  assert.ok(DB.jobs.has(job.id));
  assert.deepEqual(sent, [{ jobId: job.id }]);
  assert.ok(DB.events.some((event) => event.event_type === 'queued'));
});

test('idempotency key prevents duplicate persisted jobs and queue messages', async () => {
  const { env, DB, sent } = makeEnv();
  const headers = { 'Idempotency-Key': 'same-request-0001' };
  const first = await handleRuntimeFetch(postJob({ type: 'aegis.health_check', payload: {} }, headers), env);
  const second = await handleRuntimeFetch(postJob({ type: 'aegis.health_check', payload: {} }, headers), env);
  const a = await first.json();
  const b = await second.json();
  assert.equal(a.job.id, b.job.id);
  assert.equal(DB.jobs.size, 1);
  assert.equal(sent.length, 1);
});

test('a stale worker cannot adopt a newer attempt number after its lease is reclaimed', async () => {
  const { env, DB } = makeEnv();
  const response = await handleRuntimeFetch(postJob({ type: 'aegis.health_check', payload: {} }), env);
  const { job } = await response.json();
  const simulateNewerAttempt = (row) => {
    // Simulate lease recovery and a second consumer claiming the same job
    // after the first claim commits but before its result is processed.
    row.status = 'running';
    row.attempts = 2;
  };
  DB.afterClaim = simulateNewerAttempt;
  DB.afterAttemptRead = simulateNewerAttempt;
  let acked = false;
  await runtime.queue({ queue: 'aegis-jobs', messages: [{ body: { jobId: job.id }, ack() { acked = true; }, retry() {} }] }, env);
  assert.equal(DB.jobs.get(job.id).status, 'running');
  assert.equal(DB.jobs.get(job.id).attempts, 2);
  assert.equal(DB.jobs.get(job.id).result_json, undefined);
  assert.equal(acked, true);
});

test('queue consumer executes only the persisted health-check job and acknowledges success', async () => {
  const { env, DB } = makeEnv();
  const response = await handleRuntimeFetch(postJob({ type: 'aegis.health_check', payload: {} }), env);
  const { job } = await response.json();
  let acked = false;
  let retried = false;
  await runtime.queue({
    messages: [{
      body: { jobId: job.id },
      ack() { acked = true; },
      retry() { retried = true; },
    }],
  }, env);
  const saved = DB.jobs.get(job.id);
  assert.equal(saved.status, 'succeeded');
  assert.equal(saved.attempts, 1);
  assert.equal(JSON.parse(saved.result_json).ok, true);
  assert.equal(acked, true);
  assert.equal(retried, false);
});


test('dead-letter delivery marks a non-terminal job failed and records the delivery exhaustion', async () => {
  const { env, DB } = makeEnv();
  const response = await handleRuntimeFetch(postJob({ type: 'aegis.health_check', payload: {} }), env);
  const { job } = await response.json();
  const saved = DB.jobs.get(job.id);
  saved.status = 'queued';

  let acked = false;
  await runtime.queue({
    queue: 'aegis-jobs-dlq',
    messages: [{
      body: { jobId: job.id },
      ack() { acked = true; },
      retry() {},
    }],
  }, env);

  assert.equal(saved.status, 'failed');
  assert.equal(saved.error_code, 'JOB_DELIVERY_EXHAUSTED');
  assert.equal(saved.lease_until, null);
  assert.equal(acked, true);
  assert.ok(DB.events.some((event) => event.event_type === 'delivery_exhausted'));

  // A repeated DLQ delivery must not duplicate its audit event.
  await runtime.queue({
    queue: 'aegis-jobs-dlq',
    messages: [{ body: { jobId: job.id }, ack() {}, retry() {} }],
  }, env);
  assert.equal(DB.events.filter((event) => event.event_type === 'delivery_exhausted').length, 1);
});

test('dead-letter delivery never overwrites a succeeded job', async () => {
  const { env, DB } = makeEnv();
  const response = await handleRuntimeFetch(postJob({ type: 'aegis.health_check', payload: {} }), env);
  const { job } = await response.json();
  const saved = DB.jobs.get(job.id);
  saved.status = 'succeeded';
  saved.result_json = JSON.stringify({ ok: true });

  let acked = false;
  await runtime.queue({
    queue: 'aegis-jobs-dlq',
    messages: [{ body: { jobId: job.id }, ack() { acked = true; }, retry() {} }],
  }, env);

  assert.equal(saved.status, 'succeeded');
  assert.deepEqual(JSON.parse(saved.result_json), { ok: true });
  assert.equal(DB.events.some((event) => event.event_type === 'delivery_exhausted'), false);
  assert.equal(acked, true);
});
