import { authConfigAvailable, isAuthorized, isSameOriginRequest } from "../../../lib/auth.mjs";
import { readBoundedText } from "../../../lib/request-body.mjs";
import {
  ForgeKnowledgeConflictError,
  getForgeKnowledgeRecord,
  updateForgeKnowledgeReview,
} from "../../../lib/forge-knowledge.mjs";

const OWNER_ID = "owner";
const MAX_BODY_BYTES = 4096;
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});

export async function onRequestGet({ request, env, params }) {
  if (!authConfigAvailable(env)) return json({ error: "Authentication is not configured." }, 503);
  if (!(await isAuthorized(request, env))) return json({ error: "Authentication required." }, 401);
  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== "function") {
    return json({ error: "Knowledge Library storage is not configured." }, 503);
  }
  const id = params?.id;
  if (typeof id !== "string" || !ID_PATTERN.test(id)) return json({ error: "Knowledge record not found." }, 404);
  try {
    const record = await getForgeKnowledgeRecord(env.AEGIS_DB, OWNER_ID, id);
    return record ? json({ record }) : json({ error: "Knowledge record not found." }, 404);
  } catch {
    return json({ error: "Knowledge record is temporarily unavailable." }, 503);
  }
}

export async function onRequestPatch({ request, env, params }) {
  if (!authConfigAvailable(env)) return json({ error: "Authentication is not configured." }, 503);
  if (!(await isAuthorized(request, env))) return json({ error: "Authentication required." }, 401);
  if (!isSameOriginRequest(request)) return json({ error: "Cross-origin request rejected." }, 403);
  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== "function") {
    return json({ error: "Knowledge Library storage is not configured." }, 503);
  }
  const id = params?.id;
  if (typeof id !== "string" || !ID_PATTERN.test(id)) return json({ error: "Knowledge record not found." }, 404);
  if (!(request.headers.get("Content-Type") || "").toLowerCase().startsWith("application/json")) {
    return json({ error: "Content-Type must be application/json." }, 415);
  }
  let raw;
  try { raw = await readBoundedText(request, MAX_BODY_BYTES); }
  catch (error) { return json({ error: error.message }, error.status || 400); }
  let body;
  try { body = JSON.parse(raw); } catch { return json({ error: "Request body must contain valid JSON." }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).length !== 3 ||
      !Object.hasOwn(body, "status") ||
      !Object.hasOwn(body, "reviewNote") ||
      !Object.hasOwn(body, "expectedUpdatedAt")) {
    return json({ error: "Provide status, reviewNote and expectedUpdatedAt." }, 400);
  }

  try {
    const record = await updateForgeKnowledgeReview(env.AEGIS_DB, OWNER_ID, id, body);
    return record ? json({ record }) : json({ error: "Knowledge record not found." }, 404);
  } catch (error) {
    if (error instanceof TypeError) return json({ error: error.message }, 400);
    if (error instanceof ForgeKnowledgeConflictError) return json({ error: error.message }, 409);
    return json({ error: "Knowledge review could not be saved." }, 503);
  }
}
