import {
  authorizeOwner,
  jsonResponse,
} from '../lib/owner-api.mjs';

const MAX_RUNS = 50;

function databaseReady(env) {
  return Boolean(env?.AEGIS_DB && typeof env.AEGIS_DB.prepare === 'function');
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
