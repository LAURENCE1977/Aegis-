import {
  authorizePrincipal,
  isOwnerWriteRequest,
  jsonResponse,
  readJsonRequest,
} from "../../../lib/owner-api.mjs";
import { createMemoryRepository } from "../../../lib/memory-substrate.mjs";
import { getWorkspace } from "../../../lib/project-spaces.mjs";

const MAX_BODY = 6000;

export async function onRequestPost({ request, env, params }) {
  const auth = await authorizePrincipal(request, env);
  if (auth.response) return auth.response;
  const { principal } = auth;
  if (!isOwnerWriteRequest(request)) return jsonResponse({ error: "Invalid request origin." }, 403);
  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== "function") {
    return jsonResponse({ error: "Memory storage is not configured." }, 503);
  }

  const id = params?.id;
  if (typeof id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    return jsonResponse({ error: "Memory not found." }, 404);
  }
  const parsed = await readJsonRequest(request, MAX_BODY);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status);
  const body = parsed.body;
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).some(key => key !== "content") ||
      typeof body.content !== "string" || !body.content.trim() || body.content.length > 4000) {
    return jsonResponse({ error: "A corrected memory content value is required." }, 400);
  }

  const projectValue = new URL(request.url).searchParams.get("projectId");
  const projectId = projectValue === null || projectValue === "" ? null : projectValue;
  if (projectId !== null && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(projectId)) {
    return jsonResponse({ error: "Invalid project scope." }, 400);
  }

  try {
    const repository = createMemoryRepository(env.AEGIS_DB);
    const prior = await repository.get(id, { ownerId: principal.principalId,
      principalId: principal.principalId,
      tenantId: principal.tenantId, projectId });
    if (!prior || prior.status !== "accepted") {
      return jsonResponse({ error: "Only an accepted memory can be corrected." }, 404);
    }
    if (projectId !== null) {
      const project = await getWorkspace(env.AEGIS_DB, principal, projectId);
      if (!project || project.status !== "active") {
        return jsonResponse({ error: "Memory not found." }, 404);
      }
    }

    const now = new Date().toISOString();
    const correction = {
      id: crypto.randomUUID(),
      ownerId: principal.principalId,
      principalId: principal.principalId,
      tenantId: principal.tenantId,
      projectId: prior.projectId,
      supersedesId: prior.id,
      kind: prior.kind,
      content: body.content.trim(),
      source: {
        type: "user-stated",
        url: "https://aegis.local/corrections/" + prior.id,
        attribution: "Owner correction to memory " + prior.id,
        observedAt: now,
      },
      confidence: 1,
      sensitivity: prior.sensitivity,
      status: "candidate",
      tags: prior.tags,
      createdAt: now,
      updatedAt: now,
      expiresAt: prior.expiresAt,
    };
    const memory = await repository.create(correction);
    return jsonResponse({ memory, reviewRequired: true }, 201);
  } catch (error) {
    if (error instanceof TypeError) return jsonResponse({ error: "Corrected memory is invalid." }, 400);
    return jsonResponse({ error: "A correction is already pending or the memory could not be corrected." }, 409);
  }
}
