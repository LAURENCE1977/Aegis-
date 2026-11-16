import {
  authorizeOwner,
  isOwnerWriteRequest,
  jsonResponse,
  readJsonRequest,
} from "../lib/owner-api.mjs";
import { createWorkspace, listWorkspaces } from "../lib/project-spaces.mjs";

const OWNER_ID = "owner";

export async function onRequestGet({ request, env }) {
  const denied = await authorizeOwner(request, env);
  if (denied) return denied;
  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== "function") {
    return jsonResponse({ error: "Workspace storage is not configured." }, 503);
  }
  try {
    const workspaces = await listWorkspaces(env.AEGIS_DB, OWNER_ID, 50);
    return jsonResponse({ workspaces, total: workspaces.length });
  } catch {
    return jsonResponse({ error: "Workspace list is temporarily unavailable." }, 503);
  }
}

export async function onRequestPost({ request, env }) {
  const denied = await authorizeOwner(request, env);
  if (denied) return denied;
  if (!isOwnerWriteRequest(request)) {
    return jsonResponse({ error: "Invalid request origin." }, 403);
  }
  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== "function") {
    return jsonResponse({ error: "Workspace storage is not configured." }, 503);
  }
  const parsed = await readJsonRequest(request, 2048);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status);
  const body = parsed.body;
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).some(key => !["name", "description"].includes(key)) ||
      typeof body.name !== "string" ||
      (body.description !== undefined && typeof body.description !== "string")) {
    return jsonResponse({ error: "A workspace name and optional description are required." }, 400);
  }
  try {
    const workspace = await createWorkspace(env.AEGIS_DB, OWNER_ID, body);
    return jsonResponse({ workspace }, 201);
  } catch (error) {
    if (error instanceof TypeError) {
      return jsonResponse({ error: "Workspace details are invalid." }, 400);
    }
    return jsonResponse({ error: "Workspace could not be saved." }, 503);
  }
}
