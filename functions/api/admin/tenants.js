import { resolveSessionPrincipal, isSameOriginRequest, ROOT_PRINCIPAL_ID, ROOT_TENANT_ID } from "../../lib/auth.mjs";

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});
const isPlatformOwner = principal => principal?.principalId === ROOT_PRINCIPAL_ID &&
  principal.tenantId === ROOT_TENANT_ID && principal.roles.includes("owner");

export async function onRequestGet({ request, env }) {
  const principal = await resolveSessionPrincipal(request, env);
  if (!principal) return json({ error: "UNAUTHORIZED" }, 401);
  if (!principal.roles.includes("owner") && !principal.roles.includes("admin")) return json({ error: "FORBIDDEN" }, 403);
  try {
    if (isPlatformOwner(principal)) {
      const result = await env.AEGIS_DB.prepare(
        "SELECT id AS tenantId, name, status, created_at AS createdAt FROM aegis_tenants ORDER BY created_at"
      ).all();
      return json({ tenants: result.results || [] });
    }
    const result = await env.AEGIS_DB.prepare(
      "SELECT id AS tenantId, name, status, created_at AS createdAt FROM aegis_tenants WHERE id = ?"
    ).bind(principal.tenantId).all();
    return json({ tenants: result.results || [] });
  } catch { return json({ error: "Unable to list tenants." }, 503); }
}

export async function onRequestPost({ request, env }) {
  const principal = await resolveSessionPrincipal(request, env);
  if (!principal) return json({ error: "UNAUTHORIZED" }, 401);
  if (!isPlatformOwner(principal)) return json({ error: "FORBIDDEN" }, 403);
  if (!isSameOriginRequest(request)) return json({ error: "Invalid request origin." }, 403);
  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid request." }, 400); }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 2 || name.length > 120) return json({ error: "Invalid tenant name." }, 400);
  const tenantId = "org-" + crypto.randomUUID();
  const now = new Date().toISOString();
  try {
    await env.AEGIS_DB.batch([
      env.AEGIS_DB.prepare("INSERT INTO aegis_tenants (id, name, created_at, status) VALUES (?, ?, ?, 'active')").bind(tenantId, name, now),
      env.AEGIS_DB.prepare(`
        INSERT INTO aegis_tenant_memberships
          (principal_id, tenant_id, role, status, created_at, updated_at)
        VALUES (?, ?, 'owner', 'active', ?, ?)
      `).bind(principal.principalId, tenantId, now, now),
    ]);
    return json({ tenantId, name, status: "active" }, 201);
  } catch { return json({ error: "Unable to create tenant." }, 503); }
}

export async function onRequestPatch({ request, env }) {
  const principal = await resolveSessionPrincipal(request, env);
  if (!principal) return json({ error: "UNAUTHORIZED" }, 401);
  if (!isPlatformOwner(principal)) return json({ error: "FORBIDDEN" }, 403);
  if (!isSameOriginRequest(request)) return json({ error: "Invalid request origin." }, 403);
  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid request." }, 400); }
  if (typeof body.tenantId !== "string" || !["active", "suspended", "revoked"].includes(body.status) ||
      body.tenantId === ROOT_TENANT_ID) return json({ error: "Invalid tenant lifecycle operation." }, 400);
  try {
    const result = await env.AEGIS_DB.prepare(
      "UPDATE aegis_tenants SET status = ? WHERE id = ?"
    ).bind(body.status, body.tenantId).run();
    if (!result.meta?.changes) return json({ error: "Tenant not found." }, 404);
    return json({ tenantId: body.tenantId, status: body.status });
  } catch { return json({ error: "Unable to update tenant lifecycle." }, 503); }
}
