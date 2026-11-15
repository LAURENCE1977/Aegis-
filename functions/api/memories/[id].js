import {
  authorizeOwner,
  isOwnerWriteRequest,
  jsonResponse,
  readJsonRequest,
} from "../../lib/owner-api.mjs";
import { createMemoryRepository } from "../../lib/memory-substrate.mjs";
import { getWorkspace } from "../../lib/project-spaces.mjs";

const OWNER_ID = "owner";

function parseProjectId(value) {
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) return undefined;
  return value;
}

export async function onRequestGet({ request, env, params }) {
  const denied = await authorizeOwner(request, env);
  if (denied) return denied;
  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== "function") {
    return jsonResponse({ error: "Memory storage is not configured." }, 503);
  }
  const id = params?.id;
  if (typeof id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    return jsonResponse({ error: "Memory not found." }, 404);
  }
  const projectId = parseProjectId(new URL(request.url).searchParams.get("projectId"));
  if (projectId === undefined) return jsonResponse({ error: "Invalid project scope." }, 400);
  try {
    if (projectId !== null) {
      const project = await getWorkspace(env.AEGIS_DB, OWNER_ID, projectId);
      if (!project || project.status !== "active") return jsonResponse({ error: "Memory not found." }, 404);
    }
    const memory = await createMemoryRepository(env.AEGIS_DB).get(id, {
      ownerId: OWNER_ID, projectId,
    });
    return memory
      ? jsonResponse({ memory })
      : jsonResponse({ error: "Memory not found." }, 404);
  } catch {
    return jsonResponse({ error: "Memory could not be loaded." }, 503);
  }
}

export async function onRequestPatch({ request, env, params }) {
  const denied = await authorizeOwner(request, env);
  if (denied) return denied;
  if (!isOwnerWriteRequest(request)) return jsonResponse({ error: "Invalid request origin." }, 403);
  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== "function") {
    return jsonResponse({ error: "Memory storage is not configured." }, 503);
  }
  const id = params?.id;
  if (typeof id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    return jsonResponse({ error: "Memory not found." }, 404);
  }
  const parsed = await readJsonRequest(request, 1024);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status);
  const body = parsed.body;
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).some((key) => !["status", "projectId"].includes(key)) ||
      !["accepted", "superseded", "retracted"].includes(body.status) ||
      (body.projectId !== undefined && typeof body.projectId !== "string")) {
    return jsonResponse({ error: "A valid memory lifecycle status is required." }, 400);
  }
  const projectId = parseProjectId(body.projectId ?? null);
  if (projectId === undefined) return jsonResponse({ error: "Invalid project scope." }, 400);
  try {
    if (projectId !== null) {
      const project = await getWorkspace(env.AEGIS_DB, OWNER_ID, projectId);
      if (!project || project.status !== "active") return jsonResponse({ error: "Memory not found." }, 404);
    }
    const repository = createMemoryRepository(env.AEGIS_DB);
    const changed = await repository.setStatus(id, {
      ownerId: OWNER_ID, projectId, status: body.status,
    });
    if (!changed) return jsonResponse({ error: "Memory not found or lifecycle is already closed." }, 404);
    const memory = await repository.get(id, { ownerId: OWNER_ID, projectId });
    return jsonResponse({ memory });
  } catch {
    return jsonResponse({ error: "Memory review could not be saved." }, 503);
  }
}


export async function onRequestDelete({ request, env, params }) {
  const denied = await authorizeOwner(request, env);
  if (denied) return denied;
  if (!isOwnerWriteRequest(request)) return jsonResponse({ error: "Invalid request origin." }, 403);
  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== "function") {
    return jsonResponse({ error: "Memory storage is not configured." }, 503);
  }
  const id = params?.id;
  if (typeof id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    return jsonResponse({ error: "Memory not found." }, 404);
  }
  const parsed = await readJsonRequest(request, 1024);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status);
  const body = parsed.body;
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).some(key => !["confirm", "projectId"].includes(key)) ||
      body.confirm !== true ||
      (body.projectId !== undefined && body.projectId !== null && typeof body.projectId !== "string")) {
    return jsonResponse({ error: "Explicit confirmation is required to permanently purge this memory." }, 400);
  }
  const projectId = parseProjectId(body.projectId ?? null);
  if (projectId === undefined) return jsonResponse({ error: "Invalid project scope." }, 400);
  try {
    if (projectId !== null) {
      const project = await getWorkspace(env.AEGIS_DB, OWNER_ID, projectId);
      if (!project || project.status !== "active") return jsonResponse({ error: "Memory not found." }, 404);
    }
    const purged = await createMemoryRepository(env.AEGIS_DB).purge(id, {
      ownerId: OWNER_ID,
      projectId,
    });
    if (!purged) return jsonResponse({ error: "Memory not found." }, 404);
    return jsonResponse({ purged: true, id, projectId });
  } catch {
    return jsonResponse({ error: "Memory purge is unavailable. Confirm the shared D1 purge migration is applied." }, 503);
  }
}
