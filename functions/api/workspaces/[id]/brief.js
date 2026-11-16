import { authorizeOwner, jsonResponse } from "../../../lib/owner-api.mjs";
import { getWorkspace, listWorkspaceEvents } from "../../../lib/project-spaces.mjs";
import { createMemoryRepository } from "../../../lib/memory-substrate.mjs";
import { buildProjectBrief } from "../../../lib/project-brief.mjs";

const OWNER_ID = "owner";
const DEFAULT_MAX_CHARS = 6000;
const MIN_MAX_CHARS = 1000;
const MAX_MAX_CHARS = 12000;

export async function onRequestGet({ request, env, params }) {
  const denied = await authorizeOwner(request, env);
  if (denied) return denied;
  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== "function") {
    return jsonResponse({ error: "Project Space storage is not configured." }, 503);
  }
  const id = params?.id;
  if (typeof id !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(id)) {
    return jsonResponse({ error: "Project Space not found." }, 404);
  }
  const url = new URL(request.url);
  const rawMaxChars = url.searchParams.get("maxChars");
  const maxChars = rawMaxChars === null ? DEFAULT_MAX_CHARS : Number(rawMaxChars);
  if (!Number.isInteger(maxChars) || maxChars < MIN_MAX_CHARS || maxChars > MAX_MAX_CHARS) {
    return jsonResponse({ error: "maxChars must be between 1000 and 12000." }, 400);
  }

  try {
    const workspace = await getWorkspace(env.AEGIS_DB, OWNER_ID, id);
    if (!workspace || workspace.status !== "active") {
      return jsonResponse({ error: "Project Space not found." }, 404);
    }
    const [events, memories] = await Promise.all([
      listWorkspaceEvents(env.AEGIS_DB, OWNER_ID, id, 100),
      createMemoryRepository(env.AEGIS_DB).list({
        ownerId: OWNER_ID,
        projectId: id,
        limit: 50,
      }),
    ]);
    if (!events) return jsonResponse({ error: "Project Space not found." }, 404);
    const brief = buildProjectBrief({
      workspace,
      events,
      memories,
      maxChars,
      now: Date.now(),
    });
    return jsonResponse({ brief });
  } catch {
    return jsonResponse({ error: "Project Space handover brief is temporarily unavailable." }, 503);
  }
}
