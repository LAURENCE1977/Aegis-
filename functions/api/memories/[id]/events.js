import { authorizeOwner, jsonResponse } from "../../../lib/owner-api.mjs";
import { createMemoryRepository } from "../../../lib/memory-substrate.mjs";
import { getWorkspace } from "../../../lib/project-spaces.mjs";

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
    return jsonResponse({ error: "Memory history not found." }, 404);
  }
  const projectId = parseProjectId(new URL(request.url).searchParams.get("projectId"));
  if (projectId === undefined) return jsonResponse({ error: "Invalid project scope." }, 400);
  const rawLimit = new URL(request.url).searchParams.get("limit");
  const limit = rawLimit === null ? 50 : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return jsonResponse({ error: "Memory history limit must be between 1 and 100." }, 400);
  }

  try {
    if (projectId !== null) {
      const project = await getWorkspace(env.AEGIS_DB, OWNER_ID, projectId);
      if (!project || project.status !== "active") {
        return jsonResponse({ error: "Memory history not found." }, 404);
      }
    }
    const repository = createMemoryRepository(env.AEGIS_DB);
    const memory = await repository.get(id, { ownerId: OWNER_ID, projectId });
    if (!memory) return jsonResponse({ error: "Memory history not found." }, 404);
    const events = await repository.listEvents(id, { ownerId: OWNER_ID, projectId, limit });
    return jsonResponse({ events });
  } catch {
    return jsonResponse({ error: "Memory history is temporarily unavailable." }, 503);
  }
}
