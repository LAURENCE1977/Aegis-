import { authorizeOwner, jsonResponse } from "../../lib/owner-api.mjs";
import { createMemoryRepository } from "../../lib/memory-substrate.mjs";
import { getWorkspace } from "../../lib/project-spaces.mjs";

const OWNER_ID = "owner";

function parseProjectId(value) {
  if (value === null) return undefined;
  if (value === "") return null;
  if (typeof value !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) return null;
  return value;
}

export async function onRequestGet({ request, env }) {
  const denied = await authorizeOwner(request, env);
  if (denied) return denied;
  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== "function") {
    return jsonResponse({ error: "Memory storage is not configured." }, 503);
  }

  const url = new URL(request.url);
  const projectId = parseProjectId(url.searchParams.get("projectId"));
  if (projectId === null) return jsonResponse({ error: "Invalid project scope." }, 400);

  try {
    if (projectId !== undefined) {
      const project = await getWorkspace(env.AEGIS_DB, OWNER_ID, projectId);
      if (!project || project.status !== "active") {
        return jsonResponse({ error: "Project not found." }, 404);
      }
    }
    const data = await createMemoryRepository(env.AEGIS_DB).exportAll({
      ownerId: OWNER_ID,
      projectId,
      memoryLimit: 500,
      eventLimit: 2000,
    });
    return new Response(JSON.stringify({
      schemaVersion: "1.0",
      exportedAt: new Date().toISOString(),
      scope: projectId === undefined ? "owner-all-projects" : projectId === null ? "personal" : "project",
      projectId: projectId ?? null,
      ...data,
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": 'attachment; filename="aegis-memory-export.json"',
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return jsonResponse({ error: "Memory export is temporarily unavailable." }, 503);
  }
}
