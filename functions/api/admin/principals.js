import { resolveSessionPrincipal, isSameOriginRequest } from "../../lib/auth.mjs";
import { createPasswordCredential, normalizeLoginIdentifier } from "../../lib/identity.mjs";

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});
const canAdminister = principal => principal && principal.roles.some(role => role === "owner" || role === "admin");

export async function onRequestGet({ request, env }) {
  const principal = await resolveSessionPrincipal(request, env);
  if (!principal) return json({ error: "UNAUTHORIZED" }, 401);
  if (!canAdminister(principal)) return json({ error: "FORBIDDEN" }, 403);
  try {
    const result = await env.AEGIS_DB.prepare(`
      SELECT p.id AS principalId, p.display_name AS displayName,
             c.login_identifier AS identity, m.role, m.status, m.created_at AS createdAt
      FROM aegis_tenant_memberships m
      JOIN aegis_principals p ON p.id = m.principal_id
      LEFT JOIN aegis_principal_credentials c ON c.principal_id = p.id
      WHERE m.tenant_id = ?
      ORDER BY m.created_at, p.id
    `).bind(principal.tenantId).all();
    return json({ members: result.results || [] });
  } catch {
    return json({ error: "Unable to list tenant members." }, 503);
  }
}

export async function onRequestPost({ request, env }) {
  const principal = await resolveSessionPrincipal(request, env);
  if (!principal) return json({ error: "UNAUTHORIZED" }, 401);
  if (!canAdminister(principal)) return json({ error: "FORBIDDEN" }, 403);
  if (!isSameOriginRequest(request)) return json({ error: "Invalid request origin." }, 403);

  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid request." }, 400); }
  const identity = normalizeLoginIdentifier(body.identity);
  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
  const role = body.role || "member";
  if (!identity || displayName.length < 1 || displayName.length > 120 ||
      typeof body.password !== "string" || body.password.length < 12 || body.password.length > 1024 ||
      !["owner", "admin", "member"].includes(role)) {
    return json({ error: "Invalid principal details." }, 400);
  }
  if (principal.roles.includes("admin") && role !== "member") {
    return json({ error: "Admins may provision member accounts only." }, 403);
  }

  try {
    const credential = await createPasswordCredential(body.password, env);
    const principalId = "usr-" + crypto.randomUUID();
    const now = new Date().toISOString();
    await env.AEGIS_DB.batch([
      env.AEGIS_DB.prepare(`
        INSERT INTO aegis_principals (id, tenant_id, display_name, created_at, status)
        VALUES (?, ?, ?, ?, 'active')
      `).bind(principalId, principal.tenantId, displayName, now),
      env.AEGIS_DB.prepare(`
        INSERT INTO aegis_principal_credentials
          (principal_id, login_identifier, email, username, password_algorithm, password_pepper_version,
           password_salt, password_hash, password_iterations, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(principalId, identity, identity.includes("@") ? identity : null,
        identity.includes("@") ? null : identity, credential.passwordAlgorithm,
        credential.passwordPepperVersion, credential.passwordSalt, credential.passwordHash,
        credential.passwordIterations, now, now),
      env.AEGIS_DB.prepare(`
        INSERT INTO aegis_tenant_memberships
          (principal_id, tenant_id, role, status, created_at, updated_at)
        VALUES (?, ?, ?, 'active', ?, ?)
      `).bind(principalId, principal.tenantId, role, now, now),
    ]);
    return json({ principalId, tenantId: principal.tenantId, identity, role, status: "active" }, 201);
  } catch (error) {
    if (/UNIQUE|unique|constraint/i.test(String(error?.message))) return json({ error: "Identity already exists." }, 409);
    return json({ error: "Unable to provision principal." }, 503);
  }
}

export async function onRequestPatch({ request, env }) {
  const principal = await resolveSessionPrincipal(request, env);
  if (!principal) return json({ error: "UNAUTHORIZED" }, 401);
  if (!canAdminister(principal)) return json({ error: "FORBIDDEN" }, 403);
  if (!isSameOriginRequest(request)) return json({ error: "Invalid request origin." }, 403);

  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid request." }, 400); }
  if (typeof body.principalId !== "string" ||
      (!body.role && !body.status && !body.principalStatus)) return json({ error: "Invalid membership update." }, 400);
  if (body.principalStatus) {
    if (principal.principalId !== "usr-root" || principal.tenantId !== "org-root" || !principal.roles.includes("owner")) {
      return json({ error: "Only the platform owner may change global principal status." }, 403);
    }
    if (!["active", "suspended", "revoked"].includes(body.principalStatus) ||
        body.principalId === "usr-root") return json({ error: "Invalid principal lifecycle operation." }, 400);
    try {
      const result = await env.AEGIS_DB.prepare(
        "UPDATE aegis_principals SET status = ? WHERE id = ?"
      ).bind(body.principalStatus, body.principalId).run();
      if (!result.meta?.changes) return json({ error: "Principal not found." }, 404);
      return json({ principalId: body.principalId, principalStatus: body.principalStatus });
    } catch { return json({ error: "Unable to update principal lifecycle." }, 503); }
  }
  if (body.principalId === principal.principalId) return json({ error: "Self membership changes are not permitted." }, 403);
  if (body.role && !["owner", "admin", "member"].includes(body.role)) return json({ error: "Invalid role." }, 400);
  if (body.status && !["active", "suspended", "revoked"].includes(body.status)) return json({ error: "Invalid membership status." }, 400);

  try {
    const target = await env.AEGIS_DB.prepare(`
      SELECT role FROM aegis_tenant_memberships
      WHERE principal_id = ? AND tenant_id = ?
    `).bind(body.principalId, principal.tenantId).first();
    if (!target) return json({ error: "Principal not found in this tenant." }, 404);
    if (principal.roles.includes("admin") && (target.role !== "member" || (body.role && body.role !== "member"))) {
      return json({ error: "Admins may manage member accounts only." }, 403);
    }
    const role = body.role || target.role;
    const status = body.status || "active";
    await env.AEGIS_DB.prepare(`
      UPDATE aegis_tenant_memberships
      SET role = ?, status = ?, updated_at = ?
      WHERE principal_id = ? AND tenant_id = ?
    `).bind(role, status, new Date().toISOString(), body.principalId, principal.tenantId).run();
    return json({ principalId: body.principalId, tenantId: principal.tenantId, role, status });
  } catch {
    return json({ error: "Unable to update tenant membership." }, 503);
  }
}
