import { jsonResponse, readJsonRequest } from '../lib/owner-api.mjs';
import {
  createDeviceToken,
  hashDeviceToken,
  readDeviceToken,
} from '../../workers/runtime/devices.mjs';

const MAX_BODY_BYTES = 512;

function databaseReady(env) {
  return Boolean(
    env?.AEGIS_DB &&
    typeof env.AEGIS_DB.prepare === 'function' &&
    typeof env.AEGIS_DB.batch === 'function'
  );
}

function originAllowed(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return true; // Native clients do not send a browser Origin header.
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}

function validDeviceId(value) {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function onRequestPost({ request, env }) {
  if (!originAllowed(request)) return jsonResponse({ error: 'Origin is not allowed.' }, 403);
  if (!databaseReady(env)) return jsonResponse({ error: 'Device registry is not configured.' }, 503);

  const oldToken = readDeviceToken(request);
  if (!oldToken) return jsonResponse({ error: 'Device authentication required.' }, 401);

  const parsed = await readJsonRequest(request, MAX_BODY_BYTES);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status);
  if (!parsed.body || typeof parsed.body !== 'object' || Array.isArray(parsed.body) ||
      Object.keys(parsed.body).some((key) => key !== 'deviceId') ||
      !validDeviceId(parsed.body.deviceId)) {
    return jsonResponse({ error: 'A valid deviceId is required.' }, 400);
  }

  try {
    const oldHash = await hashDeviceToken(oldToken);
    const newToken = createDeviceToken();
    const newHash = await hashDeviceToken(newToken);
    const now = new Date().toISOString();
    const eventId = crypto.randomUUID();

    const results = await env.AEGIS_DB.batch([
      env.AEGIS_DB.prepare(
        "UPDATE devices SET token_hash = ?, token_version = token_version + 1, updated_at = ? WHERE id = ? AND token_hash = ? AND status = 'active'"
      ).bind(newHash, now, parsed.body.deviceId, oldHash),
      env.AEGIS_DB.prepare(
        "INSERT INTO device_events (event_id, device_id, event_type, detail_json, created_at) SELECT ?, id, 'token_rotated', json_object('tokenVersion', token_version), ? FROM devices WHERE changes() = 1 AND id = ? AND token_hash = ? AND status = 'active'"
      ).bind(eventId, now, parsed.body.deviceId, newHash),
    ]);

    if (!results?.[0]?.meta?.changes) {
      return jsonResponse({ error: 'Device credential is invalid or revoked.' }, 401);
    }
    if (!results?.[1]?.meta?.changes) {
      // A successful D1 batch should always write the paired audit event.
      // Fail closed rather than returning a credential without confirmed audit.
      return jsonResponse({ error: 'Device credential rotation could not be audited.' }, 503);
    }

    const browserClient = Boolean(request.headers.get('Origin'));
    const responseBody = {
      device: { id: parsed.body.deviceId, status: 'active', tokenRotated: true },
      credentialStoredInHttpOnlyCookie: browserClient,
      warning: browserClient
        ? 'The new device credential is held in a Secure, HttpOnly, SameSite=Strict cookie.'
        : 'Store the new device credential in Android Keystore. It is shown once and the previous credential is now invalid.',
    };
    if (browserClient) {
      return new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
          'Set-Cookie': '__Host-aegis_device=' + newToken + '; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Strict',
        },
      });
    }
    return jsonResponse({ ...responseBody, credential: newToken });
  } catch {
    return jsonResponse({ error: 'Device credential rotation failed.' }, 503);
  }
}
