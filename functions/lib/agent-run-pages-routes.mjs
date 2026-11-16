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


const AG_UI_EVENT_PAGE_LIMIT = 50;
const AG_UI_MAX_REPLAY_EVENTS = 200;

function eventTimestamp(value) {
  if (typeof value !== 'string') return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function jsonSseEvent(event) {
  return 'data: ' + JSON.stringify(event) + '\n\n';
}

async function readRuntimeJson(proxy, env, path) {
  const response = await proxy({ env, method: 'GET', path });
  if (!response.ok) return { response };
  const contentType = response.headers.get('Content-Type') || '';
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
    return { response: jsonResponse({ error: 'Agent runtime returned an invalid response.' }, 502) };
  }
  try {
    const payload = await response.json();
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return { response: jsonResponse({ error: 'Agent runtime returned an invalid response.' }, 502) };
    }
    return { payload };
  } catch {
    return { response: jsonResponse({ error: 'Agent runtime returned an invalid response.' }, 502) };
  }
}

export function createAgentRunAgUiHandlers(proxy = proxyAgentRuntime) {
  return {
    async onRequestGet({ request, env, params }) {
      const denied = await authorizeOwner(request, env);
      if (denied) return denied;
      if (!validRunId(params?.id)) return jsonResponse({ error: 'Invalid agent run identifier.' }, 400);
      if (new URL(request.url).search) return jsonResponse({ error: 'AG-UI replay does not accept query parameters.' }, 400);

      const runResult = await readRuntimeJson(proxy, env, '/v1/agent-runs/' + params.id);
      if (runResult.response) return runResult.response;
      const run = runResult.payload.run;
      if (!run || run.id !== params.id || typeof run.status !== 'string') {
        return jsonResponse({ error: 'Agent runtime returned an invalid run record.' }, 502);
      }
      if (!['planned', 'cancelled', 'failed'].includes(run.status)) {
        return jsonResponse({ error: 'AG-UI replay is available only after a run reaches a terminal state.' }, 409);
      }

      const events = [];
      const seenIds = new Set();
      let cursor = null;
      for (let page = 0; page < AG_UI_MAX_REPLAY_EVENTS / AG_UI_EVENT_PAGE_LIMIT; page += 1) {
        const query = new URLSearchParams({ limit: String(AG_UI_EVENT_PAGE_LIMIT) });
        if (cursor) {
          if (typeof cursor.before !== 'string' || typeof cursor.beforeId !== 'string') {
            return jsonResponse({ error: 'Agent runtime returned an invalid event cursor.' }, 502);
          }
          query.set('before', cursor.before);
          query.set('beforeId', cursor.beforeId);
        }
        const eventResult = await readRuntimeJson(
          proxy, env,
          '/v1/agent-runs/' + params.id + '/events?' + query.toString(),
        );
        if (eventResult.response) return eventResult.response;
        const pageEvents = eventResult.payload.events;
        if (!Array.isArray(pageEvents)) {
          return jsonResponse({ error: 'Agent runtime returned an invalid event page.' }, 502);
        }
        for (const event of pageEvents) {
          if (!event || typeof event.id !== 'string' || typeof event.type !== 'string' ||
              seenIds.has(event.id)) {
            return jsonResponse({ error: 'Agent runtime returned an invalid event record.' }, 502);
          }
          seenIds.add(event.id);
          events.push(event);
          if (events.length > AG_UI_MAX_REPLAY_EVENTS) {
            return jsonResponse({ error: 'Agent run has too many events for bounded replay.' }, 413);
          }
        }
        cursor = eventResult.payload.nextCursor || null;
        if (!cursor) break;
      }
      if (cursor) {
        return jsonResponse({ error: 'Agent run event history exceeds the replay limit.' }, 413);
      }

      events.reverse();
      const protocolEvents = [{
        type: 'RUN_STARTED',
        threadId: run.id,
        runId: run.id,
        protocolVersion: '1.0',
        ...(eventTimestamp(run.createdAt) === undefined ? {} : { timestamp: eventTimestamp(run.createdAt) }),
      }];

      for (const event of events) {
        const timestamp = eventTimestamp(event.createdAt);
        protocolEvents.push({
          type: 'CUSTOM',
          name: 'aegis.agent_run.lifecycle',
          value: { eventId: event.id, eventType: event.type },
          ...(timestamp === undefined ? {} : { timestamp }),
        });
      }

      const terminalTimestamp = eventTimestamp(run.updatedAt);
      if (run.status === 'failed') {
        const code = typeof run.errorCode === 'string' && /^[A-Z0-9_]{1,64}$/.test(run.errorCode)
          ? run.errorCode
          : 'AGENT_RUN_FAILED';
        protocolEvents.push({
          type: 'RUN_ERROR',
          message: 'Agent run failed.',
          code,
          ...(terminalTimestamp === undefined ? {} : { timestamp: terminalTimestamp }),
        });
      } else {
        protocolEvents.push({
          type: 'RUN_FINISHED',
          outcome: { type: run.status === 'cancelled' ? 'cancelled' : 'success' },
          result: { status: run.status },
          threadId: run.id,
          runId: run.id,
          ...(terminalTimestamp === undefined ? {} : { timestamp: terminalTimestamp }),
        });
      }

      return new Response(protocolEvents.map(jsonSseEvent).join(''), {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-store, no-transform',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    },
  };
}
