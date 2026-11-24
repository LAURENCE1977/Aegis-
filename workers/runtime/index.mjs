import { createAgentPlan, validateAgentRunSubmission, createAgentCapabilityProposal } from './agents.mjs';
import { hashDeviceToken, readDeviceToken } from './devices.mjs';
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
  try { specialists = JSON.parse(row.specialists_json); } catch { specialists = []; }
  return {
    id: row.id,
    objective: row.objective,
    specialists,
    status: row.status,
    attempts: row.attempts,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    plan,
    errorCode: row.error_code || null,
  };
}

function parseCapabilityProposal(row) {
  if (!row) return null;
  let requiredScopes = [];
  try { requiredScopes = JSON.parse(row.required_scopes_json); } catch { requiredScopes = []; }
  return {
    id: row.proposal_id,
    runId: row.agent_run_id,
    principalId: row.principal_id,
    capabilityId: row.capability_id,
    capabilityVersion: row.capability_version,
    actionId: row.action_id,
    resourceId: row.resource_id,
    inputDigest: row.input_digest,
    requiredScopes,
    effect: row.effect,
    risk: row.risk,
    approval: row.approval,
    status: row.status,
    execution: row.execution,
    createdAt: row.created_at,
    decision: row.decision ? { decision: row.decision, principalId: row.decision_principal_id, reason: row.decision_reason || null, createdAt: row.decision_created_at } : null,
  };
}

async function auditAgentRun(env, runId, eventType, detail = {}, eventId = crypto.randomUUID()) {
  await env.DB.prepare(
    'INSERT INTO agent_run_events (event_id, agent_run_id, event_type, detail_json, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(event_id) DO NOTHING'
  ).bind(eventId, runId, eventType, JSON.stringify(detail), new Date().toISOString()).run();
}

async function transitionAgentRun(env, updateSql, updateValues, {
  runId, status, updatedAt, eventType, detail = {}, eventId = crypto.randomUUID(),
}) {
  const [updated] = await env.DB.batch([
    env.DB.prepare(updateSql).bind(...updateValues),
    env.DB.prepare(
      "INSERT INTO agent_run_events (event_id, agent_run_id, event_type, detail_json, created_at) SELECT ?, id, ?, ?, ? FROM agent_runs WHERE changes() = 1 AND id = ? AND status = ? AND updated_at = ? ON CONFLICT(event_id) DO NOTHING"
    ).bind(eventId, eventType, JSON.stringify(detail), updatedAt, runId, status, updatedAt),
  ]);
  return Boolean(updated?.meta?.changes);
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
  ).bind(id, submission.objective, JSON.stringify(submission.specialists), idempotencyKey || null, now, now).run();
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

async function submitCapabilityProposal(request, env, runId) {
  if (!agentRunsEnabled(env)) return json({ error: 'Agent orchestration is not enabled.' }, 503);
  if (!env?.DB || typeof env.DB.prepare !== 'function') return json({ error: 'Runtime database is not configured.' }, 503);
  if (!isJobId(runId)) return json({ error: 'Invalid agent run identifier.' }, 400);
  const principalId = env.AEGIS_PRINCIPAL_ID;
  if (typeof principalId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(principalId)) {
    return json({ error: 'Trusted principal context is not configured.' }, 503);
  }
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || '')) {
    return json({ error: 'Content-Type must be application/json.' }, 415);
  }
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return json({ error: 'Request body is too large.' }, 413);
  let input;
  try { input = JSON.parse(raw); } catch { return json({ error: 'Invalid JSON.' }, 400); }
  const run = await env.DB.prepare('SELECT id, status FROM agent_runs WHERE id = ?').bind(runId).first();
  if (!run) return json({ error: 'Agent run not found.' }, 404);
  if (run.status !== 'planned') return json({ error: 'Capability proposals require a completed plan.' }, 409);

  let proposal;
  try {
    proposal = await createAgentCapabilityProposal(input, { runId, principalId });
  } catch (error) {
    return json({ error: error.message }, 400);
  }
  const createdAt = proposal.createdAt;
  const eventId = crypto.randomUUID();
  const [inserted] = await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO agent_capability_proposals (proposal_id, agent_run_id, principal_id, capability_id, capability_version, action_id, resource_id, input_digest, required_scopes_json, effect, risk, approval, status, execution, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'proposed', 'disabled', ?) ON CONFLICT(agent_run_id, capability_id, action_id, resource_id, input_digest) DO NOTHING"
    ).bind(
      proposal.proposalId, proposal.runId, proposal.principalId, proposal.capabilityId,
      proposal.capabilityVersion, proposal.actionId, proposal.resourceId, proposal.inputDigest,
      JSON.stringify(proposal.requiredScopes), proposal.effect, proposal.risk, proposal.approval, createdAt,
    ),
    env.DB.prepare(
      "INSERT INTO agent_run_events (event_id, agent_run_id, event_type, detail_json, created_at) SELECT ?, ?, 'capability_proposal_created', json_object('capabilityId', ?, 'actionId', ?, 'inputDigest', ?), ? WHERE changes() = 1 ON CONFLICT(event_id) DO NOTHING"
    ).bind(eventId, runId, proposal.capabilityId, proposal.actionId, proposal.inputDigest, createdAt),
  ]);
  const saved = await env.DB.prepare(
    'SELECT * FROM agent_capability_proposals WHERE agent_run_id = ? AND capability_id = ? AND action_id = ? AND resource_id = ? AND input_digest = ?'
  ).bind(runId, proposal.capabilityId, proposal.actionId, proposal.resourceId, proposal.inputDigest).first();
  if (!saved) return json({ error: 'Capability proposal could not be persisted.' }, 500);
  return json({ proposal: parseCapabilityProposal(saved) }, inserted?.meta?.changes ? 201 : 200);
}

