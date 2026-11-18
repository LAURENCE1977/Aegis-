import { authorizeOwner, isOwnerWriteRequest, jsonResponse, readJsonRequest } from '../lib/owner-api.mjs';
import { proxyAgentRuntime } from '../lib/agent-runtime-proxy.mjs';
import { buildAgentRunProjectContext } from '../lib/agent-run-context.mjs';
import { validateAgentRunIntent } from '../lib/agent-contracts.mjs';

const MAX_BODY_BYTES = 8 * 1024;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;
const PROJECT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function validSubmission(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).some((key) => !['objective', 'specialists', 'projectId'].includes(key))) return false;
  if (input.projectId !== undefined &&
      (typeof input.projectId !== 'string' || !PROJECT_ID_PATTERN.test(input.projectId))) return false;
  try {
    validateAgentRunIntent({
      objective: input.objective,
      ...(input.specialists === undefined ? {} : { specialists: input.specialists }),
    });
    return true;
  } catch {
    return false;
  }
}

function validListQuery(url) {
  const allowed = new Set(['limit', 'before', 'beforeId']);
  for (const key of url.searchParams.keys()) {
    if (!allowed.has(key) || url.searchParams.getAll(key).length !== 1) return false;
  }
  const limit = url.searchParams.get('limit');
  if (limit !== null && !/^(?:[1-9]|[1-4][0-9]|50)$/.test(limit)) return false;
  const before = url.searchParams.get('before');
  const beforeId = url.searchParams.get('beforeId');
  if ((before === null) !== (beforeId === null)) return false;
  if (before !== null) {
    const parsed = Date.parse(before);
    if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== before ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(beforeId)) {
      return false;
    }
  }
  return true;
}

export function createAgentRunsHandlers(proxy = proxyAgentRuntime, buildProjectContext = buildAgentRunProjectContext) {
  return {
    async onRequestGet({ request, env }) {
      const denied = await authorizeOwner(request, env);
      if (denied) return denied;
      const url = new URL(request.url);
      if (!validListQuery(url)) return jsonResponse({ error: 'Invalid agent run list query.' }, 400);
      return proxy({ env, method: 'GET', path: '/v1/agent-runs' + url.search });
    },

    async onRequestPost({ request, env }) {
      const denied = await authorizeOwner(request, env);
      if (denied) return denied;
      if (!isOwnerWriteRequest(request)) return jsonResponse({ error: 'Cross-origin request rejected.' }, 403);
      const parsed = await readJsonRequest(request, MAX_BODY_BYTES);
      if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status);
      if (!validSubmission(parsed.body)) {
        return jsonResponse({ error: 'Provide an objective and optional unique list of known AEGIS specialists.' }, 400);
      }
      const idempotencyKey = request.headers.get('Idempotency-Key');
      if (idempotencyKey !== null && !IDEMPOTENCY_PATTERN.test(idempotencyKey)) {
        return jsonResponse({ error: 'Invalid Idempotency-Key.' }, 400);
      }
      let projectContext;
      if (parsed.body.projectId !== undefined) {
        if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== 'function') {
          return jsonResponse({ error: 'Project Space context is not available.' }, 503);
        }
        try {
          projectContext = await buildProjectContext(env.AEGIS_DB, parsed.body.projectId, Date.now(), validateAgentRunIntent({ objective: parsed.body.objective }).objective);
        } catch {
          return jsonResponse({ error: 'Project Space context could not be loaded.' }, 503);
        }
        if (!projectContext) return jsonResponse({ error: 'Active Project Space not found.' }, 404);
      }
      return proxy({
        env,
        method: 'POST',
        path: '/v1/agent-runs',
        body: {
          objective: validateAgentRunIntent({
            objective: parsed.body.objective,
            ...(parsed.body.specialists === undefined ? {} : { specialists: parsed.body.specialists }),
          }).objective,
          ...(parsed.body.specialists === undefined ? {} : { specialists: parsed.body.specialists }),
          ...(projectContext === undefined ? {} : { projectContext }),
        },
        ...(idempotencyKey === null ? {} : { idempotencyKey }),
      });
    },
  };
}

const handlers = createAgentRunsHandlers();
export const onRequestGet = handlers.onRequestGet;
export const onRequestPost = handlers.onRequestPost;
