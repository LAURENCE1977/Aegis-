import { authConfigAvailable, isAuthorized } from '../lib/auth.mjs';

const SECURITY_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Content-Security-Policy":
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
};

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: SECURITY_HEADERS
  });
}

export async function onRequestGet({ request, env }) {
  if (!authConfigAvailable(env)) {
    return jsonResponse({ ok: false, error: 'Authentication is not configured.' }, 503);
  }
  if (!(await isAuthorized(request, env))) {
    return jsonResponse({ error: 'UNAUTHORIZED' }, 401);
  }
  const db = env.AEGIS_DB;

  if (!db || typeof db.prepare !== "function") {
    return jsonResponse({
      ok: false,
      service: "AEGIS Infinity",
      database: { status: "unavailable" },
      error: "Database binding is not configured."
    }, 503);
  }

  const startedAt = Date.now();

  try {
    const state = await db.prepare(`
      SELECT operational_mode, threat_level, eve_state_tag, updated_at
      FROM system_state
      WHERE id = ?
      LIMIT 1
    `).bind(1).first();

    const latencyMs = Date.now() - startedAt;

    if (!state) {
      return jsonResponse({
        ok: false,
        service: "AEGIS Infinity",
        database: { status: "connected", latency_ms: latencyMs },
        error: "System state has not been initialized."
      }, 503);
    }

    return jsonResponse({
      ok: true,
      service: "AEGIS Infinity",
      timestamp: new Date().toISOString(),
      database: { status: "connected", latency_ms: latencyMs },
      system_state: {
        operational_mode: state.operational_mode,
        threat_level: state.threat_level,
        eve_state_tag: state.eve_state_tag,
        updated_at: state.updated_at
      }
    });
  } catch {
    return jsonResponse({
      ok: false,
      service: "AEGIS Infinity",
      database: { status: "error" },
      error: "Unable to retrieve system status."
    }, 503);
  }
}