async function getCapabilityProposals(env, runId) {
  if (!isJobId(runId)) return json({ error: 'Invalid agent run identifier.' }, 400);
  const run = await env.DB.prepare('SELECT id FROM agent_runs WHERE id = ?').bind(runId).first();
  if (!run) return json({ error: 'Agent run not found.' }, 404);
  const result = await env.DB.prepare(
    'SELECT p.*, d.decision, d.principal_id AS decision_principal_id, d.reason AS decision_reason, d.created_at AS decision_created_at FROM agent_capability_proposals p LEFT JOIN agent_capability_proposal_decisions d ON d.proposal_id = p.proposal_id WHERE p.agent_run_id = ? ORDER BY p.created_at ASC LIMIT 100'
  ).bind(runId).all();
  return json({ proposals: (result.results || []).map(parseCapabilityProposal) });
}

async function decideCapabilityProposal(request, env, runId, proposalId) {
  if (!agentRunsEnabled(env)) return json({ error: 'Agent orchestration is not enabled.' }, 503);
  if (!env?.DB || typeof env.DB.prepare !== 'function') return json({ error: 'Runtime database is not configured.' }, 503);
  if (!isJobId(runId) || !isJobId(proposalId)) return json({ error: 'Invalid proposal identifier.' }, 400);
  const principalId = env.AEGIS_PRINCIPAL_ID;
  if (typeof principalId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(principalId)) {
    return json({ error: 'Trusted principal context is not configured.' }, 503);
  }
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || '')) {
    return json({ error: 'Content-Type must be application/json.' }, 415);
  }
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > 1024) return json({ error: 'Request body is too large.' }, 413);
  let input;
  try { input = JSON.parse(raw); } catch { return json({ error: 'Invalid JSON.' }, 400); }
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).some((key) => !['decision', 'reason'].includes(key)) ||
      !['approved', 'rejected'].includes(input.decision) ||
      (input.reason !== undefined && (typeof input.reason !== 'string' || input.reason.length > 500))) {
    return json({ error: 'Invalid proposal decision.' }, 400);
  }
  const proposal = await env.DB.prepare(
    'SELECT proposal_id FROM agent_capability_proposals WHERE proposal_id = ? AND agent_run_id = ? AND principal_id = ?'
  ).bind(proposalId, runId, principalId).first();
  if (!proposal) return json({ error: 'Capability proposal not found.' }, 404);

  const createdAt = new Date().toISOString();
  const decisionId = crypto.randomUUID();
  const eventType = input.decision === 'approved'
    ? 'capability_proposal_approved' : 'capability_proposal_rejected';
  const [inserted] = await env.DB.batch([
    env.DB.prepare(
      'INSERT INTO agent_capability_proposal_decisions (decision_id, proposal_id, principal_id, decision, reason, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(proposal_id) DO NOTHING'
    ).bind(decisionId, proposalId, principalId, input.decision, input.reason || null, createdAt),
    env.DB.prepare(
      "INSERT INTO agent_run_events (event_id, agent_run_id, event_type, detail_json, created_at) SELECT ?, ?, ?, json_object('proposalId', ?), ? WHERE changes() = 1 ON CONFLICT(event_id) DO NOTHING"
    ).bind(crypto.randomUUID(), runId, eventType, proposalId, createdAt),
  ]);
  const saved = await env.DB.prepare(
    'SELECT * FROM agent_capability_proposal_decisions WHERE proposal_id = ?'
  ).bind(proposalId).first();
  if (!saved) return json({ error: 'Proposal decision could not be persisted.' }, 500);
  if (!inserted?.meta?.changes) return json({ error: 'This proposal already has a final decision.' }, 409);
  return json({
    decision: { id: saved.decision_id, proposalId: saved.proposal_id, principalId: saved.principal_id,
      decision: saved.decision, reason: saved.reason, createdAt: saved.created_at },
    execution: 'disabled',
  }, 201);
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
  const eventId = crypto.randomUUID();
  const [claimResult] = await env.DB.batch([
    env.DB.prepare(
      "UPDATE agent_runs SET status = 'running', attempts = attempts + 1, lease_until = ?, updated_at = ? WHERE id = ? AND status IN ('queued', 'pending_dispatch') RETURNING attempts"
    ).bind(new Date(Date.now() + 120_000).toISOString(), startedAt, runId),
    env.DB.prepare(
      "INSERT INTO agent_run_events (event_id, agent_run_id, event_type, detail_json, created_at) SELECT ?, id, 'running', json_object('attempt', attempts), ? FROM agent_runs WHERE changes() = 1 AND id = ? AND status = 'running' AND updated_at = ? ON CONFLICT(event_id) DO NOTHING"
    ).bind(eventId, startedAt, runId, startedAt),
  ]);
  const claim = claimResult?.results?.[0] || null;
  if (!claim) { message.ack(); return; }
  const attempt = Number(claim.attempts);
  try {
    const specialists = JSON.parse(row.specialists_json);
    const plan = createAgentPlan({ objective: row.objective, specialists }, { runId, createdAt: row.created_at });
    const completedAt = new Date().toISOString();
    await transitionAgentRun(env,
      "UPDATE agent_runs SET status = 'planned', plan_json = ?, error_code = NULL, lease_until = NULL, updated_at = ? WHERE id = ? AND status = 'running' AND attempts = ?",
      [JSON.stringify(plan), completedAt, runId, attempt],
      { runId, status: 'planned', updatedAt: completedAt, eventType: 'planned',
        detail: { steps: plan.steps.length, execution: 'plan-only' } },
    );
    message.ack();
  } catch {
    if (attempt >= MAX_ATTEMPTS) {
      const failedAt = new Date().toISOString();
      await transitionAgentRun(env,
        "UPDATE agent_runs SET status = 'failed', error_code = 'AGENT_PLAN_FAILED', lease_until = NULL, updated_at = ? WHERE id = ? AND status = 'running' AND attempts = ?",
        [failedAt, runId, attempt],
        { runId, status: 'failed', updatedAt: failedAt, eventType: 'failed',
          detail: { code: 'AGENT_PLAN_FAILED', attempt } },
      );
      message.ack();
    } else {
      const retryAt = new Date().toISOString();
      const transitioned = await transitionAgentRun(env,
        "UPDATE agent_runs SET status = 'queued', error_code = 'AGENT_PLAN_RETRY', lease_until = NULL, updated_at = ? WHERE id = ? AND status = 'running' AND attempts = ?",
        [retryAt, runId, attempt],
        { runId, status: 'queued', updatedAt: retryAt, eventType: 'retry_scheduled', detail: { attempt } },
      );
      if (!transitioned) { message.ack(); return; }
      message.retry({ delaySeconds: Math.min(300, 2 ** attempt * 5) });
    }
  }
}

