import { createAgentPlan, validateAgentRunSubmission } from './agents.mjs';
import {
  appendExperimentRecord,
  getExperimentRecord,
  listExperimentRecords,
  tombstoneExperimentRecord,
} from './experiment-record-store.mjs';
import {
  buildHealthCheckResult,
  isJobId,
  isTerminalJobStatus,
  validateJobSubmission,
} from './lib.mjs';

const MAX_BODY_BYTES = 8 * 1024;
const MAX_ATTEMPTS = 5;

function agentRunsEnabled(env) { return env?.AGENT_RUNS_ENABLED === 'true'; }

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

function safeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || left.length !== right.length) return false;
  let mismatch = 0;
  for (let i = 0; i < left.length; i += 1) mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return mismatch === 0;
}

function isAuthorized(request, env) {
  const expected = env?.AEGIS_JOB_TOKEN;
  if (typeof expected !== 'string' || expected.length < 32) return false;
  const match = /^Bearer\s+([^\s]+)$/i.exec(request.headers.get('Authorization') || '');
  return Boolean(match && safeEqual(match[1], expected));
}

function originAllowed(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function bindingsReady(env) {
  return Boolean(
    env?.DB && typeof env.DB.prepare === 'function' &&
    env?.JOBS && typeof env.JOBS.send === 'function'
  );
}

function parseJob(row) {
  if (!row) return null;
  let result = null;
  try { result = row.result_json ? JSON.parse(row.result_json) : null; } catch { result = null; }
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    attempts: row.attempts,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    result,
    errorCode: row.error_code || null,
  };
}

async function audit(env, jobId, eventType, detail = {}, eventId = crypto.randomUUID()) {
  await env.DB.prepare(
    'INSERT INTO job_events (event_id, job_id, event_type, detail_json, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(event_id) DO NOTHING'
  ).bind(eventId, jobId, eventType, JSON.stringify(detail), new Date().toISOString()).run();
}

function parseAgentRun(row) {
  if (!row) return null;
  let plan = null;
  try { plan = row.plan_json ? JSON.parse(row.plan_json) : null; } catch { plan = null; }
  let specialists = [];
  let acceptanceCriteria = [];
  let priority = 'balanced';
  let assumptions = [];
  let constraints = [];
  try {
    const stored = JSON.parse(row.specialists_json);
    if (Array.isArray(stored)) specialists = stored;
    else if (stored && typeof stored === 'object') {
      specialists = Array.isArray(stored.specialists) ? stored.specialists : [];
      acceptanceCriteria = Array.isArray(stored.acceptanceCriteria) ? stored.acceptanceCriteria : [];
      priority = typeof stored.priority === 'string' ? stored.priority : 'balanced';
      assumptions = Array.isArray(stored.assumptions) ? stored.assumptions : [];
      constraints = Array.isArray(stored.constraints) ? stored.constraints : [];
    }
  } catch { specialists = []; }
  return {
    id: row.id,
    objective: row.objective,
    specialists,
    acceptanceCriteria,
    priority,
    assumptions,
    constraints,
    status: row.status,
    attempts: row.attempts,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    plan,
    errorCode: row.error_code || null,
  };
}

async function auditAgentRun(env, runId, eventType, detail = {}, eventId = crypto.randomUUID()) {
  await env.DB.prepare(
    'INSERT INTO agent_run_events (event_id, agent_run_id, event_type, detail_json, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(event_id) DO NOTHING'
  ).bind(eventId, runId, eventType, JSON.stringify(detail), new Date().toISOString()).run();
}

