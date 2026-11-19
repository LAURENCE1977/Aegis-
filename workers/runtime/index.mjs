import { createAgentPlan, validateAgentRunSubmission } from './agents.mjs';
import { digestProjectBrief } from '../../functions/lib/project-context-digest.mjs';
import { digestCanonicalInput } from '../../functions/lib/canonical-input.mjs';
import { AGENT_RUN_RECORD_SCHEMA_VERSION, createAgentTaskEnvelope, validateAgentRunRecord, validateAgentTaskEnvelope } from '../../functions/lib/agent-contracts.mjs';
import { buildAgentPlanApprovalBinding } from './agent-plan-approval.mjs';
import {
  buildHealthCheckResult,
  isJobId,
  isTerminalJobStatus,
  validateJobSubmission,
} from './lib.mjs';

const MAX_BODY_BYTES = 8 * 1024;
const MAX_AGENT_RUN_BODY_BYTES = 24 * 1024;
const MAX_ATTEMPTS = 5;

function agentRunsEnabled(env) { return env?.AGENT_RUNS_ENABLED === 'true'; }

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}


async function readBoundedRequestText(request, maxBytes) {
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        try { await reader.cancel(); } catch {}
        throw new RangeError('Request body is too large.');
      }
      chunks.push(value);
    }
  } catch (error) {
    try { await reader.cancel(); } catch {}
    throw error;
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new TypeError('Request body is not valid UTF-8.');
  }
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
  try { specialists = JSON.parse(row.specialists_json); } catch { specialists = []; }
  const record = {
    schemaVersion: AGENT_RUN_RECORD_SCHEMA_VERSION,
    id: row.id,
    objective: row.objective,
    specialists,
    projectId: row.project_id || null,
    hasProjectContext: Boolean(row.context_json),
    contextDigest: row.context_digest || null,
    status: row.cancelled_at ? 'cancelled' : row.status,
    attempts: row.attempts,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    cancelledAt: row.cancelled_at || null,
    executionAuthorized: Boolean(row.authorization_approval_id && row.execution_authorized_at),
    executionAuthorizedAt: row.execution_authorized_at || null,
    executionGrantId: row.authorization_grant_id || null,
    plan,
    errorCode: row.error_code || null,
  };
  validateAgentRunRecord(record);
  return record;
}

