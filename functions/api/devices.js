import {
  authorizeOwner,
  isOwnerWriteRequest,
  jsonResponse,
  readJsonRequest,
} from '../lib/owner-api.mjs';
import {
  createPairingCode,
  hashPairingCode,
  validateDeviceRegistration,
} from '../../workers/runtime/devices.mjs';

const OWNER_ID = 'owner';
const MAX_BODY_BYTES = 4096;
const INVITE_TTL_MS = 10 * 60 * 1000;
const INVITE_WINDOW_MS = 60 * 60 * 1000;
const MAX_INVITES_PER_HOUR = 5;

function databaseReady(env) {
  return Boolean(env?.AEGIS_DB && typeof env.AEGIS_DB.prepare === 'function');
}

function safeJson(value, fallback = null) {
  try { return JSON.parse(value); } catch { return fallback; }
}

function validDeviceId(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function onRequestGet({ request, env }) {
  const denied = await authorizeOwner(request, env);
  if (denied) return denied;
  if (!databaseReady(env)) return jsonResponse({ error: 'Device registry is not configured.' }, 503);

  try {
    const result = await env.AEGIS_DB.prepare(
      'SELECT id, platform, display_name, capabilities_json, status, last_seen_at, app_version, connectivity, created_at, updated_at, revoked_at FROM devices WHERE owner_id = ? ORDER BY created_at DESC LIMIT 100'
    ).bind(OWNER_ID).all();
    return jsonResponse({
      devices: (result.results || []).map((row) => ({
        id: row.id,
        platform: row.platform,
        displayName: row.display_name,
        capabilities: safeJson(row.capabilities_json, []),
        status: row.status,
        lastSeenAt: row.last_seen_at,
        appVersion: row.app_version,
        connectivity: row.connectivity,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        revokedAt: row.revoked_at,
      })),
    });
  } catch {
    return jsonResponse({ error: 'Device registry is temporarily unavailable.' }, 503);
  }
}

export async function onRequestPost({ request, env }) {
  const denied = await authorizeOwner(request, env);
  if (denied) return denied;
  if (!isOwnerWriteRequest(request)) return jsonResponse({ error: 'Same-origin request required.' }, 403);
  if (!databaseReady(env)) return jsonResponse({ error: 'Device registry is not configured.' }, 503);

  const parsed = await readJsonRequest(request, MAX_BODY_BYTES);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status);

  let registration;
  try { registration = validateDeviceRegistration(parsed.body); } catch (error) {
    return jsonResponse({ error: error.message }, 400);
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const windowStart = new Date(now.getTime() - INVITE_WINDOW_MS).toISOString();
  try {
    const count = await env.AEGIS_DB.prepare(
      'SELECT COUNT(*) AS count FROM device_pairing_invites WHERE owner_id = ? AND created_at > ?'
    ).bind(OWNER_ID, windowStart).first();
    if (Number(count?.count || 0) >= MAX_INVITES_PER_HOUR) {
      return jsonResponse({ error: 'Pairing invitation rate limit reached. Try again later.' }, 429);
    }

    const code = createPairingCode();
    const codeHash = await hashPairingCode(code);
    const invitationId = crypto.randomUUID();
    const expiresAt = new Date(now.getTime() + INVITE_TTL_MS).toISOString();
    await env.AEGIS_DB.prepare(
      'INSERT INTO device_pairing_invites (id, owner_id, code_hash, platform, display_name, capabilities_json, expires_at, consumed_at, revoked_at, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)'
    ).bind(
      invitationId, OWNER_ID, codeHash, registration.platform, registration.displayName,
      JSON.stringify(registration.capabilities), expiresAt, OWNER_ID, nowIso,
    ).run();

    return jsonResponse({
      invitation: {
        id: invitationId,
        code,
        platform: registration.platform,
        displayName: registration.displayName,
        capabilities: registration.capabilities,
        expiresAt,
      },
      warning: 'This pairing code is shown once. Do not share it with anyone else.',
    }, 201);
  } catch {
    return jsonResponse({ error: 'Could not create a pairing invitation.' }, 503);
  }
}

export async function onRequestPatch({ request, env }) {
  const denied = await authorizeOwner(request, env);
  if (denied) return denied;
  if (!isOwnerWriteRequest(request)) return jsonResponse({ error: 'Same-origin request required.' }, 403);
  if (!databaseReady(env)) return jsonResponse({ error: 'Device registry is not configured.' }, 503);

  const parsed = await readJsonRequest(request, 1024);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status);
  const body = parsed.body;
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some((key) => !['deviceId', 'action'].includes(key)) ||
      !validDeviceId(body.deviceId) || body.action !== 'revoke') {
    return jsonResponse({ error: 'A valid deviceId and revoke action are required.' }, 400);
  }

  const now = new Date().toISOString();
  try {
    const eventId = crypto.randomUUID();
    const results = await env.AEGIS_DB.batch([
      env.AEGIS_DB.prepare(
        "UPDATE devices SET status = 'revoked', revoked_at = ?, updated_at = ?, token_version = token_version + 1 WHERE id = ? AND owner_id = ? AND status = 'active'"
      ).bind(now, now, body.deviceId, OWNER_ID),
      env.AEGIS_DB.prepare(
        "INSERT INTO device_events (event_id, device_id, event_type, detail_json, created_at) SELECT ?, id, 'revoked', '{}', ? FROM devices WHERE changes() = 1 AND id = ? AND owner_id = ? AND status = 'revoked' AND revoked_at = ? AND updated_at = ?"
      ).bind(eventId, now, body.deviceId, OWNER_ID, now, now),
    ]);
    const updated = results[0];
    if (!updated?.meta?.changes) {
      const existing = await env.AEGIS_DB.prepare(
        'SELECT id, status FROM devices WHERE id = ? AND owner_id = ?'
      ).bind(body.deviceId, OWNER_ID).first();
      if (!existing) return jsonResponse({ error: 'Device not found.' }, 404);
      return jsonResponse({ device: { id: existing.id, status: existing.status } });
    }
    return jsonResponse({ device: { id: body.deviceId, status: 'revoked', revokedAt: now } });
  } catch {
    return jsonResponse({ error: 'Could not revoke this device.' }, 503);
  }
}