async function dispatchAgentRuns(env, limit = 25) {
  if (!agentRunsEnabled(env)) return 0;
  if (!bindingsReady(env)) throw new Error('Runtime bindings are not configured.');
  const now = new Date().toISOString();
  const expired = await env.DB.prepare(
    "SELECT id FROM agent_runs WHERE status = 'running' AND lease_until IS NOT NULL AND lease_until < ?"
  ).bind(now).all();
  for (const row of expired.results || []) {
    const recovered = await env.DB.prepare(
      "UPDATE agent_runs SET status = 'pending_dispatch', lease_until = NULL, updated_at = ? WHERE id = ? AND status = 'running' AND lease_until < ?"
    ).bind(now, row.id, now).run();
    if (recovered.meta?.changes) await auditAgentRun(env, row.id, 'lease_expired');
  }
  const pending = await env.DB.prepare(
    "SELECT id FROM agent_runs WHERE status = 'pending_dispatch' ORDER BY created_at ASC LIMIT ?"
  ).bind(Math.max(1, Math.min(100, limit))).all();
  let dispatched = 0;
  for (const row of pending.results || []) {
    try {
      await env.JOBS.send({ agentRunId: row.id });
      const updated = await env.DB.prepare(
        "UPDATE agent_runs SET status = 'queued', lease_until = NULL, updated_at = ? WHERE id = ? AND status = 'pending_dispatch'"
      ).bind(new Date().toISOString(), row.id).run();
      if (updated.meta?.changes) {
        await auditAgentRun(env, row.id, 'queued');
        dispatched += 1;
      }
    } catch {
      // Keep the durable outbox row pending for the next Cron sweep.
    }
  }
  return dispatched;
}

async function submitAgentRun(request, env) {
  if (!agentRunsEnabled(env)) return json({ error: 'Agent orchestration is not enabled.' }, 503);
  if (!bindingsReady(env)) return json({ error: 'Runtime is not configured.' }, 503);
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || '')) {
    return json({ error: 'Content-Type must be application/json.' }, 415);
  }
  const length = Number(request.headers.get('Content-Length') || 0);
  if (length > MAX_BODY_BYTES) return json({ error: 'Request body is too large.' }, 413);
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return json({ error: 'Request body is too large.' }, 413);
  let input;
  try { input = JSON.parse(raw); } catch { return json({ error: 'Invalid JSON.' }, 400); }
  let submission;
  try { submission = validateAgentRunSubmission(input); } catch (error) {
    return json({ error: error.message }, 400);
  }
  const idempotencyKey = request.headers.get('Idempotency-Key');
  if (idempotencyKey && !/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) {
    return json({ error: 'Idempotency-Key must be 8–128 safe characters.' }, 400);
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO agent_runs (id, objective, specialists_json, status, attempts, idempotency_key, created_at, updated_at) VALUES (?, ?, ?, 'pending_dispatch', 0, ?, ?, ?) ON CONFLICT(idempotency_key) DO NOTHING"
  ).bind(id, submission.objective, JSON.stringify({
    specialists: submission.specialists,
    acceptanceCriteria: submission.acceptanceCriteria,
    priority: submission.priority,
    assumptions: submission.assumptions,
    constraints: submission.constraints,
  }), idempotencyKey || null, now, now).run();
  const row = idempotencyKey
    ? await env.DB.prepare('SELECT * FROM agent_runs WHERE idempotency_key = ?').bind(idempotencyKey).first()
    : await env.DB.prepare('SELECT * FROM agent_runs WHERE id = ?').bind(id).first();
  if (!row) return json({ error: 'Agent run could not be persisted.' }, 500);
  if (row.status === 'pending_dispatch') {
    try {
      await env.JOBS.send({ agentRunId: row.id });
      const updated = await env.DB.prepare(
        "UPDATE agent_runs SET status = 'queued', lease_until = NULL, updated_at = ? WHERE id = ? AND status = 'pending_dispatch'"
      ).bind(new Date().toISOString(), row.id).run();
      if (updated.meta?.changes) await auditAgentRun(env, row.id, 'queued');
    } catch {
      // The scheduled outbox sweep recovers this persisted run.
    }
  }
  const current = await env.DB.prepare('SELECT * FROM agent_runs WHERE id = ?').bind(row.id).first();
  return json({ run: parseAgentRun(current) }, current?.status === 'pending_dispatch' ? 202 : 201);
}

