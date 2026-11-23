import { jsonResponse, readJsonRequest } from '../lib/owner-api.mjs';
import {
  hashDeviceToken,
  readDeviceToken,
  validateDeviceHeartbeat,
} from '../../workers/runtime/devices.mjs';

const MAX_BODY_BYTES = 1024;
const MIN_HEARTBEAT_INTERVAL_MS = 30 * 1000;

function databaseReady(env) {
  return Boolean(env?.AEGIS_DB && typeof env.AEGIS_DB.prepare === 'function');
}

function originAllowed(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}

export async function onRequestPost({ request, env }) {
  if (!originAllowed(request)) return jsonResponse({ error: 'Origin is not allowed.' }, 403);
  if (!databaseReady(env)) return jsonResponse({ error: 'Device registry is not configured.' }, 503);

  const token = readDeviceToken(request);
  if (!token) return jsonResponse({ error: 'Device authentication required.' }, 401);

  const parsed = await readJsonRequest(request, MAX_BODY_BYTES);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status);
  const body = parsed.body;
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some((key) => !['deviceId', 'appVersion', 'connectivity'].includes(key)) ||
      typeof body.deviceId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.deviceId)) {
    return jsonResponse({ error: 'A valid deviceId is required.' }, 400);
  }

  let heartbeat;
  try { heartbeat = validateDeviceHeartbeat({ appVersion: body.appVersion, connectivity: body.connectivity }); } catch (error) {
    return jsonResponse({ error: error.message }, 400);
  }

  try {
    const tokenHash = await hashDeviceToken(token);
    const now = new Date();
    const nowIso = now.toISOString();
    const cutoff = new Date(now.getTime() - MIN_HEARTBEAT_INTERVAL_MS).toISOString();
    const eventId = crypto.randomUUID();
    const results = await env.AEGIS_DB.batch([
      env.AEGIS_DB.prepare(
        "UPDATE devices SET last_seen_at = ?, app_version = ?, connectivity = ?, updated_at = ? WHERE id = ? AND token_hash = ? AND status = 'active' AND (last_seen_at IS NULL OR last_seen_at <= ?)"
      ).bind(nowIso, heartbeat.appVersion, heartbeat.connectivity, nowIso, body.deviceId, tokenHash, cutoff),
      env.AEGIS_DB.prepare(
        "INSERT INTO device_events (event_id, device_id, event_type, detail_json, created_at) SELECT ?, id, 'heartbeat', ?, ? FROM devices WHERE changes() = 1 AND id = ? AND token_hash = ? AND status = 'active' AND last_seen_at = ? AND updated_at = ?"
      ).bind(eventId, JSON.stringify(heartbeat), nowIso, body.deviceId, tokenHash, nowIso, nowIso),
    ]);
    const updated = results[0];

    if (!updated?.meta?.changes) {
      const active = await env.AEGIS_DB.prepare(
        "SELECT id FROM devices WHERE id = ? AND token_hash = ? AND status = 'active'"
      ).bind(body.deviceId, tokenHash).first();
      if (!active) return jsonResponse({ error: 'Device credential is invalid or revoked.' }, 401);
      return jsonResponse({ error: 'Heartbeat rate limit exceeded. Retry after 30 seconds.' }, 429);
    }

    return jsonResponse({ device: { id: body.deviceId, status: 'active', lastSeenAt: nowIso, ...heartbeat } });
  } catch {
    return jsonResponse({ error: 'Device heartbeat could not be recorded.' }, 503);
  }
}
