import { resolveSessionPrincipal, isSameOriginRequest } from "../lib/auth.mjs";

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});

export async function onRequestGet({ request, env }) {
  const principal = await resolveSessionPrincipal(request, env);
  if (!principal) return json({ error: "UNAUTHORIZED" }, 401);
  try {
    const result = await env.AEGIS_DB.prepare(`
      SELECT session_id AS sessionId, created_at AS createdAt, expires_at AS expiresAt,
             CASE WHEN session_id = ? THEN 1 ELSE 0 END AS current
      FROM auth_sessions
      WHERE principal_id = ? AND tenant_id = ? AND revoked_at IS NULL AND expires_at > ?
      ORDER BY created_at DESC
    `).bind(principal.sid, principal.principalId, principal.tenantId, Math.floor(Date.now() / 1000)).all();
    return json({ sessions: result.results || [] });
  } catch { return json({ error: "Unable to list sessions." }, 503); }
}

export async function onRequestDelete({ request, env }) {
  const principal = await resolveSessionPrincipal(request, env);
  if (!principal) return json({ error: "UNAUTHORIZED" }, 401);
  if (!isSameOriginRequest(request)) return json({ error: "Invalid request origin." }, 403);
  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid request." }, 400); }
  if (typeof body.sessionId !== "string" || body.sessionId.length > 64) return json({ error: "Invalid session identifier." }, 400);
  try {
    const result = await env.AEGIS_DB.prepare(`
      UPDATE auth_sessions SET revoked_at = ?
      WHERE session_id = ? AND principal_id = ? AND tenant_id = ? AND revoked_at IS NULL
    `).bind(new Date().toISOString(), body.sessionId, principal.principalId, principal.tenantId).run();
    if (!result.meta?.changes) return json({ error: "Session not found." }, 404);
    return json({ revoked: true, sessionId: body.sessionId });
  } catch { return json({ error: "Unable to revoke session." }, 503); }
}
