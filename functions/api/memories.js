import {
  authorizePrincipal,
  isOwnerWriteRequest,
  jsonResponse,
  readJsonRequest,
} from "../lib/owner-api.mjs";
import { createMemoryRepository } from "../lib/memory-substrate.mjs";
import { getWorkspace } from "../lib/project-spaces.mjs";
import { scrubSensitiveData } from "../lib/data-guards.mjs";

const MAX_BODY = 8192;

function parseProjectId(value) {
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) return undefined;
  return value;
}

async function projectIsAvailable(db, principal, projectId) {
  if (projectId === null) return true;
  const project = await getWorkspace(db, principal, projectId);
  return Boolean(project && project.status === "active");
}

export async function onRequestGet({ request, env }) {
  const auth = await authorizePrincipal(request, env);
  if (auth.response) return auth.response;
  const { principal } = auth;
  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== "function") {
    return jsonResponse({ error: "Memory storage is not configured." }, 503);
  }

  const url = new URL(request.url);
  const projectId = parseProjectId(url.searchParams.get("projectId"));
  if (projectId === undefined) return jsonResponse({ error: "Invalid project scope." }, 400);
  const rawLimit = url.searchParams.get("limit");
  const limit = rawLimit === null ? 20 : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    return jsonResponse({ error: "Memory limit must be between 1 and 50." }, 400);
  }

  try {
    if (!(await projectIsAvailable(env.AEGIS_DB, principal, projectId))) {
      return jsonResponse({ error: "Project not found." }, 404);
    }
    const repository = createMemoryRepository(env.AEGIS_DB);
    const query = url.searchParams.get("q");
    const includeCandidates = url.searchParams.get("review") === "1";
    const memories = query
      ? await repository.search({ principalId: principal.principalId, tenantId: principal.tenantId, ownerId: principal.principalId, projectId, query, limit })
      : await repository.list({ principalId: principal.principalId, tenantId: principal.tenantId, ownerId: principal.principalId, projectId, limit, includeCandidates });
    return jsonResponse({ memories, total: memories.length });
  } catch {
    return jsonResponse({ error: "Memory search is temporarily unavailable." }, 503);
  }
}

export async function onRequestPost({ request, env }) {
  const auth = await authorizePrincipal(request, env);
  if (auth.response) return auth.response;
  const { principal } = auth;
  if (!isOwnerWriteRequest(request)) return jsonResponse({ error: "Invalid request origin." }, 403);
  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== "function") {
    return jsonResponse({ error: "Memory storage is not configured." }, 503);
  }

  const parsed = await readJsonRequest(request, MAX_BODY);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status);
  const scrubbed = scrubSensitiveData(parsed.body, { piiValues: env.AEGIS_PII_VALUES ?? [] });
  if (!scrubbed.ok) return jsonResponse({ error: "Memory payload could not be safely classified." }, 400);
  const body = scrubbed.value;
  const allowed = ["projectId", "kind", "content", "source", "confidence", "sensitivity", "tags", "expiresAt"];
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).some((key) => !allowed.includes(key)) ||
      typeof body.kind !== "string" || typeof body.content !== "string" ||
      !body.source || typeof body.source !== "object" || Array.isArray(body.source) ||
      Object.keys(body.source).some((key) => !["type", "url", "attribution", "observedAt"].includes(key)) ||
      !["user-stated", "conversation", "document", "external-source"].includes(body.source.type) || typeof body.source.url !== "string" ||
      typeof body.source.attribution !== "string" ||
      (body.source.observedAt !== undefined && typeof body.source.observedAt !== "string") ||
      (body.projectId !== undefined && typeof body.projectId !== "string") ||
      (body.confidence !== undefined && typeof body.confidence !== "number") ||
      (body.sensitivity !== undefined && typeof body.sensitivity !== "string") ||
      (body.tags !== undefined && !Array.isArray(body.tags)) ||
      (body.expiresAt !== undefined && body.expiresAt !== null && typeof body.expiresAt !== "string")) {
    return jsonResponse({ error: "Memory fields are invalid." }, 400);
  }

  const projectId = parseProjectId(body.projectId ?? null);
  if (projectId === undefined) return jsonResponse({ error: "Invalid project scope." }, 400);
  const now = new Date().toISOString();
  try {
    if (!(await projectIsAvailable(env.AEGIS_DB, projectId))) {
      return jsonResponse({ error: "Project not found." }, 404);
    }
    const record = {
      id: crypto.randomUUID(),
      ownerId: principal.principalId,
      principalId: principal.principalId,
      tenantId: principal.tenantId,
      projectId,
      kind: body.kind,
      content: body.content,
      source: {
        type: body.source.type,
        url: body.source.url,
        attribution: body.source.attribution,
        observedAt: body.source.observedAt ?? now,
        trust: "untrusted",
      },
      confidence: body.confidence ?? 0.5,
      sensitivity: body.sensitivity ?? "private",
      status: "candidate",
      tags: body.tags ?? [],
      createdAt: now,
      updatedAt: now,
      expiresAt: body.expiresAt ?? null,
    };
    const repository = createMemoryRepository(env.AEGIS_DB);
    const memory = await repository.create(record);
    return jsonResponse({ memory, reviewRequired: true }, 201);
  } catch (error) {
    if (error instanceof TypeError) return jsonResponse({ error: "Memory record is invalid." }, 400);
    return jsonResponse({ error: "Memory could not be saved." }, 503);
  }
}