async function getAgentRun(env, id) {
  if (!isJobId(id)) return json({ error: 'Invalid agent run identifier.' }, 400);
  const row = await env.DB.prepare('SELECT * FROM agent_runs WHERE id = ?').bind(id).first();
  if (!row) return json({ error: 'Agent run not found.' }, 404);
  return json({ run: parseAgentRun(row) });
}

async function processAgentRun(message, env) {
  const runId = message?.body?.agentRunId;
  if (!isJobId(runId)) { message.ack(); return; }
  const row = await env.DB.prepare('SELECT * FROM agent_runs WHERE id = ?').bind(runId).first();
  if (!row || ['planned', 'failed', 'running'].includes(row.status) ||
      !['queued', 'pending_dispatch'].includes(row.status)) { message.ack(); return; }
  const startedAt = new Date().toISOString();
  const claim = await env.DB.prepare(
    "UPDATE agent_runs SET status = 'running', attempts = attempts + 1, lease_until = ?, updated_at = ? WHERE id = ? AND status IN ('queued', 'pending_dispatch') RETURNING attempts"
  ).bind(new Date(Date.now() + 120_000).toISOString(), startedAt, runId).first();
  if (!claim) { message.ack(); return; }
  const attempt = Number(claim.attempts);
  await auditAgentRun(env, runId, 'running', { attempt });
  try {
    const storedSubmission = JSON.parse(row.specialists_json);
    const submission = Array.isArray(storedSubmission)
      ? { objective: row.objective, specialists: storedSubmission }
      : { ...storedSubmission, objective: row.objective };
    const plan = createAgentPlan(submission, { runId, createdAt: row.created_at });
    const saved = await env.DB.prepare(
      "UPDATE agent_runs SET status = 'planned', plan_json = ?, error_code = NULL, lease_until = NULL, updated_at = ? WHERE id = ? AND status = 'running' AND attempts = ?"
    ).bind(JSON.stringify(plan), new Date().toISOString(), runId, attempt).run();
    if (saved.meta?.changes) await auditAgentRun(env, runId, 'planned', { steps: plan.steps.length, execution: 'plan-only' });
    message.ack();
  } catch {
    if (attempt >= MAX_ATTEMPTS) {
      const failed = await env.DB.prepare(
        "UPDATE agent_runs SET status = 'failed', error_code = 'AGENT_PLAN_FAILED', lease_until = NULL, updated_at = ? WHERE id = ? AND status = 'running' AND attempts = ?"
      ).bind(new Date().toISOString(), runId, attempt).run();
      if (failed.meta?.changes) await auditAgentRun(env, runId, 'failed', { code: 'AGENT_PLAN_FAILED', attempt });
      message.ack();
    } else {
      const retry = await env.DB.prepare(
        "UPDATE agent_runs SET status = 'queued', error_code = 'AGENT_PLAN_RETRY', lease_until = NULL, updated_at = ? WHERE id = ? AND status = 'running' AND attempts = ?"
      ).bind(new Date().toISOString(), runId, attempt).run();
      if (!retry.meta?.changes) { message.ack(); return; }
      await auditAgentRun(env, runId, 'retry_scheduled', { attempt });
      message.retry({ delaySeconds: Math.min(300, 2 ** attempt * 5) });
    }
  }
}

async function processAgentDeadLetter(message, env) {
  const runId = message?.body?.agentRunId;
  if (!isJobId(runId)) { message.ack(); return; }
  const now = new Date().toISOString();
  await env.DB.prepare(
    "UPDATE agent_runs SET status = 'failed', error_code = 'AGENT_DELIVERY_EXHAUSTED', lease_until = NULL, updated_at = ? WHERE id = ? AND (status IN ('queued', 'pending_dispatch') OR (status = 'running' AND (lease_until IS NULL OR lease_until <= ?)))"
  ).bind(now, runId, now).run();
  const row = await env.DB.prepare(
    'SELECT status, error_code FROM agent_runs WHERE id = ?'
  ).bind(runId).first();
  if (row?.status === 'failed' && row.error_code === 'AGENT_DELIVERY_EXHAUSTED') {
    await auditAgentRun(env, runId, 'delivery_exhausted',
      { code: 'AGENT_DELIVERY_EXHAUSTED' }, 'delivery-exhausted:' + runId);
  }
  message.ack();
}

