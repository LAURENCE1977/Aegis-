import { authConfigAvailable, isAuthorized, isSameOriginRequest } from "../../lib/auth.mjs";
import { readBoundedText } from "../../lib/request-body.mjs";
import {
  createForgeKnowledgeRecord,
  listForgeKnowledgeRecords,
  ForgeKnowledgeConflictError,
} from "../../lib/forge-knowledge.mjs";

const OWNER_ID = "owner";
const MAX_BODY_BYTES = 96 * 1024;
const ALLOWED_QUERY_KEYS = new Set(["q", "domain", "type", "status", "limit"]);
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});

export async function onRequestGet({ request, env }) {
  if (!authConfigAvailable(env)) return json({ error: "Authentication is not configured." }, 503);
  if (!(await isAuthorized(request, env))) return json({ error: "Authentication required." }, 401);
  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== "function") {
    return json({ error: "Knowledge Library storage is not configured." }, 503);
  }
  const params = new URL(request.url).searchParams;
  for (const key of params.keys()) {
    if (!ALLOWED_QUERY_KEYS.has(key) || params.getAll(key).length !== 1) {
      return json({ error: "Invalid or repeated Knowledge Library search parameter." }, 400);
    }
  }
  const rawLimit = params.get("limit");
  const limit = rawLimit === null ? 50 : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return json({ error: "Knowledge Library limit must be between 1 and 100." }, 400);
  }
  try {
    const records = await listForgeKnowledgeRecords(env.AEGIS_DB, OWNER_ID, {
      query: params.get("q") || "",
      domain: params.get("domain") || undefined,
      knowledgeType: params.get("type") || undefined,
      status: params.get("status") || "accepted",
      limit,
    });
    return json({ records, total: records.length });
  } catch (error) {
    if (error instanceof TypeError) return json({ error: error.message }, 400);
    return json({ error: "Knowledge Library search is temporarily unavailable." }, 503);
  }
}

export async function onRequestPost({ request, env }) {
  if (!authConfigAvailable(env)) return json({ error: "Authentication is not configured." }, 503);
  if (!(await isAuthorized(request, env))) return json({ error: "Authentication required." }, 401);
  if (!isSameOriginRequest(request)) return json({ error: "Cross-origin request rejected." }, 403);
  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== "function") {
    return json({ error: "Knowledge Library storage is not configured." }, 503);
  }
  if (!(request.headers.get("Content-Type") || "").toLowerCase().startsWith("application/json")) {
    return json({ error: "Content-Type must be application/json." }, 415);
  }
  let raw;
  try { raw = await readBoundedText(request, MAX_BODY_BYTES); }
  catch (error) { return json({ error: error.message }, error.status || 400); }
  let body;
  try { body = JSON.parse(raw); } catch { return json({ error: "Request body must contain valid JSON." }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "Knowledge submission must be an object." }, 400);
  }

  try {
    const record = await createForgeKnowledgeRecord(env.AEGIS_DB, OWNER_ID, body);
    return json({ record }, 201);
  } catch (error) {
    if (error instanceof TypeError) return json({ error: error.message }, 400);
    if (error instanceof ForgeKnowledgeConflictError) return json({ error: error.message }, 409);
    return json({ error: "Knowledge record could not be saved." }, 503);
  }
}
