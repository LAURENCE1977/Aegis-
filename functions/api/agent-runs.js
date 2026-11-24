import {
  authorizeOwner,
  isOwnerWriteRequest,
  jsonResponse,
  readJsonRequest,
} from '../lib/owner-api.mjs';
import { validateAgentRunSubmission } from '../../workers/runtime/agents.mjs';

const MAX_RUNS = 50;
const MAX_SUBMISSION_BYTES = 8 * 1024;
const MAX_RUNTIME_RESPONSE_BYTES = 16 * 1024;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

function databaseReady(env) {
  return Boolean(env?.AEGIS_DB && typeof env.AEGIS_DB.prepare === 'function');
}

function runtimeReady(env) {
  return Boolean(
    env?.AEGIS_RUNTIME && typeof env.AEGIS_RUNTIME.fetch === 'function' &&
    typeof env?.AEGIS_JOB_TOKEN === 'string' && env.AEGIS_JOB_TOKEN.length >= 32
  );
}

function safePlan(value) {
  if (typeof value !== 'string' || !value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function publicRun(run) {
  if (!run || typeof run !== 'object' || Array.isArray(run) ||
      typeof run.id !== 'string' || typeof run.objective !== 'string' ||
      typeof run.status !== 'string') return null;
  return {
    id: run.id,
    objective: run.objective,
    specialists: Array.isArray(run.specialists) ? run.specialists.filter((item) => typeof item === 'string') : [],
    status: run.status,
    attempts: Number.isSafeInteger(run.attempts) ? run.attempts : 0,
    createdAt: typeof run.createdAt === 'string' ? run.createdAt : null,
    updatedAt: typeof run.updatedAt === 'string' ? run.updatedAt : null,
    plan: run.plan && typeof run.plan === 'object' && !Array.isArray(run.plan) ? run.plan : null,
    errorCode: typeof run.errorCode === 'string' ? run.errorCode : null,
  };
}

async function readBoundedResponse(response) {
  const declaredLength = Number(response.headers.get('Content-Length') || 0);
  if (declaredLength > MAX_RUNTIME_RESPONSE_BYTES) return null;
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RUNTIME_RESPONSE_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export async function onRequestGet({ request, env }) {
  const denied = await authorizeOwner(request, env);
  if (denied) return denied;
  if (!databaseReady(env)) {
    return jsonResponse({ error: 'Agent-run inventory is not configured.' }, 503);
  }

  try {
    // AEGIS currently has one owner identity. Keep this endpoint owner-authenticated
    // and expose only the bounded public run projection, never storage internals.
    const result = await env.AEGIS_DB.prepare(
      'SELECT id, objective, status, plan_json, assigned_device_id, created_at, updated_at FROM agent_runs ORDER BY created_at DESC LIMIT 50'
    ).all();

    const agentRuns = (result.results || []).slice(0, MAX_RUNS).map((row) => ({
      id: row.id,
      objective: row.objective,
      status: row.status,
      plan: safePlan(row.plan_json),
      assignedDeviceId: row.assigned_device_id || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return jsonResponse({ agentRuns });
  } catch {
    return jsonResponse({ error: 'Agent-run inventory is temporarily unavailable.' }, 503);
  }
}

export async function onRequestPost({ request, env }) {
  const denied = await authorizeOwner(request, env);
  if (denied) return denied;
  if (!isOwnerWriteRequest(request)) {
    return jsonResponse({ error: 'Same-origin request required.' }, 403);
  }
  if (!runtimeReady(env)) {
    return jsonResponse({ error: 'Agent runtime connection is not configured.' }, 503);
  }

  const parsed = await readJsonRequest(request, MAX_SUBMISSION_BYTES);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status);

  let submission;
  try {
    submission = validateAgentRunSubmission(parsed.body);
  } catch (error) {
    return jsonResponse({ error: error.message }, 400);
  }

  const idempotencyKey = request.headers.get('Idempotency-Key');
  if (!idempotencyKey || !IDEMPOTENCY_PATTERN.test(idempotencyKey)) {
    return jsonResponse({ error: 'A valid Idempotency-Key header is required.' }, 400);
  }

  try {
    const upstream = await env.AEGIS_RUNTIME.fetch(new Request(
      'https://aegis-runtime.internal/v1/agent-runs',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + env.AEGIS_JOB_TOKEN,
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(submission),
      },
    ));

    const raw = await readBoundedResponse(upstream);
    if (raw === null) return jsonResponse({ error: 'Agent runtime returned an invalid response.' }, 502);

    let body;
    try { body = JSON.parse(raw); } catch {
      return jsonResponse({ error: 'Agent runtime returned an invalid response.' }, 502);
    }

    if (upstream.status !== 201 && upstream.status !== 202) {
      const messages = {
        400: 'Agent runtime rejected the task details.',
        401: 'Agent runtime authentication is not configured correctly.',
        409: 'This task submission conflicts with an existing request.',
        503: 'Agent orchestration is not enabled or the runtime is unavailable.',
      };
      const status = [400, 401, 409, 413, 415, 429, 503].includes(upstream.status)
        ? upstream.status : 502;
      return jsonResponse({
        error: messages[upstream.status] || 'Agent runtime could not accept the task.',
      }, status);
    }

    const run = publicRun(body?.run);
    if (!run) return jsonResponse({ error: 'Agent runtime returned an invalid task record.' }, 502);
    return jsonResponse({ run }, upstream.status);
  } catch {
    return jsonResponse({ error: 'Agent runtime is temporarily unavailable.' }, 503);
  }
}
