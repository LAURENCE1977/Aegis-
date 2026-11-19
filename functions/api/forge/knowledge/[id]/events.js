import { authConfigAvailable, isAuthorized } from "../../../../lib/auth.mjs";
import { listForgeKnowledgeEvents } from "../../../../lib/forge-knowledge.mjs";

const OWNER_ID = "owner";
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
  const paramsUrl = new URL(request.url).searchParams;
  if ([...paramsUrl.keys()].some(key => key !== "limit" || paramsUrl.getAll(key).length !== 1)) {
    return json({ error: "Invalid Knowledge Library event query." }, 400);
  }
  const rawLimit = paramsUrl.get("limit");
  const limit = rawLimit === null ? 50 : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return json({ error: "Knowledge event limit must be between 1 and 100." }, 400);
  }
  try {
    const events = await listForgeKnowledgeEvents(env.AEGIS_DB, OWNER_ID, id, limit);
    return events ? json({ events, total: events.length }) : json({ error: "Knowledge record not found." }, 404);
  } catch (error) {
    if (error instanceof TypeError) return json({ error: error.message }, 400);
    return json({ error: "Knowledge event history is temporarily unavailable." }, 503);
  }
}
