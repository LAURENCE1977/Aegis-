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
import { authenticatePrincipal } from "../lib/identity.mjs";

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
  if (!isSameOriginRequest(request)) return json({ error: "Invalid request origin." }, 403);
  if (!authConfigAvailable(env)) {
    return json({ error: "Authentication is not configured. Set AEGIS_SESSION_SECRET and configure D1 or AEGIS_PASSWORD." }, 503);
  }

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

  if (attempt.locked) return json({ error: "Incorrect password." }, 401);

  // A password-only request is the controlled appliance bootstrap path.
  // Named identities always authenticate against their own PBKDF2 credential.
  let principalId;
  let membership;
  if (typeof body?.identity === "string") {
    let account;
    try {
      account = await authenticatePrincipal(env.AEGIS_DB, body.identity, body.password);
    } catch {
      return json({ error: "Authentication is temporarily unavailable." }, 503);
    }
    if (!account) return json({ error: "Incorrect password." }, 401);
    const matches = account.memberships.filter(item =>
      typeof body.tenantId !== "string" || item.tenantId === body.tenantId
    );
    if (matches.length === 0) return json({ error: "Incorrect password." }, 401);
    if (matches.length > 1) {
      return json({
        error: "Select an active tenant.",
        code: "TENANT_SELECTION_REQUIRED",
        tenants: matches.map(({ tenantId, tenantName, role }) => ({ tenantId, tenantName, role })),
      }, 409);
    }
    principalId = account.principalId;
    membership = matches[0];
  } else {
    if (typeof env.AEGIS_PASSWORD !== "string" || env.AEGIS_PASSWORD.length < 12 ||
        !constantTimeEqual(body?.password, env.AEGIS_PASSWORD)) {
      return json({ error: "Incorrect password." }, 401);
    }
    const memberships = await env.AEGIS_DB.prepare(`
      SELECT m.tenant_id, m.role, t.name AS tenant_name
      FROM aegis_tenant_memberships m
      JOIN aegis_tenants t ON t.id = m.tenant_id
      WHERE m.principal_id = ? AND m.status = 'active' AND t.status = 'active'
      ORDER BY m.tenant_id
    `).bind(ROOT_PRINCIPAL_ID).all();
    const matches = (memberships?.results || []).filter(item =>
      typeof body.tenantId !== "string" || item.tenant_id === body.tenantId
    );
    if (matches.length === 0) return json({ error: "Incorrect password." }, 401);
    if (matches.length > 1) {
      return json({
        error: "Select an active tenant.",
        code: "TENANT_SELECTION_REQUIRED",
        tenants: matches.map(item => ({ tenantId: item.tenant_id, tenantName: item.tenant_name, role: item.role })),
      }, 409);
    }
    principalId = ROOT_PRINCIPAL_ID;
    membership = { tenant_id: matches[0].tenant_id, role: matches[0].role };
  }

  try {
    const { token, sessionId, expiresAt } = await createRevocableSessionToken(env.AEGIS_SESSION_SECRET);
    const tenantId = membership.tenantId || membership.tenant_id;
    const role = membership.role;
    await env.AEGIS_DB.prepare(
      "INSERT INTO auth_sessions (session_id, created_at, expires_at, revoked_at, principal_id, tenant_id, roles_json) VALUES (?, ?, ?, NULL, ?, ?, ?)"
    ).bind(sessionId, new Date().toISOString(), expiresAt, principalId, tenantId, JSON.stringify([role])).run();
    await clearLoginAttempts(env, attempt.identityHash);
    return json({ authenticated: true, principalId, tenantId, role }, 200, { "Set-Cookie": sessionCookie(token) });
  } catch {
    return json({ error: "Unable to create an authenticated session." }, 503);
  }
}

export async function onRequestDelete({ request, env }) {
  if (!isSameOriginRequest(request)) return json({ error: "Invalid request origin." }, 403);
  try {
    await revokeSession(request, env);
  } catch {
    return json({ error: "Session revocation is temporarily unavailable." }, 503, { "Set-Cookie": clearSessionCookie() });
  }
  return json({ authenticated: false }, 200, { "Set-Cookie": clearSessionCookie() });
}