function parseAgentRunStep(row) {
  if (!row) return null;
  const parseJson = (value, fallback) => {
    try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
  };
  const task = row.task_json ? JSON.parse(row.task_json) : null;
  if (task !== null) {
    validateAgentTaskEnvelope(task);
    if (task.runId !== row.agent_run_id || task.stepId !== row.id ||
        task.specialist !== row.specialist) {
      throw new TypeError('Persisted agent task envelope does not match its step.');
    }
  }
  return {
    id: row.id,
    stepIndex: row.step_index,
    specialist: row.specialist,
    status: row.status,
    attempts: row.attempts,
    step: parseJson(row.step_json, null),
    task,
    checkpoint: parseJson(row.checkpoint_json, {}),
    result: parseJson(row.result_json, null),
    errorCode: row.error_code || null,
    leaseUntil: row.lease_until || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function parseAgentRunWithSteps(env, row) {
  const run = parseAgentRun(row);
  if (!run) return null;
  const stepRows = await env.DB.prepare(
    'SELECT * FROM agent_run_steps WHERE agent_run_id = ? ORDER BY step_index'
  ).bind(row.id).all();
  run.steps = (stepRows.results || []).map(parseAgentRunStep);
  return run;
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
    "SELECT id FROM agent_runs WHERE status = 'running' AND cancelled_at IS NULL AND lease_until IS NOT NULL AND lease_until < ?"
  ).bind(now).all();
  for (const row of expired.results || []) {
    const recovered = await env.DB.prepare(
      "UPDATE agent_runs SET status = 'pending_dispatch', lease_until = NULL, updated_at = ? WHERE id = ? AND status = 'running' AND cancelled_at IS NULL AND lease_until < ?"
    ).bind(now, row.id, now).run();
    if (recovered.meta?.changes) await auditAgentRun(env, row.id, 'lease_expired');
  }
  const pending = await env.DB.prepare(
    "SELECT id FROM agent_runs WHERE status = 'pending_dispatch' AND cancelled_at IS NULL ORDER BY created_at ASC LIMIT ?"
  ).bind(Math.max(1, Math.min(100, limit))).all();
  let dispatched = 0;
  for (const row of pending.results || []) {
    try {
      await env.JOBS.send({ agentRunId: row.id });
      const updated = await env.DB.prepare(
        "UPDATE agent_runs SET status = 'queued', lease_until = NULL, updated_at = ? WHERE id = ? AND status = 'pending_dispatch' AND cancelled_at IS NULL"
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
  if (length > MAX_AGENT_RUN_BODY_BYTES) return json({ error: 'Request body is too large.' }, 413);
  let raw;
  try { raw = await readBoundedRequestText(request, MAX_AGENT_RUN_BODY_BYTES); } catch (error) {
    if (error instanceof RangeError) return json({ error: 'Request body is too large.' }, 413);
    return json({ error: 'Invalid JSON.' }, 400);
  }
  let input;
  try { input = JSON.parse(raw); } catch { return json({ error: 'Invalid JSON.' }, 400); }
  let submission;
  try { submission = validateAgentRunSubmission(input); } catch (error) {
    return json({ error: error.message }, 400);
  }
  if (submission.projectContext) {
    try {
      const expectedDigest = await digestProjectBrief(submission.projectContext.brief);
      if (expectedDigest !== submission.projectContext.digest) {
        return json({ error: 'Project context digest does not match its contents.' }, 400);
      }
      if (submission.projectContext.knowledge !== undefined) {
        const expectedKnowledgeDigest = await digestCanonicalInput(submission.projectContext.knowledge);
        if (expectedKnowledgeDigest !== submission.projectContext.knowledgeDigest) {
          return json({ error: 'Forge knowledge digest does not match its contents.' }, 400);
        }
      }
    } catch {
      return json({ error: 'Project context could not be verified.' }, 400);
    }
  }
  const projectId = submission.projectContext?.brief.workspace.id || null;
  const contextDigest = submission.projectContext
    ? (submission.projectContext.knowledge === undefined
      ? submission.projectContext.digest
      : await digestCanonicalInput({
        briefDigest: submission.projectContext.digest,
        knowledgeDigest: submission.projectContext.knowledgeDigest,
      }))
    : null;
  const contextJson = submission.projectContext ? JSON.stringify(submission.projectContext) : null;
  const idempotencyKey = request.headers.get('Idempotency-Key');
  if (idempotencyKey && !/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) {
    return json({ error: 'Idempotency-Key must be 8–128 safe characters.' }, 400);
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO agent_runs (id, objective, specialists_json, status, attempts, idempotency_key, created_at, updated_at, project_id, context_digest, context_json) VALUES (?, ?, ?, 'pending_dispatch', 0, ?, ?, ?, ?, ?, ?) ON CONFLICT(idempotency_key) DO NOTHING"
    ).bind(id, submission.objective, JSON.stringify(submission.specialists), idempotencyKey || null, now, now, projectId, contextDigest, contextJson),
    env.DB.prepare(
      "INSERT INTO agent_run_events (event_id, agent_run_id, event_type, detail_json, created_at) SELECT ?, id, 'created', '{}', ? FROM agent_runs WHERE id = ? ON CONFLICT(event_id) DO NOTHING"
    ).bind(crypto.randomUUID(), now, id),
  ]);
  const row = idempotencyKey
    ? await env.DB.prepare('SELECT * FROM agent_runs WHERE idempotency_key = ?').bind(idempotencyKey).first()
    : await env.DB.prepare('SELECT * FROM agent_runs WHERE id = ?').bind(id).first();
  if (!row) return json({ error: 'Agent run could not be persisted.' }, 500);
  const storedContextDigest = row.context_digest || null;
  if (row.objective !== submission.objective ||
      row.specialists_json !== JSON.stringify(submission.specialists) ||
      (row.project_id || null) !== projectId || storedContextDigest !== contextDigest) {
    return json({ error: 'Idempotency-Key was already used for a different agent run request.' }, 409);
  }
  if (row.status === 'pending_dispatch') {
    try {
      await env.JOBS.send({ agentRunId: row.id });
      const updated = await env.DB.prepare(
        "UPDATE agent_runs SET status = 'queued', lease_until = NULL, updated_at = ? WHERE id = ? AND status = 'pending_dispatch' AND cancelled_at IS NULL"
      ).bind(new Date().toISOString(), row.id).run();
      if (updated.meta?.changes) await auditAgentRun(env, row.id, 'queued');
    } catch {
      // The scheduled outbox sweep recovers this persisted run.
    }
  }
  const current = await env.DB.prepare('SELECT * FROM agent_runs WHERE id = ?').bind(row.id).first();
  return json({ run: parseAgentRun(current) }, current?.status === 'pending_dispatch' ? 202 : 201);
}


async function cancelAgentRun(env, id) {
  if (!isJobId(id)) return json({ error: 'Invalid agent run identifier.' }, 400);
  const row = await env.DB.prepare('SELECT * FROM agent_runs WHERE id = ?').bind(id).first();
  if (!row) return json({ error: 'Agent run not found.' }, 404);
  if (row.cancelled_at) return json({ run: await parseAgentRunWithSteps(env, row), cancelled: true });
  if (row.status === 'failed') {
    return json({ error: 'A failed agent run cannot be cancelled.', run: parseAgentRun(row) }, 409);
  }

  const now = new Date().toISOString();
  const results = await env.DB.batch([
    env.DB.prepare(
      "UPDATE agent_runs SET cancelled_at = ?, lease_until = NULL, updated_at = ? WHERE id = ? AND cancelled_at IS NULL AND status IN ('pending_dispatch', 'queued', 'running', 'planned')"
    ).bind(now, now, id),
    env.DB.prepare(
      "UPDATE agent_run_steps SET status = 'cancelled', lease_until = NULL, updated_at = ? WHERE agent_run_id = ? AND status IN ('planned', 'pending_dispatch', 'queued', 'running') AND EXISTS (SELECT 1 FROM agent_runs WHERE id = ? AND cancelled_at = ?)"
    ).bind(now, id, id, now),
    env.DB.prepare(
      "INSERT INTO agent_run_step_events (event_id, agent_run_step_id, agent_run_id, event_type, detail_json, created_at) SELECT 'cancelled:' || id, id, agent_run_id, 'cancelled', '{}', ? FROM agent_run_steps WHERE agent_run_id = ? AND status = 'cancelled' AND EXISTS (SELECT 1 FROM agent_runs WHERE id = ? AND cancelled_at = ?) ON CONFLICT(event_id) DO NOTHING"
    ).bind(now, id, id, now),
  ]);
  const updated = results[0];
  if (!updated.meta?.changes) {
    const current = await env.DB.prepare('SELECT * FROM agent_runs WHERE id = ?').bind(id).first();
    if (!current) return json({ error: 'Agent run not found.' }, 404);
    if (current.cancelled_at) return json({ run: await parseAgentRunWithSteps(env, current), cancelled: true });
    return json({ error: 'Agent run is no longer cancellable.', run: parseAgentRun(current) }, 409);
  }

  await auditAgentRun(env, id, 'cancelled', {}, 'cancelled:' + id);
  const current = await env.DB.prepare('SELECT * FROM agent_runs WHERE id = ?').bind(id).first();
  return json({ run: await parseAgentRunWithSteps(env, current), cancelled: true });
}


async function listAgentRuns(request, env) {
  if (!agentRunsEnabled(env)) return json({ error: 'Agent orchestration is not enabled.' }, 503);
  if (!env?.DB || typeof env.DB.prepare !== 'function') return json({ error: 'Database is not configured.' }, 503);
  const params = new URL(request.url).searchParams;
  const allowed = new Set(['limit', 'before', 'beforeId']);
  for (const key of params.keys()) {
    if (!allowed.has(key) || params.getAll(key).length !== 1) {
      return json({ error: 'Invalid agent run list query.' }, 400);
    }
  }

  const limitText = params.get('limit') ?? '20';
  if (!/^(?:[1-9]|[1-4][0-9]|50)$/.test(limitText)) {
    return json({ error: 'Agent run list limit must be between 1 and 50.' }, 400);
  }
  const limit = Number(limitText);
  const before = params.get('before');
  const beforeId = params.get('beforeId');
  if ((before === null) !== (beforeId === null)) {
    return json({ error: 'Both before and beforeId are required for cursor pagination.' }, 400);
  }
  if (before !== null) {
    const time = Date.parse(before);
    if (!Number.isFinite(time) || new Date(time).toISOString() !== before || !isJobId(beforeId)) {
      return json({ error: 'Invalid agent run list cursor.' }, 400);
    }
  }

  const result = before === null
    ? await env.DB.prepare(
      'SELECT * FROM agent_runs ORDER BY created_at DESC, id DESC LIMIT ?'
    ).bind(limit + 1).all()
    : await env.DB.prepare(
      'SELECT * FROM agent_runs WHERE created_at < ? OR (created_at = ? AND id < ?) ORDER BY created_at DESC, id DESC LIMIT ?'
    ).bind(before, before, beforeId, limit + 1).all();

  const rows = result.results || [];
  const hasMore = rows.length > limit;
  const visible = rows.slice(0, limit);
  const last = visible[visible.length - 1];
  return json({
    runs: visible.map(parseAgentRun),
    nextCursor: hasMore && last
      ? { before: last.created_at, beforeId: last.id }
      : null,
  });
}

async function listAgentRunEvents(request, env, runId) {
  if (!agentRunsEnabled(env)) return json({ error: 'Agent orchestration is not enabled.' }, 503);
  if (!env?.DB || typeof env.DB.prepare !== 'function') return json({ error: 'Database is not configured.' }, 503);
  if (!isJobId(runId)) return json({ error: 'Invalid agent run identifier.' }, 400);
  const run = await env.DB.prepare('SELECT id FROM agent_runs WHERE id = ?').bind(runId).first();
  if (!run) return json({ error: 'Agent run not found.' }, 404);

  const params = new URL(request.url).searchParams;
  const allowed = new Set(['limit', 'before', 'beforeId']);
  for (const key of params.keys()) {
    if (!allowed.has(key) || params.getAll(key).length !== 1) {
      return json({ error: 'Invalid agent run event query.' }, 400);
    }
  }
  const limitText = params.get('limit') ?? '20';
  if (!/^(?:[1-9]|[1-4][0-9]|50)$/.test(limitText)) {
    return json({ error: 'Agent run event limit must be between 1 and 50.' }, 400);
  }
  const limit = Number(limitText);
  const before = params.get('before');
  const beforeId = params.get('beforeId');
  if ((before === null) !== (beforeId === null)) {
    return json({ error: 'Both before and beforeId are required for event pagination.' }, 400);
  }
  if (before !== null) {
    const time = Date.parse(before);
    if (!Number.isFinite(time) || new Date(time).toISOString() !== before ||
        typeof beforeId !== 'string' || !/^[A-Za-z0-9:_-]{1,180}$/.test(beforeId)) {
      return json({ error: 'Invalid agent run event cursor.' }, 400);
    }
  }

  const result = before === null
    ? await env.DB.prepare(
      'SELECT event_id, event_type, detail_json, created_at FROM agent_run_events WHERE agent_run_id = ? ORDER BY created_at DESC, event_id DESC LIMIT ?'
    ).bind(runId, limit + 1).all()
    : await env.DB.prepare(
      'SELECT event_id, event_type, detail_json, created_at FROM agent_run_events WHERE agent_run_id = ? AND (created_at < ? OR (created_at = ? AND event_id < ?)) ORDER BY created_at DESC, event_id DESC LIMIT ?'
    ).bind(runId, before, before, beforeId, limit + 1).all();

  const rows = result.results || [];
  const hasMore = rows.length > limit;
  const visible = rows.slice(0, limit);
  const events = visible.map((row) => {
    if (typeof row.event_id !== 'string' || !/^[A-Za-z0-9:_-]{1,180}$/.test(row.event_id) ||
        typeof row.event_type !== 'string' || !/^[a-z][a-z0-9_]{0,63}$/.test(row.event_type)) {
      throw new Error('Invalid persisted agent run event.');
    }
    let detail = {};
    if (typeof row.detail_json === 'string' && row.detail_json.length <= 4096) {
      try {
        const parsed = JSON.parse(row.detail_json);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) detail = parsed;
      } catch { /* Keep malformed event detail redacted. */ }
    }
    return {
      id: row.event_id,
      type: row.event_type,
      detail,
      createdAt: row.created_at,
    };
  });
  const last = visible[visible.length - 1];
  return json({
    events,
    nextCursor: hasMore && last
      ? { before: last.created_at, beforeId: last.event_id }
      : null,
  });
}

async function authorizeAgentRun(request, env, id) {
  if (!agentRunsEnabled(env)) return json({ error: 'Agent orchestration is not enabled.' }, 503);
  if (!env?.DB || typeof env.DB.prepare !== 'function') return json({ error: 'Database is not configured.' }, 503);
  if (!isJobId(id)) return json({ error: 'Invalid agent run identifier.' }, 400);
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || '')) {
    return json({ error: 'Content-Type must be application/json.' }, 415);
  }
  const length = Number(request.headers.get('Content-Length') || 0);
  if (length > 2048) return json({ error: 'Request body is too large.' }, 413);
  let raw;
  try { raw = await readBoundedRequestText(request, 2048); } catch (error) {
    if (error instanceof RangeError) return json({ error: 'Request body is too large.' }, 413);
    return json({ error: 'Invalid JSON.' }, 400);
  }
  let body;
  try { body = JSON.parse(raw); } catch { return json({ error: 'Invalid JSON.' }, 400); }
  const keys = ['approvalId', 'capabilityId', 'capabilityVersion', 'actionId', 'inputDigest', 'grantId'];
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).length !== keys.length || Object.keys(body).some((key) => !keys.includes(key)) ||
      typeof body.approvalId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(body.approvalId) ||
      typeof body.capabilityId !== 'string' || typeof body.capabilityVersion !== 'string' ||
      typeof body.actionId !== 'string' || typeof body.inputDigest !== 'string' ||
      typeof body.grantId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(body.grantId) ||
      !/^sha256:[a-f0-9]{64}$/i.test(body.inputDigest)) {
    return json({ error: 'Invalid execution authorisation binding.' }, 400);
  }
  const row = await env.DB.prepare('SELECT * FROM agent_runs WHERE id = ?').bind(id).first();
  if (!row) return json({ error: 'Agent run not found.' }, 404);
  if (row.cancelled_at || row.status !== 'planned' || !row.plan_json) {
    return json({ error: 'Only an active planned run can be authorised.' }, 409);
  }
  let plan;
  try { plan = JSON.parse(row.plan_json); } catch {
    return json({ error: 'Persisted agent plan is invalid.' }, 409);
  }
  let expected;
  try { expected = await buildAgentPlanApprovalBinding(plan, 'owner'); } catch {
    return json({ error: 'Agent plan does not meet the registered approval policy.' }, 409);
  }
  if (body.capabilityId !== expected.capabilityId ||
      body.capabilityVersion !== expected.capabilityVersion ||
      body.actionId !== expected.actionId ||
      body.inputDigest !== expected.inputDigest) {
    return json({ error: 'Execution authorisation does not match the persisted plan and capability.' }, 409);
  }
  if (row.authorization_approval_id && row.authorization_approval_id !== body.approvalId) {
    return json({ error: 'This run has already consumed a different approval.' }, 409);
  }
  const now = new Date().toISOString();
  const authorised = await env.DB.prepare(`
    UPDATE agent_runs
    SET authorization_approval_id = COALESCE(authorization_approval_id, ?),
        execution_authorized_at = COALESCE(execution_authorized_at, ?),
        authorization_grant_id = COALESCE(authorization_grant_id, ?),
        updated_at = ?
    WHERE id = ? AND status = 'planned' AND cancelled_at IS NULL
      AND (authorization_approval_id IS NULL OR authorization_approval_id = ?)
      AND (authorization_grant_id IS NULL OR authorization_grant_id = ?)
    RETURNING *
  `).bind(body.approvalId, now, body.grantId, now, id, body.approvalId, body.grantId).first();
  if (!authorised) return json({ error: 'Agent run changed before authorisation could be recorded.' }, 409);
  await auditAgentRun(env, id, 'execution_authorized', {
    approvalId: body.approvalId,
    grantId: body.grantId,
    capabilityId: expected.capabilityId,
    capabilityVersion: expected.capabilityVersion,
    actionId: expected.actionId,
    inputDigest: expected.inputDigest,
  }, 'execution-authorized:' + id + ':' + body.approvalId);
  return json({ run: parseAgentRun(authorised), authorised: true, executionStarted: false });
}

