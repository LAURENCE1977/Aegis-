import {
  authConfigAvailable,
  ROOT_PRINCIPAL_ID,
  ROOT_TENANT_ID,
  constantTimeEqual,
  createRevocableSessionToken,
  hashLoginIdentity,
  isAuthorized,
  isSameOriginRequest,
  revokeSession,
  sessionCookie,
  clearSessionCookie,
} from "../lib/auth.mjs";

const LOGIN_WINDOW_SECONDS = 15 * 60;
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCK_SECONDS = 15 * 60;

const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    ...headers,
  },
});

function sessionStoreAvailable(env) {
  return Boolean(env?.AEGIS_DB && typeof env.AEGIS_DB.prepare === "function");
}

async function reserveLoginAttempt(request, env) {
  // Cloudflare supplies this edge header. Never fall back to caller-controlled
  // forwarding headers, and never persist the raw address.
  const clientIp = request.headers.get("CF-Connecting-IP")?.trim();
  if (!clientIp || clientIp.length > 64) return { unavailable: true };

  try {
    const identityHash = await hashLoginIdentity(clientIp, env.AEGIS_SESSION_SECRET);
    const now = Math.floor(Date.now() / 1000);
    const cutoff = now - LOGIN_WINDOW_SECONDS;
    const result = await env.AEGIS_DB.prepare(`
      INSERT INTO login_attempts
        (identity_hash, window_started_at, attempts, locked_until, updated_at)
      VALUES (?, ?, 1, 0, ?)
      ON CONFLICT(identity_hash) DO UPDATE SET
        attempts = CASE
          WHEN login_attempts.window_started_at <= ? THEN 1
          ELSE login_attempts.attempts + 1
        END,
        window_started_at = CASE
          WHEN login_attempts.window_started_at <= ? THEN excluded.window_started_at
          ELSE login_attempts.window_started_at
        END,
        locked_until = CASE
          WHEN (CASE
            WHEN login_attempts.window_started_at <= ? THEN 1
            ELSE login_attempts.attempts + 1
          END) >= ? THEN excluded.window_started_at + ?
          ELSE login_attempts.locked_until
        END,
        updated_at = excluded.updated_at
      RETURNING attempts, locked_until
    `).bind(
      identityHash,
      now,
      new Date(now * 1000).toISOString(),
      cutoff,
      cutoff,
      cutoff,
      LOGIN_MAX_ATTEMPTS + 1,
      LOGIN_LOCK_SECONDS
    ).first();

    return {
      identityHash,
      locked: !result || Number(result.locked_until) > now,
    };
  } catch {
    return { unavailable: true };
  }
}

async function clearLoginAttempts(env, identityHash) {
  await env.AEGIS_DB.prepare(
    "DELETE FROM login_attempts WHERE identity_hash = ?"
  ).bind(identityHash).run();
}

export async function onRequestGet({ request, env }) {
  if (!authConfigAvailable(env)) {
    return json({ error: "Authentication is not configured. Set AEGIS_PASSWORD and AEGIS_SESSION_SECRET." }, 503);
  }
  return json({ authenticated: await isAuthorized(request, env) });
}

export async function onRequestPost({ request, env }) {
  if (!authConfigAvailable(env)) {
    return json({ error: "Authentication is not configured. Set AEGIS_PASSWORD and AEGIS_SESSION_SECRET." }, 503);
  }
  if (!isSameOriginRequest(request)) return json({ error: "Invalid request origin." }, 403);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  if (!sessionStoreAvailable(env)) {
    return json({ error: "Login protection is unavailable." }, 503);
  }

  const attempt = await reserveLoginAttempt(request, env);
  if (attempt.unavailable) {
    return json({ error: "Login protection is unavailable." }, 503);
  }

  // Wrong passwords and throttled attempts deliberately share the same
  // response to avoid disclosing lockout state or account information.
  if (attempt.locked || !constantTimeEqual(body?.password, env.AEGIS_PASSWORD)) {
    return json({ error: "Incorrect password." }, 401);
  }

  try {
    const { token, sessionId, expiresAt } = await createRevocableSessionToken(env.AEGIS_SESSION_SECRET);
    await env.AEGIS_DB.prepare(
      "INSERT INTO auth_sessions (session_id, created_at, expires_at, revoked_at, principal_id, tenant_id, roles_json) VALUES (?, ?, ?, NULL, ?, ?, ?)"
    ).bind(sessionId, new Date().toISOString(), expiresAt, ROOT_PRINCIPAL_ID, ROOT_TENANT_ID, JSON.stringify(["owner"])).run();
    await clearLoginAttempts(env, attempt.identityHash);
    return json({ authenticated: true }, 200, { "Set-Cookie": sessionCookie(token) });
  } catch {
    return json({ error: "Unable to create an authenticated session." }, 503);
  }
}

export async function onRequestDelete({ request, env }) {
  if (!isSameOriginRequest(request)) return json({ error: "Invalid request origin." }, 403);
  try {
    await revokeSession(request, env);
  } catch {
    // D1 errors fail protected session checks closed.
  }
  return json({ authenticated: false }, 200, { "Set-Cookie": clearSessionCookie() });
}