async function dispatchPending(env, limit = 25) {
  if (!bindingsReady(env)) throw new Error('Runtime bindings are not configured.');
  const now = new Date().toISOString();
  const expired = await env.DB.prepare(
    "SELECT id FROM jobs WHERE status = 'running' AND lease_until IS NOT NULL AND lease_until < ?"
  ).bind(now).all();
  for (const row of expired.results || []) {
    const recovered = await env.DB.prepare(
      "UPDATE jobs SET status = 'pending_dispatch', lease_until = NULL, updated_at = ? WHERE id = ? AND status = 'running' AND lease_until < ?"
    ).bind(now, row.id, now).run();
    if (recovered.meta?.changes) await audit(env, row.id, 'lease_expired');
  }
  const result = await env.DB.prepare(
    "SELECT id FROM jobs WHERE status = 'pending_dispatch' ORDER BY created_at ASC LIMIT ?"
  ).bind(Math.max(1, Math.min(100, limit))).all();

  let dispatched = 0;
  for (const row of result.results || []) {
    try {
      await env.JOBS.send({ jobId: row.id });
      const updated = await env.DB.prepare(
        "UPDATE jobs SET status = 'queued', lease_until = NULL, updated_at = ? WHERE id = ? AND status = 'pending_dispatch'"
      ).bind(new Date().toISOString(), row.id).run();
      if (updated.meta?.changes) {
        await audit(env, row.id, 'queued');
        dispatched += 1;
      }
    } catch {
      // Leave the durable outbox row pending; the next scheduled sweep retries it.
    }
  }
  return dispatched;
}

async function submitJob(request, env) {
  if (!bindingsReady(env)) return json({ error: 'Runtime is not configured.' }, 503);
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || '')) {
    return json({ error: 'Content-Type must be application/json.' }, 415);
  }
  const length = Number(request.headers.get('Content-Length') || 0);
  if (length > MAX_BODY_BYTES) return json({ error: 'Request body is too large.' }, 413);
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return json({ error: 'Request body is too large.' }, 413);
  }

  let input;
  try { input = JSON.parse(raw); } catch { return json({ error: 'Invalid JSON.' }, 400); }
  let submission;
  try { submission = validateJobSubmission(input); } catch (error) {
    return json({ error: error.message }, 400);
  }

  const idempotencyKey = request.headers.get('Idempotency-Key');
  if (idempotencyKey && !/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) {
    return json({ error: 'Idempotency-Key must be 8–128 safe characters.' }, 400);
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO jobs (id, type, payload_json, status, attempts, idempotency_key, created_at, updated_at) VALUES (?, ?, ?, 'pending_dispatch', 0, ?, ?, ?) ON CONFLICT(idempotency_key) DO NOTHING"
  ).bind(id, submission.type, JSON.stringify(submission.payload), idempotencyKey || null, now, now).run();

  const row = idempotencyKey
    ? await env.DB.prepare('SELECT * FROM jobs WHERE idempotency_key = ?').bind(idempotencyKey).first()
    : await env.DB.prepare('SELECT * FROM jobs WHERE id = ?').bind(id).first();

  if (!row) return json({ error: 'Job could not be persisted.' }, 500);

  if (row.status === 'pending_dispatch') {
    try {
      await env.JOBS.send({ jobId: row.id });
      const updated = await env.DB.prepare(
        "UPDATE jobs SET status = 'queued', lease_until = NULL, updated_at = ? WHERE id = ? AND status = 'pending_dispatch'"
      ).bind(new Date().toISOString(), row.id).run();
      if (updated.meta?.changes) await audit(env, row.id, 'queued');
    } catch {
      // The scheduled outbox sweep will dispatch this persisted job later.
    }
  }

  const current = await env.DB.prepare('SELECT * FROM jobs WHERE id = ?').bind(row.id).first();
  return json({ job: parseJob(current) }, current?.status === 'pending_dispatch' ? 202 : 201);
}

