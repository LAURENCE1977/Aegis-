import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken } from '../functions/lib/auth.mjs';
import { createAgentRuntimeProxy } from '../functions/lib/agent-runtime-proxy.mjs';
import { createAgentRunsHandlers } from '../functions/api/agent-runs.js';
import {
  createAgentRunAgUiHandlers,
  createAgentRunCancelHandlers,
  createAgentRunDetailHandlers,
  createAgentRunEventsHandlers,
} from '../functions/lib/agent-run-pages-routes.mjs';

const sessionSecret = 'agent-runtime-pages-test-session-secret-long-enough';
const runtimeToken = 'agent-runtime-pages-test-token-long-enough-for-bearer';
const env = {
  AEGIS_PASSWORD: 'test-password-long-enough',
  AEGIS_SESSION_SECRET: sessionSecret,
  AEGIS_RUNTIME_URL: 'https://runtime.example',
  AEGIS_JOB_TOKEN: runtimeToken,
};

async function request(path, { method = 'GET', authenticated = true, origin = null, body, headers = {} } = {}) {
  const requestHeaders = { ...headers };
  if (authenticated) {
    requestHeaders.Cookie = '__Host-aegis_session=' + await createSessionToken(sessionSecret);
  }
  if (origin !== null) requestHeaders.Origin = origin;
  if (body !== undefined) requestHeaders['Content-Type'] = 'application/json';
  return new Request('https://aegis.example' + path, {
    method,
    headers: requestHeaders,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

test('agent run list endpoint requires the owner session before calling runtime', async () => {
  let calls = 0;
  const handlers = createAgentRunsHandlers(async () => { calls += 1; });
  const response = await handlers.onRequestGet({
    request: await request('/api/agent-runs', { authenticated: false }),
    env,
  });
  assert.equal(response.status, 401);
  assert.equal(calls, 0);
});

test('agent run list endpoint forwards only bounded pagination parameters', async () => {
  let captured;
  const proxy = createAgentRuntimeProxy(async (url, options) => {
    captured = { url: String(url), options };
    return new Response(JSON.stringify({ runs: [], nextCursor: null }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  });
  const handlers = createAgentRunsHandlers(proxy);
  const response = await handlers.onRequestGet({
    request: await request('/api/agent-runs?limit=10'),
    env,
  });
  assert.equal(response.status, 200);
  assert.equal(captured.url, 'https://runtime.example/v1/agent-runs?limit=10');
  assert.equal(captured.options.headers.get('Authorization'), 'Bearer ' + runtimeToken);
});

test('agent run submission rejects unknown fields and cross-origin requests', async () => {
  let calls = 0;
  const handlers = createAgentRunsHandlers(async () => { calls += 1; });
  const crossOrigin = await handlers.onRequestPost({
    request: await request('/api/agent-runs', {
      method: 'POST', origin: 'https://attacker.example', body: { objective: 'Review' },
    }),
    env,
  });
  assert.equal(crossOrigin.status, 403);

  const unknown = await handlers.onRequestPost({
    request: await request('/api/agent-runs', {
      method: 'POST', origin: 'https://aegis.example',
      body: { objective: 'Review', tools: ['shell.exec'] },
    }),
    env,
  });
  assert.equal(unknown.status, 400);
  assert.equal(calls, 0);
});

test('agent run submission forwards only the approved objective and specialist fields', async () => {
  let captured;
  const proxy = async (args) => { captured = args; return new Response(JSON.stringify({ run: { id: 'run-1' } }), { headers: { 'Content-Type': 'application/json' } }); };
  const handlers = createAgentRunsHandlers(proxy);
  const response = await handlers.onRequestPost({
    request: await request('/api/agent-runs', {
      method: 'POST', origin: 'https://aegis.example',
      headers: { 'Idempotency-Key': 'agent-request-0001' },
      body: { objective: '  Review runtime  ', specialists: ['researcher', 'reviewer'] },
    }),
    env,
  });
  assert.equal(response.status, 200);
  assert.deepEqual(captured, {
    env,
    method: 'POST',
    path: '/v1/agent-runs',
    body: { objective: 'Review runtime', specialists: ['researcher', 'reviewer'] },
    idempotencyKey: 'agent-request-0001',
  });
});

test('agent run submission derives Project Space context server-side for the selected project', async () => {
  let captured;
  let builderCall;
  const projectContext = {
    brief: { schemaVersion: '1.0', workspace: { id: 'project-a' } },
    digest: 'sha256:' + 'a'.repeat(64),
  };
  const db = { prepare() {} };
  const proxy = async (args) => {
    captured = args;
    return new Response(JSON.stringify({ run: { id: 'run-project-1' } }), {
      headers: { 'Content-Type': 'application/json' },
    });
  };
  const builder = async (database, projectId) => {
    builderCall = { database, projectId };
    return projectContext;
  };
  const handlers = createAgentRunsHandlers(proxy, builder);
  const response = await handlers.onRequestPost({
    request: await request('/api/agent-runs', {
      method: 'POST', origin: 'https://aegis.example',
      body: {
        objective: 'Review the selected project',
        specialists: ['researcher', 'reviewer'],
        projectId: 'project-a',
      },
    }),
    env: { ...env, AEGIS_DB: db },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(builderCall, { database: db, projectId: 'project-a' });
  assert.deepEqual(captured.body, {
    objective: 'Review the selected project',
    specialists: ['researcher', 'reviewer'],
    projectContext,
  });
});

test('agent run submission rejects client-supplied context and fails closed for unavailable projects', async () => {
  let calls = 0;
  const proxy = async () => { calls += 1; return new Response('{}'); };
  const handlers = createAgentRunsHandlers(proxy, async () => null);
  const suppliedContext = await handlers.onRequestPost({
    request: await request('/api/agent-runs', {
      method: 'POST', origin: 'https://aegis.example',
      body: { objective: 'Review', projectContext: { brief: {}, digest: 'sha256:' + '0'.repeat(64) } },
    }),
    env,
  });
  assert.equal(suppliedContext.status, 400);

  const missingDatabase = await handlers.onRequestPost({
    request: await request('/api/agent-runs', {
      method: 'POST', origin: 'https://aegis.example',
      body: { objective: 'Review', projectId: 'project-a' },
    }),
    env,
  });
  assert.equal(missingDatabase.status, 503);

  const unavailableProject = await handlers.onRequestPost({
    request: await request('/api/agent-runs', {
      method: 'POST', origin: 'https://aegis.example',
      body: { objective: 'Review', projectId: 'project-a' },
    }),
    env: { ...env, AEGIS_DB: { prepare() {} } },
  });
  assert.equal(unavailableProject.status, 404);
  assert.equal(calls, 0);
});

test('detail and event routes validate run IDs and event cursors before proxying', async () => {
  let calls = 0;
  const proxy = async () => { calls += 1; return new Response('{}'); };
  const detail = createAgentRunDetailHandlers(proxy);
  const events = createAgentRunEventsHandlers(proxy);
  const invalidId = await detail.onRequestGet({
    request: await request('/api/agent-runs/not-a-uuid'),
    env, params: { id: 'not-a-uuid' },
  });
  assert.equal(invalidId.status, 400);

  const duplicateCursor = await events.onRequestGet({
    request: await request('/api/agent-runs/00000000-0000-4000-8000-000000000001/events?limit=1&limit=2'),
    env, params: { id: '00000000-0000-4000-8000-000000000001' },
  });
  assert.equal(duplicateCursor.status, 400);
  assert.equal(calls, 0);
});

test('agent run cancel route requires same-origin owner action and uses the fixed cancel path', async () => {
  let captured;
  const cancel = createAgentRunCancelHandlers(async (args) => {
    captured = args;
    return new Response(JSON.stringify({ cancelled: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  });
  const id = '00000000-0000-4000-8000-000000000001';
  const denied = await cancel.onRequestPost({
    request: await request('/api/agent-runs/' + id + '/cancel', {
      method: 'POST', origin: 'https://attacker.example',
    }),
    env, params: { id },
  });
  assert.equal(denied.status, 403);

  const allowed = await cancel.onRequestPost({
    request: await request('/api/agent-runs/' + id + '/cancel', {
      method: 'POST', origin: 'https://aegis.example',
    }),
    env, params: { id },
  });
  assert.equal(allowed.status, 200);
  assert.equal(captured.path, '/v1/agent-runs/' + id + '/cancel');
  assert.equal(captured.method, 'POST');
});


test('AG-UI replay is owner-only, bounded, and emits a valid terminal 1.0 SSE stream', async () => {
  const id = '00000000-0000-4000-8000-000000000001';
  const calls = [];
  const proxy = async (args) => {
    calls.push(args.path);
    if (args.path === '/v1/agent-runs/' + id) {
      return new Response(JSON.stringify({ run: {
        id, status: 'planned',
        createdAt: '2026-11-16T10:00:00.000Z',
        updatedAt: '2026-11-16T10:00:02.000Z',
      } }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (args.path === '/v1/agent-runs/' + id + '/events?limit=50') {
      return new Response(JSON.stringify({
        events: [{
          id: 'event-2', type: 'planned',
          detail: { privatePrompt: 'must not be emitted' },
          createdAt: '2026-11-16T10:00:02.000Z',
        }],
        nextCursor: { before: '2026-11-16T10:00:01.000Z', beforeId: 'event-1' },
      }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (args.path === '/v1/agent-runs/' + id + '/events?limit=50&before=2026-11-16T10%3A00%3A01.000Z&beforeId=event-1') {
      return new Response(JSON.stringify({
        events: [{
          id: 'event-1', type: 'running',
          detail: { privateToken: 'must not be emitted' },
          createdAt: '2026-11-16T10:00:01.000Z',
        }],
        nextCursor: null,
      }), { headers: { 'Content-Type': 'application/json' } });
    }
    throw new Error('Unexpected runtime path: ' + args.path);
  };
  const handlers = createAgentRunAgUiHandlers(proxy);
  const response = await handlers.onRequestGet({
    request: await request('/api/agent-runs/' + id + '/ag-ui'),
    env, params: { id },
  });

  assert.equal(response.status, 200);
  assert.match(response.headers.get('Content-Type'), /^text\/event-stream/);
  assert.equal(response.headers.get('Cache-Control'), 'no-store, no-transform');
  const sseBody = await response.text();
  const frames = sseBody.trim().split('\n\n');
  const events = frames.map((frame) => {
    assert.ok(frame.startsWith('data: '));
    return JSON.parse(frame.slice(6));
  });
  assert.equal(events[0].type, 'RUN_STARTED');
  assert.equal(events[0].threadId, id);
  assert.equal(events[0].runId, id);
  assert.equal(events[0].protocolVersion, '1.0');
  assert.deepEqual(events.slice(1, 3).map((event) => event.value.eventId), ['event-1', 'event-2']);
  assert.ok(events.slice(1, 3).every((event) =>
    event.type === 'CUSTOM' && event.name === 'aegis.agent_run.lifecycle'
  ));
  assert.equal(events[3].type, 'RUN_FINISHED');
  assert.deepEqual(events[3].outcome, { type: 'success' });
  assert.doesNotMatch(sseBody, /privatePrompt|privateToken/);
  assert.equal(calls.length, 3);
});

test('AG-UI replay refuses active runs and does not fetch event pages for them', async () => {
  const id = '00000000-0000-4000-8000-000000000002';
  let calls = 0;
  const handlers = createAgentRunAgUiHandlers(async () => {
    calls += 1;
    return new Response(JSON.stringify({ run: {
      id, status: 'running', createdAt: '2026-11-16T10:00:00.000Z',
    } }), { headers: { 'Content-Type': 'application/json' } });
  });
  const response = await handlers.onRequestGet({
    request: await request('/api/agent-runs/' + id + '/ag-ui'),
    env, params: { id },
  });
  assert.equal(response.status, 409);
  assert.equal(calls, 1);
});

test('AG-UI replay maps cancelled and failed runs to their distinct terminal event forms', async () => {
  const id = '00000000-0000-4000-8000-000000000003';
  for (const [status, terminalType] of [['cancelled', 'RUN_FINISHED'], ['failed', 'RUN_ERROR']]) {
    const handlers = createAgentRunAgUiHandlers(async ({ path }) => {
      if (path === '/v1/agent-runs/' + id) {
        return new Response(JSON.stringify({ run: {
          id, status, errorCode: status === 'failed' ? 'JOB_DELIVERY_EXHAUSTED' : null,
          createdAt: '2026-11-16T10:00:00.000Z',
        } }), { headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ events: [], nextCursor: null }), {
        headers: { 'Content-Type': 'application/json' },
      });
    });
    const response = await handlers.onRequestGet({
      request: await request('/api/agent-runs/' + id + '/ag-ui'),
      env, params: { id },
    });
    const frames = (await response.text()).trim().split('\n\n');
    const terminal = JSON.parse(frames.at(-1).slice(6));
    assert.equal(terminal.type, terminalType);
    if (status === 'cancelled') assert.deepEqual(terminal.outcome, { type: 'cancelled' });
    else {
      assert.equal(terminal.code, 'JOB_DELIVERY_EXHAUSTED');
      assert.equal(terminal.message, 'Agent run failed.');
    }
  }
});

test('AG-UI replay rejects unauthenticated, invalid-ID, and unexpected-query requests before proxying', async () => {
  const id = '00000000-0000-4000-8000-000000000004';
  let calls = 0;
  const handlers = createAgentRunAgUiHandlers(async () => { calls += 1; });
  const unauthenticated = await handlers.onRequestGet({
    request: await request('/api/agent-runs/' + id + '/ag-ui', { authenticated: false }),
    env, params: { id },
  });
  assert.equal(unauthenticated.status, 401);
  const invalid = await handlers.onRequestGet({
    request: await request('/api/agent-runs/not-a-uuid/ag-ui'),
    env, params: { id: 'not-a-uuid' },
  });
  assert.equal(invalid.status, 400);
  const query = await handlers.onRequestGet({
    request: await request('/api/agent-runs/' + id + '/ag-ui?raw=1'),
    env, params: { id },
  });
  assert.equal(query.status, 400);
  assert.equal(calls, 0);
});
