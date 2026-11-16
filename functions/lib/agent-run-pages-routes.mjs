import { authorizeOwner, isOwnerWriteRequest, jsonResponse } from './owner-api.mjs';
import { proxyAgentRuntime } from './agent-runtime-proxy.mjs';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validRunId(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function validEventsQuery(url) {
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
        !/^[A-Za-z0-9:_-]{1,180}$/.test(beforeId)) return false;
  }
  return true;
}

export function createAgentRunDetailHandlers(proxy = proxyAgentRuntime) {
  return {
    async onRequestGet({ request, env, params }) {
      const denied = await authorizeOwner(request, env);
      if (denied) return denied;
      if (!validRunId(params?.id)) return jsonResponse({ error: 'Invalid agent run identifier.' }, 400);
      return proxy({ env, method: 'GET', path: '/v1/agent-runs/' + params.id });
    },
  };
}

export function createAgentRunEventsHandlers(proxy = proxyAgentRuntime) {
  return {
    async onRequestGet({ request, env, params }) {
      const denied = await authorizeOwner(request, env);
      if (denied) return denied;
      if (!validRunId(params?.id)) return jsonResponse({ error: 'Invalid agent run identifier.' }, 400);
      const url = new URL(request.url);
      if (!validEventsQuery(url)) return jsonResponse({ error: 'Invalid agent run event query.' }, 400);
      return proxy({
        env,
        method: 'GET',
        path: '/v1/agent-runs/' + params.id + '/events' + url.search,
      });
    },
  };
}

export function createAgentRunCancelHandlers(proxy = proxyAgentRuntime) {
  return {
    async onRequestPost({ request, env, params }) {
      const denied = await authorizeOwner(request, env);
      if (denied) return denied;
      if (!isOwnerWriteRequest(request)) return jsonResponse({ error: 'Cross-origin request rejected.' }, 403);
      if (!validRunId(params?.id)) return jsonResponse({ error: 'Invalid agent run identifier.' }, 400);
      return proxy({ env, method: 'POST', path: '/v1/agent-runs/' + params.id + '/cancel' });
    },
  };
}