async function getJob(request, env, id) {
  if (!env?.DB || typeof env.DB.prepare !== 'function') return json({ error: 'Database is not configured.' }, 503);
  if (!isJobId(id)) return json({ error: 'Invalid job identifier.' }, 400);
  const row = await env.DB.prepare('SELECT * FROM jobs WHERE id = ?').bind(id).first();
  if (!row) return json({ error: 'Job not found.' }, 404);
  return json({ job: parseJob(row) });
}

const MAX_EXPERIMENT_RECORD_BODY_BYTES = 300 * 1024;

function trustedExperimentPrincipal(request) {
  // The current application is single-owner. Do not accept arbitrary tenant
  // identifiers until a signed multi-user principal assertion is implemented.
  return request.headers.get('X-Aegis-Principal') === 'owner' ? 'owner' : null;
}

async function handleExperimentRecordRequest(request, env, url) {
  if (!env?.DB || typeof env.DB.prepare !== 'function') {
    return json({ error: 'Runtime database is not configured.' }, 503);
  }
  const principalId = trustedExperimentPrincipal(request);
  if (!principalId) return json({ error: 'Trusted principal context is required.' }, 400);

  const collectionPath = '/v1/experiment-records';
  if (url.pathname === collectionPath && request.method === 'GET') {
    const rawLimit = url.searchParams.get('limit');
    const limit = rawLimit === null ? 25 : Number(rawLimit);
    let cursor = null;
    const rawCursor = url.searchParams.get('cursor');
    if (rawCursor) {
      try { cursor = JSON.parse(rawCursor); } catch {
        return json({ error: 'Experiment record cursor is invalid.' }, 400);
      }
    }
    try {
      return json(await listExperimentRecords(env.DB, principalId, { limit, cursor }));
    } catch (error) {
      return json({ error: error instanceof TypeError ? 'Experiment record query is invalid.' : 'Experiment record history is unavailable.' },
        error instanceof TypeError ? 400 : 503);
    }
  }

  if (url.pathname === collectionPath && request.method === 'POST') {
    if (!/^application\\/json(?:\\s*;|$)/i.test(request.headers.get('Content-Type') || '')) {
      return json({ error: 'Content-Type must be application/json.' }, 415);
    }
    const declaredLength = Number(request.headers.get('Content-Length') || 0);
    if (declaredLength > MAX_EXPERIMENT_RECORD_BODY_BYTES) {
      return json({ error: 'Experiment record request is too large.' }, 413);
    }
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_EXPERIMENT_RECORD_BODY_BYTES) {
      return json({ error: 'Experiment record request is too large.' }, 413);
    }
    let body;
    try { body = JSON.parse(raw); } catch { return json({ error: 'Invalid JSON.' }, 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        Object.keys(body).length !== 1 || !Object.hasOwn(body, 'record')) {
      return json({ error: 'A single experiment record field is required.' }, 400);
    }
    try {
      const result = await appendExperimentRecord(env.DB, principalId, body.record);
      return json({ record: result.record, created: result.created }, result.created ? 201 : 200);
    } catch (error) {
      if (error instanceof TypeError) return json({ error: 'Experiment record is invalid.' }, 400);
      if (/different immutable content/i.test(error?.message || '')) {
        return json({ error: 'Experiment record identifier already exists with different immutable content.' }, 409);
      }
      return json({ error: 'Experiment record could not be persisted.' }, 503);
    }
  }

  const match = /^\\/v1\\/experiment-records\\/([^/]+)$/.exec(url.pathname);
  if (!match) return json({ error: 'Not found.' }, 404);
  let recordId;
  try { recordId = decodeURIComponent(match[1]); } catch { return json({ error: 'Invalid experiment record identifier.' }, 400); }

  if (request.method === 'GET') {
    try {
      const record = await getExperimentRecord(env.DB, principalId, recordId);
      return record ? json({ record }) : json({ error: 'Experiment record not found.' }, 404);
    } catch (error) {
      return json({ error: error instanceof TypeError ? 'Experiment record identifier is invalid.' : 'Experiment record integrity check failed.' },
        error instanceof TypeError ? 400 : 503);
    }
  }

  if (request.method === 'DELETE') {
    try {
      const deleted = await tombstoneExperimentRecord(env.DB, principalId, recordId);
      return deleted ? json({ deleted: true }) : json({ error: 'Experiment record not found.' }, 404);
    } catch (error) {
      return json({ error: error instanceof TypeError ? 'Experiment record identifier is invalid.' : 'Experiment record could not be deleted.' },
        error instanceof TypeError ? 400 : 503);
    }
  }
  return json({ error: 'Method not allowed.' }, 405);
}

