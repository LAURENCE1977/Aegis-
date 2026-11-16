import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRuntimeFetch } from '../workers/runtime/index.mjs';

const token = 'runtime-test-token-with-at-least-32-characters';

function request(path = '/health', { authorization = 'Bearer ' + token, origin } = {}) {
  const headers = {};
  if (authorization) headers.Authorization = authorization;
  if (origin) headers.Origin = origin;
  return new Request('https://runtime.example' + path, { headers });
}

test('runtime fails closed when its authentication secret is missing', async () => {
  const response = await handleRuntimeFetch(request(), {});
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('runtime rejects an invalid bearer token before accessing bindings', async () => {
  const response = await handleRuntimeFetch(
    request('/health', { authorization: 'Bearer wrong-token' }),
    { AEGIS_JOB_TOKEN: token },
  );
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('WWW-Authenticate'), 'Bearer');
});

test('runtime rejects hostile browser origins', async () => {
  const response = await handleRuntimeFetch(
    request('/health', { origin: 'https://attacker.example' }),
    { AEGIS_JOB_TOKEN: token },
  );
  assert.equal(response.status, 403);
});

test('runtime health endpoint does not claim readiness without D1 and Queue bindings', async () => {
  const response = await handleRuntimeFetch(request('/health'), { AEGIS_JOB_TOKEN: token });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { ok: false, service: 'aegis-runtime' });
});
