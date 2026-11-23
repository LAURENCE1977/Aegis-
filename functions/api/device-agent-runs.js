import { hashDeviceToken, readDeviceToken } from '../../workers/runtime/devices.mjs';
import { jsonResponse } from '../lib/owner-api.mjs';

const MAX_RUNS = 50;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function databaseReady(env) {
  return Boolean(env?.AEGIS_DB && typeof env.AEGIS_DB.prepare === 'function');
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
  if (!originAllowed(request)) return jsonResponse({ error: 'Origin is not allowed.' }, 403);
  if (!databaseReady(env)) return jsonResponse({ error: 'Device registry is not configured.' }, 503);

  const url = new URL(request.url);
  const deviceId = url.searchParams.get('deviceId');
  if (!UUID_PATTERN.test(deviceId || '')) {
    return jsonResponse({ error: 'A valid deviceId is required.' }, 400);
  }

  const token = readDeviceToken(request);
  if (!token) return jsonResponse({ error: 'Device authentication required.' }, 401);

  try {
    const tokenHash = await hashDeviceToken(token);
    const device = await env.AEGIS_DB.prepare(
      "SELECT id, capabilities_json FROM devices WHERE id = ? AND token_hash = ? AND status = 'active'"
    ).bind(deviceId, tokenHash).first();
    if (!device) return jsonResponse({ error: 'Device credential is invalid or revoked.' }, 401);

    let capabilities = [];
    try { capabilities = JSON.parse(device.capabilities_json); } catch { capabilities = []; }
    if (!Array.isArray(capabilities) || !capabilities.includes('aegis.jobs.observe')) {
      return jsonResponse({ error: 'Device is not authorised to observe agent plans.' }, 403);
    }

    const result = await env.AEGIS_DB.prepare(
      'SELECT id, objective, status, plan_json, created_at, updated_at FROM agent_runs WHERE assigned_device_id = ? ORDER BY created_at DESC LIMIT 50'
    ).bind(deviceId).all();

    return jsonResponse({
      agentRuns: (result.results || []).slice(0, MAX_RUNS).map((row) => ({
        id: row.id,
        objective: row.objective,
        status: row.status,
        plan: safePlan(row.plan_json),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    });
  } catch {
    return jsonResponse({ error: 'Assigned agent plans are temporarily unavailable.' }, 503);
  }
}