export async function handleRuntimeFetch(request, env) {
  if (!env || typeof env.AEGIS_JOB_TOKEN !== 'string' || env.AEGIS_JOB_TOKEN.length < 32) {
    return json({ error: 'Runtime authentication is not configured.' }, 503);
  }
  if (!originAllowed(request)) return json({ error: 'Origin is not allowed.' }, 403);
  if (!isAuthorized(request, env)) {
    return json({ error: 'Authentication required.' }, 401, { 'WWW-Authenticate': 'Bearer' });
  }

  const url = new URL(request.url);
  if (url.pathname === '/v1/experiment-records' || url.pathname.startsWith('/v1/experiment-records/')) {
    return handleExperimentRecordRequest(request, env, url);
  }
  if (url.pathname === '/v1/jobs' && request.method === 'POST') return submitJob(request, env);
  if (url.pathname === '/v1/agent-runs' && request.method === 'POST') return submitAgentRun(request, env);
  if (request.method === 'GET' && url.pathname.startsWith('/v1/agent-runs/')) {
    if (!agentRunsEnabled(env)) return json({ error: 'Agent orchestration is not enabled.' }, 503);
    if (!env?.DB || typeof env.DB.prepare !== 'function') return json({ error: 'Database is not configured.' }, 503);
    return getAgentRun(env, url.pathname.slice('/v1/agent-runs/'.length));
  }
  if (request.method === 'GET' && url.pathname.startsWith('/v1/jobs/')) {
    return getJob(request, env, url.pathname.slice('/v1/jobs/'.length));
  }
  if (url.pathname === '/health' && request.method === 'GET') {
    if (!bindingsReady(env)) return json({ ok: false, service: 'aegis-runtime' }, 503);
    return json(buildHealthCheckResult(env));
  }
  return json({ error: 'Not found.' }, 404);
}

