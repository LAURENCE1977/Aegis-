import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken } from '../functions/lib/auth.mjs';
import { createAgentRuntimeProxy } from '../functions/lib/agent-runtime-proxy.mjs';
import { createAgentRunsHandlers } from '../functions/api/agent-runs.js';
import {
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
