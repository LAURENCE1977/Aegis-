import {
  buildHealthCheckResult,
  isJobId,
  isTerminalJobStatus,
  validateJobSubmission,
} from './lib.mjs';

const MAX_BODY_BYTES = 8 * 1024;
const MAX_ATTEMPTS = 5;

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

async function audit(env, jobId, eventType, detail = {}) {
  await env.DB.prepare(
    'INSERT INTO job_events (event_id, job_id, event_type, detail_json, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(crypto.randomUUID(), jobId, eventType, JSON.stringify(detail), new Date().toISOString()).run();
}

async function dispatchPending(env, limit = 25) {
  if (!bindingsReady(env)) throw new Error('Runtime bindings are not configured.');
  const now = new Date().toISOString();
  await env.DB.prepare(
    "UPDATE jobs SET status = 'pending_dispatch', lease_until = NULL, updated_at = ? WHERE status = 'running' AND lease_until IS NOT NULL AND lease_until < ?"
  ).bind(now, now).run();
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

export async function handleRuntimeFetch(request, env) {
  if (!env || typeof env.AEGIS_JOB_TOKEN !== 'string' || env.AEGIS_JOB_TOKEN.length < 32) {
    return json({ error: 'Runtime authentication is not configured.' }, 503);
  }
  if (!originAllowed(request)) return json({ error: 'Origin is not allowed.' }, 403);
  if (!isAuthorized(request, env)) {
    return json({ error: 'Authentication required.' }, 401, { 'WWW-Authenticate': 'Bearer' });
  }

  const url = new URL(request.url);
  if (url.pathname === '/v1/jobs' && request.method === 'POST') return submitJob(request, env);
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
  const claimed = await env.DB.prepare(
    "UPDATE jobs SET status = 'running', attempts = attempts + 1, lease_until = ?, updated_at = ? WHERE id = ? AND status IN ('queued', 'pending_dispatch')"
  ).bind(new Date(Date.now() + 120_000).toISOString(), startedAt, jobId).run();
  if (!claimed.meta?.changes) {
    message.ack();
    return;
  }
  const claimedRow = await env.DB.prepare('SELECT attempts FROM jobs WHERE id = ?').bind(jobId).first();
  const attempt = Number(claimedRow?.attempts || 0);
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

export default {
  fetch: handleRuntimeFetch,
  async queue(batch, env) {
    for (const message of batch.messages) await processJob(message, env);
  },
  scheduled(_controller, env, context) {
    context.waitUntil(dispatchPending(env));
  },
};
