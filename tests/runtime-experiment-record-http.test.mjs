import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRuntimeFetch } from '../workers/runtime/index.mjs';

const token = 'experiment-record-runtime-test-token-with-at-least-32-characters';

function request(path, { method = 'GET', body, principal = 'owner', authorization = 'Bearer ' + token } = {}) {
  const headers = {};
  if (authorization) headers.Authorization = authorization;
  if (principal !== null) headers['X-Aegis-Principal'] = principal;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return new Request('https://runtime.example' + path, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

test('experiment record runtime routes require the service bearer token before accessing D1', async () => {
  let databaseCalls = 0;
  const response = await handleRuntimeFetch(
    request('/v1/experiment-records', { authorization: 'Bearer wrong-token' }),
    {
      AEGIS_JOB_TOKEN: token,
      DB: { prepare() { databaseCalls += 1; throw new Error('must not access D1'); } },
    },
  );
  assert.equal(response.status, 401);
  assert.equal(databaseCalls, 0);
});

test('experiment record runtime routes require a trusted server-supplied principal header', async () => {
  const response = await handleRuntimeFetch(
    request('/v1/experiment-records', { principal: null }),
    { AEGIS_JOB_TOKEN: token, DB: { prepare() { throw new Error('must not query'); } } },
  );
  assert.equal(response.status, 400);
});

test('experiment record runtime routes reject malformed cursors before querying D1', async () => {
  const response = await handleRuntimeFetch(
    request('/v1/experiment-records?cursor=not-json'),
    { AEGIS_JOB_TOKEN: token, DB: { prepare() { throw new Error('must not query'); } } },
  );
  assert.equal(response.status, 400);
});

test('experiment record runtime routes reject malformed append envelopes', async () => {
  const response = await handleRuntimeFetch(
    request('/v1/experiment-records', { method: 'POST', body: { record: null } }),
    { AEGIS_JOB_TOKEN: token, DB: { prepare() { return { bind() { return this; }, run() { throw new Error('must not persist'); } }; } } },
  );
  assert.equal(response.status, 400);
});

test('experiment record runtime routes fail closed when D1 is unavailable', async () => {
  const response = await handleRuntimeFetch(
    request('/v1/experiment-records'),
    { AEGIS_JOB_TOKEN: token },
  );
  assert.equal(response.status, 503);
});
