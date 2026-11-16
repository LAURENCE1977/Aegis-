import { authConfigAvailable, isAuthorized } from "../../../../lib/auth.mjs";
import { listForgeCandidateEvents } from "../../../../lib/forge-candidates.mjs";

const OWNER_ID = "owner";
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});

export async function onRequestGet({ request, env, params }) {
  if (!authConfigAvailable(env)) return json({ error: "Authentication is not configured." }, 503);
  if (!(await isAuthorized(request, env))) return json({ error: "Authentication required." }, 401);
  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== "function") {
    return json({ error: "Forge candidate storage is not configured." }, 503);
  }
  const id = params?.id;
  if (typeof id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    return json({ error: "Forge candidate not found." }, 404);
  }
  const rawLimit = new URL(request.url).searchParams.get("limit");
  const limit = rawLimit === null ? 50 : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return json({ error: "Event limit must be between 1 and 100." }, 400);
  }
  try {
    const events = await listForgeCandidateEvents(env.AEGIS_DB, OWNER_ID, id, limit);
    return json({ events });
  } catch {
    return json({ error: "Forge candidate history could not be loaded." }, 503);
  }
}