async function processAgentDeadLetter(message, env) {
  const runId = message?.body?.agentRunId;
  if (!isJobId(runId)) { message.ack(); return; }
  const now = new Date().toISOString();
  await transitionAgentRun(env,
    "UPDATE agent_runs SET status = 'failed', error_code = 'AGENT_DELIVERY_EXHAUSTED', lease_until = NULL, updated_at = ? WHERE id = ? AND (status IN ('queued', 'pending_dispatch') OR (status = 'running' AND (lease_until IS NULL OR lease_until <= ?)))",
    [now, runId, now],
    { runId, status: 'failed', updatedAt: now, eventType: 'delivery_exhausted',
      detail: { code: 'AGENT_DELIVERY_EXHAUSTED' }, eventId: 'delivery-exhausted:' + runId },
  );
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

async function getDeviceAgentRuns(request, env, deviceId) {
  if (!isJobId(deviceId)) return json({ error: 'Invalid device identifier.' }, 400);
  if (!env?.DB || typeof env.DB.prepare !== 'function') {
    return json({ error: 'Runtime database is not configured.' }, 503);
  }
  if (!agentRunsEnabled(env)) return json({ error: 'Agent orchestration is not enabled.' }, 503);

  const token = readDeviceToken(request);
  if (!token) return json({ error: 'Device authentication required.' }, 401);
  try {
    const tokenHash = await hashDeviceToken(token);
    const device = await env.DB.prepare(
      "SELECT id, capabilities_json FROM devices WHERE id = ? AND token_hash = ? AND status = 'active'"
    ).bind(deviceId, tokenHash).first();
    if (!device) return json({ error: 'Device credential is invalid or revoked.' }, 401);

    let capabilities = [];
    try { capabilities = JSON.parse(device.capabilities_json); } catch { capabilities = []; }
    if (!Array.isArray(capabilities) || !capabilities.includes('aegis.jobs.observe')) {
      return json({ error: 'Device is not authorised to observe agent plans.' }, 403);
    }

    const result = await env.DB.prepare(
      'SELECT id, objective, status, plan_json, created_at, updated_at FROM agent_runs WHERE assigned_device_id = ? ORDER BY created_at DESC LIMIT 50'
    ).bind(deviceId).all();
    const agentRuns = (result.results || []).map((row) => {
      let plan = null;
      try { plan = row.plan_json ? JSON.parse(row.plan_json) : null; } catch { plan = null; }
      return {
        id: row.id,
        objective: row.objective,
        status: row.status,
        plan,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });
    return json({ agentRuns });
  } catch {
    return json({ error: 'Assigned agent plans are temporarily unavailable.' }, 503);
  }
}

export async function handleRuntimeFetch(request, env) {
  const url = new URL(request.url);
  const deviceAgentRuns = /^\/v1\/devices\/([^/]+)\/agent-runs$/.exec(url.pathname);
  if (request.method === 'GET' && deviceAgentRuns) {
    if (!originAllowed(request)) return json({ error: 'Origin is not allowed.' }, 403);
    return getDeviceAgentRuns(request, env, deviceAgentRuns[1]);
  }
  if (!env || typeof env.AEGIS_JOB_TOKEN !== 'string' || env.AEGIS_JOB_TOKEN.length < 32) {
    return json({ error: 'Runtime authentication is not configured.' }, 503);
  }
  if (!originAllowed(request)) return json({ error: 'Origin is not allowed.' }, 403);
  if (!isAuthorized(request, env)) {
    return json({ error: 'Authentication required.' }, 401, { 'WWW-Authenticate': 'Bearer' });
  }

  if (url.pathname === '/v1/jobs' && request.method === 'POST') return submitJob(request, env);
  if (url.pathname === '/v1/agent-runs' && request.method === 'POST') return submitAgentRun(request, env);
  const decisionRoute = /^\/v1\/agent-runs\/([^/]+)\/capability-proposals\/([^/]+)\/decision$/.exec(url.pathname);
  if (decisionRoute && request.method === 'POST') {
    return decideCapabilityProposal(request, env, decisionRoute[1], decisionRoute[2]);
  }
  const proposalRoute = /^\/v1\/agent-runs\/([^/]+)\/capability-proposals$/.exec(url.pathname);
  if (proposalRoute && request.method === 'POST') return submitCapabilityProposal(request, env, proposalRoute[1]);
  if (proposalRoute && request.method === 'GET') {
    if (!agentRunsEnabled(env)) return json({ error: 'Agent orchestration is not enabled.' }, 503);
    if (!env?.DB || typeof env.DB.prepare !== 'function') return json({ error: 'Database is not configured.' }, 503);
    return getCapabilityProposals(env, proposalRoute[1]);
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
  const eventId = crypto.randomUUID();
  const [claimResult] = await env.DB.batch([
    env.DB.prepare(
      "UPDATE jobs SET status = 'running', attempts = attempts + 1, lease_until = ?, updated_at = ? WHERE id = ? AND status IN ('queued', 'pending_dispatch') RETURNING attempts"
    ).bind(new Date(Date.now() + 120_000).toISOString(), startedAt, jobId),
    env.DB.prepare(
      "INSERT INTO job_events (event_id, job_id, event_type, detail_json, created_at) SELECT ?, id, 'running', json_object('attempt', attempts), ? FROM jobs WHERE changes() = 1 AND id = ? AND status = 'running' AND updated_at = ? ON CONFLICT(event_id) DO NOTHING"
    ).bind(eventId, startedAt, jobId, startedAt),
  ]);
  const claim = claimResult?.results?.[0] || null;
  if (!claim) {
    message.ack();
    return;
  }
  const attempt = Number(claim.attempts);

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