async function getAgentRun(env, id) {
  if (!isJobId(id)) return json({ error: 'Invalid agent run identifier.' }, 400);
  const row = await env.DB.prepare('SELECT * FROM agent_runs WHERE id = ?').bind(id).first();
  if (!row) return json({ error: 'Agent run not found.' }, 404);
  return json({ run: await parseAgentRunWithSteps(env, row) });
}

async function processAgentRun(message, env) {
  const runId = message?.body?.agentRunId;
  if (!isJobId(runId)) { message.ack(); return; }
  const row = await env.DB.prepare('SELECT * FROM agent_runs WHERE id = ?').bind(runId).first();
  if (!row || row.cancelled_at || ['planned', 'failed', 'running'].includes(row.status) ||
      !['queued', 'pending_dispatch'].includes(row.status)) { message.ack(); return; }
  const startedAt = new Date().toISOString();
  const claim = await env.DB.prepare(
    "UPDATE agent_runs SET status = 'running', attempts = attempts + 1, lease_until = ?, updated_at = ? WHERE id = ? AND status IN ('queued', 'pending_dispatch') AND cancelled_at IS NULL RETURNING attempts"
  ).bind(new Date(Date.now() + 120_000).toISOString(), startedAt, runId).first();
  if (!claim) { message.ack(); return; }
  const attempt = Number(claim.attempts);
  await auditAgentRun(env, runId, 'running', { attempt });
  try {
    const specialists = JSON.parse(row.specialists_json);
    let projectContext;
    try {
      const hasContextJson = typeof row.context_json === 'string' && row.context_json.length > 0;
      const hasContextDigest = typeof row.context_digest === 'string' && row.context_digest.length > 0;
      const hasProjectBinding = typeof row.project_id === 'string' && row.project_id.length > 0;
      if (hasContextJson !== hasContextDigest || hasContextJson !== hasProjectBinding) {
        throw new Error('Persisted project context binding is incomplete.');
      }
      projectContext = hasContextJson ? JSON.parse(row.context_json) : undefined;
      if (hasContextJson && (!projectContext ||
          projectContext.brief?.workspace?.id !== row.project_id)) {
        throw new Error('Persisted project context does not match its project binding.');
      }
      const expectedContextDigest = projectContext
        ? (projectContext.knowledge === undefined
          ? projectContext.digest
          : await digestCanonicalInput({
            briefDigest: projectContext.digest,
            knowledgeDigest: projectContext.knowledgeDigest,
          }))
        : null;
      if (projectContext && (row.context_digest !== expectedContextDigest ||
          await digestProjectBrief(projectContext.brief) !== projectContext.digest ||
          (projectContext.knowledge !== undefined &&
            await digestCanonicalInput(projectContext.knowledge) !== projectContext.knowledgeDigest))) {
        throw new Error('Context digest mismatch.');
      }
    } catch {
      const integrityError = new Error('Persisted agent context failed integrity verification.');
      integrityError.code = 'AGENT_CONTEXT_INTEGRITY_FAILED';
      throw integrityError;
    }
    const plan = createAgentPlan({
      objective: row.objective,
      specialists,
      ...(projectContext ? { projectContext } : {}),
    }, { runId, createdAt: row.created_at });
    const planJson = JSON.stringify(plan);
    const completedAt = new Date().toISOString();
    const statements = [env.DB.prepare(
      "UPDATE agent_runs SET status = 'planned', plan_json = ?, error_code = NULL, lease_until = NULL, updated_at = ? WHERE id = ? AND status = 'running' AND attempts = ? AND cancelled_at IS NULL"
    ).bind(planJson, completedAt, runId, attempt)];

    for (const [index, step] of plan.steps.entries()) {
      const taskEnvelope = createAgentTaskEnvelope(plan, {
        stepId: step.id,
        attempt: 1,
        createdAt: completedAt,
      });
      statements.push(env.DB.prepare(
        "INSERT INTO agent_run_steps (id, agent_run_id, step_index, specialist, status, attempts, step_json, task_json, checkpoint_json, created_at, updated_at) SELECT ?, id, ?, ?, 'planned', 0, ?, ?, '{}', ?, ? FROM agent_runs WHERE id = ? AND status = 'planned' AND attempts = ? AND cancelled_at IS NULL AND plan_json = ? ON CONFLICT(id) DO NOTHING"
      ).bind(step.id, index + 1, step.specialist, JSON.stringify(step), JSON.stringify(taskEnvelope), completedAt, completedAt, runId, attempt, planJson));
      statements.push(env.DB.prepare(
        "INSERT INTO agent_run_step_events (event_id, agent_run_step_id, agent_run_id, event_type, detail_json, created_at) SELECT ?, id, agent_run_id, 'planned', ?, ? FROM agent_run_steps WHERE id = ? AND agent_run_id = ? ON CONFLICT(event_id) DO NOTHING"
      ).bind('planned:' + step.id, JSON.stringify({ stepIndex: index + 1, specialist: step.specialist }), completedAt, step.id, runId));
    }

    const results = await env.DB.batch(statements);
    if (results[0]?.meta?.changes) {
      await auditAgentRun(env, runId, 'planned', { steps: plan.steps.length, execution: 'plan-only' });
    }
    message.ack();
  } catch (error) {
    if (error?.code === 'AGENT_CONTEXT_INTEGRITY_FAILED') {
      const failed = await env.DB.prepare(
        "UPDATE agent_runs SET status = 'failed', error_code = 'AGENT_CONTEXT_INTEGRITY_FAILED', lease_until = NULL, updated_at = ? WHERE id = ? AND status = 'running' AND attempts = ? AND cancelled_at IS NULL"
      ).bind(new Date().toISOString(), runId, attempt).run();
      if (failed.meta?.changes) {
        await auditAgentRun(env, runId, 'failed', { code: 'AGENT_CONTEXT_INTEGRITY_FAILED', attempt });
      }
      message.ack();
      return;
    }
    if (attempt >= MAX_ATTEMPTS) {
      const failed = await env.DB.prepare(
        "UPDATE agent_runs SET status = 'failed', error_code = 'AGENT_PLAN_FAILED', lease_until = NULL, updated_at = ? WHERE id = ? AND status = 'running' AND attempts = ? AND cancelled_at IS NULL"
      ).bind(new Date().toISOString(), runId, attempt).run();
      if (failed.meta?.changes) await auditAgentRun(env, runId, 'failed', { code: 'AGENT_PLAN_FAILED', attempt });
      message.ack();
    } else {
      const retry = await env.DB.prepare(
        "UPDATE agent_runs SET status = 'queued', error_code = 'AGENT_PLAN_RETRY', lease_until = NULL, updated_at = ? WHERE id = ? AND status = 'running' AND attempts = ? AND cancelled_at IS NULL"
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
    "UPDATE agent_runs SET status = 'failed', error_code = 'AGENT_DELIVERY_EXHAUSTED', lease_until = NULL, updated_at = ? WHERE id = ? AND cancelled_at IS NULL AND (status IN ('queued', 'pending_dispatch') OR (status = 'running' AND (lease_until IS NULL OR lease_until <= ?)))"
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
  if (url.pathname === '/v1/agent-runs' && request.method === 'POST') return submitAgentRun(request, env);
  if (request.method === 'POST' && url.pathname.startsWith('/v1/agent-runs/') && url.pathname.endsWith('/cancel')) {
    if (!agentRunsEnabled(env)) return json({ error: 'Agent orchestration is not enabled.' }, 503);
    if (!env?.DB || typeof env.DB.prepare !== 'function') return json({ error: 'Database is not configured.' }, 503);
    const id = url.pathname.slice('/v1/agent-runs/'.length, -'/cancel'.length);
    return cancelAgentRun(env, id);
  }
  if (request.method === 'GET' && url.pathname === '/v1/agent-runs') return listAgentRuns(request, env);
  if (request.method === 'POST' && url.pathname.startsWith('/v1/agent-runs/') && url.pathname.endsWith('/authorize')) {
    const id = url.pathname.slice('/v1/agent-runs/'.length, -'/authorize'.length);
    return authorizeAgentRun(request, env, id);
  }
  if (request.method === 'GET' && url.pathname.startsWith('/v1/agent-runs/') && url.pathname.endsWith('/events')) {
    if (!agentRunsEnabled(env)) return json({ error: 'Agent orchestration is not enabled.' }, 503);
    if (!env?.DB || typeof env.DB.prepare !== 'function') return json({ error: 'Database is not configured.' }, 503);
    const id = url.pathname.slice('/v1/agent-runs/'.length, -'/events'.length);
    return listAgentRunEvents(request, env, id);
  }
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