async function processJob(message, env) {
  const jobId = message?.body?.jobId;
  if (!isJobId(jobId)) {
    message.ack();
    return;
  }

  const row = await env.DB.prepare('SELECT * FROM jobs WHERE id = ?').bind(jobId).first();
  if (!row || isTerminalJobStatus(row.status) || row.status === 'running') {
    message.ack();
    return;
  }
  if (!['queued', 'pending_dispatch'].includes(row.status)) {
    message.ack();
    return;
  }

  const startedAt = new Date().toISOString();
  // Capture the attempt number from the same atomic claim statement.
  // A later SELECT could observe a newer consumer's attempt after lease recovery,
  // allowing this stale worker to impersonate that newer attempt.
  const claim = await env.DB.prepare(
    "UPDATE jobs SET status = 'running', attempts = attempts + 1, lease_until = ?, updated_at = ? WHERE id = ? AND status IN ('queued', 'pending_dispatch') RETURNING attempts"
  ).bind(new Date(Date.now() + 120_000).toISOString(), startedAt, jobId).first();
  if (!claim) {
    message.ack();
    return;
  }
  const attempt = Number(claim.attempts);
  await audit(env, jobId, 'running', { attempt });

  try {
    if (row.type !== 'aegis.health_check') throw new Error('Unsupported persisted job type.');
    const result = buildHealthCheckResult(env);
    if (!result.checks.database || !result.checks.queue) throw new Error('Runtime dependency unavailable.');
    const finishedAt = new Date().toISOString();
    const finished = await env.DB.prepare(
      "UPDATE jobs SET status = 'succeeded', result_json = ?, error_code = NULL, lease_until = NULL, updated_at = ? WHERE id = ? AND status = 'running' AND attempts = ?"
    ).bind(JSON.stringify(result), finishedAt, jobId, attempt).run();
    if (finished.meta?.changes) await audit(env, jobId, 'succeeded', { attempt });
    message.ack();
  } catch {
    if (attempt >= MAX_ATTEMPTS) {
      const failed = await env.DB.prepare(
        "UPDATE jobs SET status = 'failed', error_code = 'JOB_EXECUTION_FAILED', lease_until = NULL, updated_at = ? WHERE id = ? AND status = 'running' AND attempts = ?"
      ).bind(new Date().toISOString(), jobId, attempt).run();
      if (failed.meta?.changes) await audit(env, jobId, 'failed', { code: 'JOB_EXECUTION_FAILED', attempt });
      message.ack();
    } else {
      const retry = await env.DB.prepare(
        "UPDATE jobs SET status = 'queued', error_code = 'JOB_EXECUTION_RETRY', lease_until = NULL, updated_at = ? WHERE id = ? AND status = 'running' AND attempts = ?"
      ).bind(new Date().toISOString(), jobId, attempt).run();
      if (!retry.meta?.changes) {
        message.ack();
        return;
      }
      await audit(env, jobId, 'retry_scheduled', { attempt });
      message.retry({ delaySeconds: Math.min(300, 2 ** attempt * 5) });
    }
  }
}

async function processDeadLetter(message, env) {
  const jobId = message?.body?.jobId;
  if (!isJobId(jobId)) {
    message.ack();
    return;
  }

  const now = new Date().toISOString();
  await env.DB.prepare(
    "UPDATE jobs SET status = 'failed', error_code = 'JOB_DELIVERY_EXHAUSTED', lease_until = NULL, updated_at = ? WHERE id = ? AND (status IN ('queued', 'pending_dispatch') OR (status = 'running' AND (lease_until IS NULL OR lease_until <= ?)))"
  ).bind(now, jobId, now).run();

  // Re-read after the conditional transition so a redelivery can repair a
  // missing audit insert without overwriting an already-terminal or active job.
  const row = await env.DB.prepare(
    'SELECT status, error_code FROM jobs WHERE id = ?'
  ).bind(jobId).first();
  if (row?.status === 'failed' && row.error_code === 'JOB_DELIVERY_EXHAUSTED') {
    await audit(
      env,
      jobId,
      'delivery_exhausted',
      { code: 'JOB_DELIVERY_EXHAUSTED' },
      `delivery-exhausted:${jobId}`,
    );
  }
  message.ack();
}

export default {
  fetch: handleRuntimeFetch,
  async queue(batch, env) {
    for (const message of batch.messages) {
      if (batch.queue === 'aegis-jobs') {
        if (message?.body?.agentRunId) {
          if (agentRunsEnabled(env)) await processAgentRun(message, env);
          else message.ack();
        }
        else await processJob(message, env);
      } else if (batch.queue === 'aegis-jobs-dlq') {
        if (message?.body?.agentRunId) {
          if (agentRunsEnabled(env)) await processAgentDeadLetter(message, env);
          else message.ack();
        }
        else await processDeadLetter(message, env);
      } else {
        // Fail closed: an unknown queue must never execute a job payload.
        message.ack();
      }
    }
  },
  scheduled(_controller, env, context) {
    context.waitUntil(agentRunsEnabled(env)
      ? Promise.all([dispatchPending(env), dispatchAgentRuns(env)])
      : dispatchPending(env));
  },
};
