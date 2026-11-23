import { jsonResponse, readJsonRequest } from '../lib/owner-api.mjs';
import {
  createDeviceToken,
  hashDeviceToken,
  hashPairingCode,
  validatePairingRedemption,
} from '../../workers/runtime/devices.mjs';

const MAX_BODY_BYTES = 512;

function databaseReady(env) {
  return Boolean(env?.AEGIS_DB && typeof env.AEGIS_DB.batch === 'function' && typeof env.AEGIS_DB.prepare === 'function');
}

function originAllowed(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return true; // Native clients do not send a browser Origin header.
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}

export async function onRequestPost({ request, env }) {
  if (!originAllowed(request)) return jsonResponse({ error: 'Origin is not allowed.' }, 403);
  if (!databaseReady(env)) return jsonResponse({ error: 'Device registry is not configured.' }, 503);

  const parsed = await readJsonRequest(request, MAX_BODY_BYTES);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status);
  let redemption;
  try { redemption = validatePairingRedemption(parsed.body); } catch (error) {
    return jsonResponse({ error: error.message }, 400);
  }

  try {
    const codeHash = await hashPairingCode(redemption.code);
    const now = new Date().toISOString();
    const invitation = await env.AEGIS_DB.prepare(
      'SELECT id FROM device_pairing_invites WHERE code_hash = ? AND consumed_at IS NULL AND revoked_at IS NULL AND expires_at > ?'
    ).bind(codeHash, now).first();
    if (!invitation) return jsonResponse({ error: 'Pairing code is invalid, expired, already used or revoked.' }, 410);

    const deviceId = crypto.randomUUID();
    const token = createDeviceToken();
    const tokenHash = await hashDeviceToken(token);

    const results = await env.AEGIS_DB.batch([
      env.AEGIS_DB.prepare(
        "INSERT INTO devices (id, invite_id, owner_id, platform, display_name, token_hash, token_version, capabilities_json, status, last_seen_at, app_version, connectivity, created_at, updated_at, revoked_at) SELECT ?, i.id, i.owner_id, i.platform, i.display_name, ?, 1, i.capabilities_json, 'active', NULL, NULL, NULL, ?, ?, NULL FROM device_pairing_invites i WHERE i.code_hash = ? AND i.consumed_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > ?"
      ).bind(deviceId, tokenHash, now, now, codeHash, now),
      env.AEGIS_DB.prepare(
        'UPDATE device_pairing_invites SET consumed_at = ? WHERE code_hash = ? AND consumed_at IS NULL AND revoked_at IS NULL AND expires_at > ? AND EXISTS (SELECT 1 FROM devices d WHERE d.invite_id = device_pairing_invites.id AND d.id = ?)'
      ).bind(now, codeHash, now, deviceId),
      env.AEGIS_DB.prepare(
        "INSERT INTO device_events (event_id, device_id, event_type, detail_json, created_at) SELECT ?, id, 'paired', json_object('platform', platform), ? FROM devices WHERE id = ?"
      ).bind(crypto.randomUUID(), now, deviceId),
    ]);

    if (!results?.[0]?.meta?.changes || !results?.[1]?.meta?.changes) {
      return jsonResponse({ error: 'Pairing code is invalid, expired, already used or revoked.' }, 410);
    }

    const browserClient = Boolean(request.headers.get('Origin'));
    const responseBody = {
      device: { id: deviceId, status: 'active' },
      credentialStoredInHttpOnlyCookie: browserClient,
      warning: browserClient
        ? 'The device credential is held in a Secure, HttpOnly, SameSite=Strict cookie and is not exposed to page JavaScript.'
        : 'Store this device credential in Android Keystore. It is shown once and cannot be recovered.',
    };
    if (browserClient) {
      return new Response(JSON.stringify(responseBody), {
        status: 201,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
          'Set-Cookie': '__Host-aegis_device=' + token + '; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Strict',
        },
      });
    }
    return jsonResponse({ ...responseBody, credential: token }, 201);
  } catch {
    return jsonResponse({ error: 'Device enrolment failed. The pairing code may have expired or already been used.' }, 410);
  }
}
