import {
  authorizeOwner,
  isOwnerWriteRequest,
  jsonResponse,
  readJsonRequest,
} from '../lib/owner-api.mjs';

const OWNER_ID = 'owner';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function databaseReady(env) {
  return Boolean(env?.AEGIS_DB && typeof env.AEGIS_DB.prepare === 'function' &&
    typeof env.AEGIS_DB.batch === 'function');
}

export async function onRequestPost({ request, env }) {
  const denied = await authorizeOwner(request, env);
  if (denied) return denied;
  if (!isOwnerWriteRequest(request)) return jsonResponse({ error: 'Same-origin request required.' }, 403);
  if (!databaseReady(env)) return jsonResponse({ error: 'Device registry is not configured.' }, 503);

  const parsed = await readJsonRequest(request, 1024);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status);
  const body = parsed.body;
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some((key) => !['deviceId', 'agentRunId'].includes(key)) ||
      typeof body.deviceId !== 'string' || !UUID_PATTERN.test(body.deviceId) ||
      typeof body.agentRunId !== 'string' || !UUID_PATTERN.test(body.agentRunId)) {
    return jsonResponse({ error: 'Valid deviceId and agentRunId are required.' }, 400);
  }

  const now = new Date().toISOString();
  const eventId = crypto.randomUUID();
  try {
    const results = await env.AEGIS_DB.batch([
      env.AEGIS_DB.prepare(
        "UPDATE agent_runs SET assigned_device_id = ?, updated_at = ? WHERE id = ? AND status = 'planned' AND assigned_device_id IS NULL AND EXISTS (SELECT 1 FROM devices d WHERE d.id = ? AND d.owner_id = ? AND d.status = 'active' AND EXISTS (SELECT 1 FROM json_each(d.capabilities_json) WHERE value = 'aegis.jobs.observe'))"
      ).bind(body.deviceId, now, body.agentRunId, body.deviceId, OWNER_ID),
      env.AEGIS_DB.prepare(
        "INSERT INTO agent_run_events (event_id, agent_run_id, event_type, detail_json, created_at) SELECT ?, id, 'device_assigned', json_object('deviceId', ?), ? FROM agent_runs WHERE id = ? AND assigned_device_id = ? AND updated_at = ? AND status = 'planned' ON CONFLICT(event_id) DO NOTHING"
      ).bind(eventId, body.deviceId, now, body.agentRunId, body.deviceId, now),
    ]);
    if (!results?.[0]?.meta?.changes) {
      return jsonResponse({ error: 'Agent run must be planned and the target device must be active with observation permission.' }, 409);
    }
    return jsonResponse({
      assignment: { agentRunId: body.agentRunId, deviceId: body.deviceId, assignedAt: now },
    }, 201);
  } catch {
    return jsonResponse({ error: 'Could not assign this agent plan to the device.' }, 503);
  }
}
