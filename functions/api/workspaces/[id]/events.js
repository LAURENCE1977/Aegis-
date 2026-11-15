import {
  authorizeOwner,
  isOwnerWriteRequest,
  jsonResponse,
  readJsonRequest,
} from "../../../lib/owner-api.mjs";
import {
  appendWorkspaceEvent,
  listWorkspaceEvents,
} from "../../../lib/project-spaces.mjs";

const OWNER_ID = "owner";

export async function onRequestGet({ request, env, params }) {
  const denied = await authorizeOwner(request, env);
  if (denied) return denied;
  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== "function") {
    return jsonResponse({ error: "Workspace storage is not configured." }, 503);
  }
  try {
    const events = await listWorkspaceEvents(env.AEGIS_DB, OWNER_ID, params?.id, 50);
    if (!events) return jsonResponse({ error: "Workspace not found." }, 404);
    return jsonResponse({ events, total: events.length });
  } catch {
    return jsonResponse({ error: "Workspace timeline is temporarily unavailable." }, 503);
  }
}

export async function onRequestPost({ request, env, params }) {
  const denied = await authorizeOwner(request, env);
  if (denied) return denied;
  if (!isOwnerWriteRequest(request)) {
    return jsonResponse({ error: "Invalid request origin." }, 403);
  }
  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== "function") {
    return jsonResponse({ error: "Workspace storage is not configured." }, 503);
  }
  const parsed = await readJsonRequest(request, 16_384);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status);
  const body = parsed.body;
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).some(key => !["type", "summary", "content"].includes(key)) ||
      typeof body.type !== "string" || typeof body.summary !== "string" ||
      typeof body.content !== "string") {
    return jsonResponse({ error: "Event type, summary and content are required." }, 400);
  }
  try {
    const event = await appendWorkspaceEvent(env.AEGIS_DB, {
      ownerId: OWNER_ID,
      workspaceId: params?.id,
      type: body.type,
      summary: body.summary,
      content: body.content,
    });
    if (!event) return jsonResponse({ error: "Workspace not found." }, 404);
    return jsonResponse({ event }, 201);
  } catch {
    return jsonResponse({ error: "Workspace event is invalid." }, 400);
  }
}
