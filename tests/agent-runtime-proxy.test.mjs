import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgentRuntimeProxy } from '../functions/lib/agent-runtime-proxy.mjs';

const token = 'agent-runtime-proxy-test-token-with-at-least-32-characters';
const env = {
  AEGIS_RUNTIME_URL: 'https://aegis-runtime.example',
  AEGIS_JOB_TOKEN: token,
};

test('proxies only fixed agent runtime paths with a server-side bearer token', async () => {
  let captured;
  const proxy = createAgentRuntimeProxy(async (url, options) => {
    captured = { url: String(url), options };
    return new Response(JSON.stringify({ runs: [], nextCursor: null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  const response = await proxy({
    env,
    method: 'GET',
    path: '/v1/agent-runs?limit=10',
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { runs: [], nextCursor: null });
  assert.equal(captured.url, 'https://aegis-runtime.example/v1/agent-runs?limit=10');
  assert.equal(captured.options.method, 'GET');
  assert.equal(captured.options.redirect, 'error');
  assert.equal(captured.options.headers.get('Authorization'), 'Bearer ' + token);
  assert.equal(captured.options.headers.get('Accept'), 'application/json');
  assert.equal(captured.options.headers.has('Cookie'), false);
});

test('sends bounded JSON and idempotency key without forwarding browser credentials', async () => {
  let captured;
  const proxy = createAgentRuntimeProxy(async (url, options) => {
    captured = { url: String(url), options };
    return new Response(JSON.stringify({ run: { id: 'run-1', status: 'queued' } }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  const response = await proxy({
    env,
    method: 'POST',
    path: '/v1/agent-runs',
    body: { objective: 'Review the runtime', specialists: ['researcher'] },
    idempotencyKey: 'agent-request-0001',
  });

  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { run: { id: 'run-1', status: 'queued' } });
  assert.equal(captured.options.headers.get('Content-Type'), 'application/json');
  assert.equal(captured.options.headers.get('Idempotency-Key'), 'agent-request-0001');
  assert.equal(captured.options.headers.has('Cookie'), false);
  assert.equal(captured.options.headers.has('Origin'), false);
  assert.equal(captured.options.body, JSON.stringify({
    objective: 'Review the runtime', specialists: ['researcher'],
  }));
});

test('fails closed when runtime URL or token is missing or unsafe', async () => {
  let calls = 0;
  const proxy = createAgentRuntimeProxy(async () => {
    calls += 1;
    return new Response('{}', { headers: { 'Content-Type': 'application/json' } });
  });

  for (const invalidEnv of [
    {},
    { AEGIS_RUNTIME_URL: 'http://runtime.example', AEGIS_JOB_TOKEN: token },
    { AEGIS_RUNTIME_URL: 'https://user:pass@runtime.example', AEGIS_JOB_TOKEN: token },
    { AEGIS_RUNTIME_URL: 'https://runtime.example/path', AEGIS_JOB_TOKEN: token },
    { AEGIS_RUNTIME_URL: env.AEGIS_RUNTIME_URL, AEGIS_JOB_TOKEN: 'short' },
  ]) {
    const response = await proxy({
      env: invalidEnv,
      method: 'GET',
      path: '/v1/agent-runs',
    });
    assert.equal(response.status, 503);
  }
  assert.equal(calls, 0);
});

test('rejects arbitrary paths, unsupported methods and invalid idempotency keys before fetch', async () => {
  let calls = 0;
  const proxy = createAgentRuntimeProxy(async () => {
    calls += 1;
    return new Response('{}', { headers: { 'Content-Type': 'application/json' } });
  });

  for (const request of [
    { method: 'GET', path: 'https://attacker.example/' },
    { method: 'DELETE', path: '/v1/agent-runs' },
    { method: 'GET', path: '/v1/jobs' },
    { method: 'POST', path: '/v1/agent-runs', idempotencyKey: 'bad key' },
  ]) {
    const response = await proxy({ env, ...request });
    assert.equal(response.status, 400);
  }
  assert.equal(calls, 0);
});

test('rejects oversized or non-JSON upstream responses', async () => {
  const tooLarge = createAgentRuntimeProxy(async () => new Response('x'.repeat(20), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Content-Length': '70000' },
  }));
  const oversized = await tooLarge({ env, method: 'GET', path: '/v1/agent-runs' });
  assert.equal(oversized.status, 502);

  const nonJson = createAgentRuntimeProxy(async () => new Response('<html>login</html>', {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
  }));
  const invalid = await nonJson({ env, method: 'GET', path: '/v1/agent-runs' });
  assert.equal(invalid.status, 502);
});

test('normalizes upstream network failures without leaking provider details', async () => {
  const proxy = createAgentRuntimeProxy(async () => {
    throw new Error('secret internal endpoint detail');
  });
  const response = await proxy({ env, method: 'GET', path: '/v1/agent-runs' });
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: 'Agent runtime is temporarily unavailable.' });
});
