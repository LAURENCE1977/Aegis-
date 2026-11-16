import { authorizeOwner, isOwnerWriteRequest, jsonResponse, readJsonRequest } from '../lib/owner-api.mjs';
import { proxyAgentRuntime } from '../lib/agent-runtime-proxy.mjs';

const MAX_BODY_BYTES = 8 * 1024;
const ALLOWED_SPECIALISTS = new Set(['researcher', 'planner', 'engineer', 'security', 'reviewer']);
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

function validSubmission(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).some((key) => !['objective', 'specialists'].includes(key))) return false;
  if (typeof input.objective !== 'string') return false;
  const objective = input.objective.trim();
  if (!objective || objective.length > 2000 ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(objective)) return false;
  if (input.specialists === undefined) return true;
  return Array.isArray(input.specialists) && input.specialists.length >= 1 &&
    input.specialists.length <= ALLOWED_SPECIALISTS.size &&
    input.specialists.every((role) => typeof role === 'string' && ALLOWED_SPECIALISTS.has(role)) &&
    new Set(input.specialists).size === input.specialists.length;
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

export function createAgentRunsHandlers(proxy = proxyAgentRuntime) {
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
      return proxy({
        env,
        method: 'POST',
        path: '/v1/agent-runs',
        body: {
          objective: parsed.body.objective.trim(),
          ...(parsed.body.specialists === undefined ? {} : { specialists: parsed.body.specialists }),
        },
        ...(idempotencyKey === null ? {} : { idempotencyKey }),
      });
    },
  };
}

const handlers = createAgentRunsHandlers();
export const onRequestGet = handlers.onRequestGet;
export const onRequestPost = handlers.onRequestPost;
