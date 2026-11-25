import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyApiPath, parseJsonNoDuplicates, withAegisImmunePipeline } from '../functions/lib/membrane/pipeline.mjs';
import { ROUTE_POLICIES, validateRoutePolicies } from '../functions/lib/membrane/route-policy.mjs';
import { deepScrub, ValidationError } from '../functions/lib/membrane/data-guards.mjs';
import { onRequest } from '../functions/_middleware.js';

const loginRequest = (body, headers = {}) => new Request('https://aegis.test/api/login', {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...headers },
  body,
});

test('API path classifier rejects encoded separators, backslashes and normalization ambiguity', () => {
  for (const path of ['/api%2Flogin', '/api%5Clogin', '/api\\login', '/assets/../api/login']) {
    assert.equal(classifyApiPath('https://aegis.test' + path).kind, 'invalid', path);
  }
  assert.equal(classifyApiPath('https://aegis.test/api/login').kind, 'api');
  assert.equal(classifyApiPath('https://aegis.test/assets/app.js').kind, 'public');
});

test('root middleware leaves static assets and existing non-login API routes untouched', async () => {
  for (const url of ['https://aegis.test/', 'https://aegis.test/api/ask', 'https://aegis.test/api/login']) {
    const request = new Request(url);
    let nextCalls = 0;
    const response = await onRequest[0]({ request, next: async (forwarded = request) => {
      nextCalls += 1;
      assert.equal(forwarded, request);
      return new Response('passed through');
    } });
    assert.equal(response.status, 200, url);
    assert.equal(nextCalls, 1, url);
  }
});

test('root middleware rejects ambiguous API paths before Pages route matching', async () => {
  const request = new Request('https://aegis.test/api%2Flogin', { method: 'POST', body: '{"password":"x"}' });
  let nextCalled = false;
  const response = await onRequest[0]({ request, next: async () => {
    nextCalled = true;
    return new Response('unsafe');
  } });
  assert.equal(response.status, 400);
  assert.equal(nextCalled, false);
});

test('login middleware reconstructs a valid request and preserves the credential exactly', async () => {
  const password = '  <script>not-to-be-rewritten</script> javascript: Ω  ';
  const original = loginRequest(JSON.stringify({ password }));
  let forwarded;
  const response = await onRequest[0]({ request: original, next: async (request) => {
    forwarded = request;
    return new Response('reached handler');
  } });
  assert.equal(response.status, 200);
  assert.notEqual(forwarded, original);
  assert.equal(forwarded.headers.get('content-type'), 'application/json');
  assert.deepEqual(await forwarded.json(), { password });
});

test('duplicate JSON properties are rejected before the login handler runs', async () => {
  const request = loginRequest('{"password":"first","password":"second"}');
  let nextCalled = false;
  const response = await withAegisImmunePipeline({ request, next: async () => {
    nextCalled = true;
    return new Response('unsafe');
  } });
  assert.equal(response.status, 400);
  assert.equal(nextCalled, false);
});

test('login route rejects unsupported media types and extra properties', async () => {
  const plain = new Request('https://aegis.test/api/login', {
    method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'password=x',
  });
  assert.equal((await withAegisImmunePipeline({ request: plain, next: async () => new Response('unsafe') })).status, 415);
  const extra = loginRequest('{"password":"x","admin":true}');
  assert.equal((await withAegisImmunePipeline({ request: extra, next: async () => new Response('unsafe') })).status, 400);
});

test('credential values remain unchanged while invalid values are rejected', () => {
  const value = { password: ' <script> javascript: Ω ' };
  assert.equal(deepScrub(value, 'strict', ['password']).password, value.password);
  assert.throws(() => deepScrub({ password: 'bad\0value' }, 'strict', ['password']), ValidationError);
  assert.throws(() => deepScrub({ password: undefined }, 'strict', ['password']), ValidationError);
});

test('actual login route policy passes exhaustive startup validation', () => {
  assert.equal(validateRoutePolicies(ROUTE_POLICIES), true);
  assert.equal(ROUTE_POLICIES.length, 1);
  assert.equal(ROUTE_POLICIES[0].path, '/api/login');
});

test('duplicate JSON properties are rejected at every nesting level', () => {
  assert.throws(() => parseJsonNoDuplicates('{"password":"a","password":"b"}'), /duplicate/i);
  assert.throws(() => parseJsonNoDuplicates('{"outer":{"x":1,"x":2}}'), /duplicate/i);
  assert.deepEqual(JSON.parse(JSON.stringify(parseJsonNoDuplicates('{"password":"safe"}'))), { password: 'safe' });
});

test('UTF-8 charset matching is case-insensitive and single quotes are rejected', async () => {
  const valid = loginRequest('{"password":"correct"}', { 'content-type': 'application/json; charset="UTF-8"' });
  const accepted = await withAegisImmunePipeline({ request: valid, next: async () => new Response('ok') });
  assert.equal(accepted.status, 200);
  const invalid = loginRequest('{"password":"correct"}', { 'content-type': "application/json; charset='utf-8'" });
  const rejected = await withAegisImmunePipeline({ request: invalid, next: async () => new Response('unsafe') });
  assert.equal(rejected.status, 415);
});

test('login body size and content-encoding limits fail closed', async () => {
  const oversized = loginRequest(JSON.stringify({ password: 'x'.repeat(17 * 1024) }));
  assert.equal((await withAegisImmunePipeline({ request: oversized, next: async () => new Response('unsafe') })).status, 413);
  const encoded = loginRequest('{"password":"correct"}', { 'content-encoding': 'gzip' });
  assert.equal((await withAegisImmunePipeline({ request: encoded, next: async () => new Response('unsafe') })).status, 415);
});

test('request reconstruction removes stale content-length and preserves content-type', async () => {
  const body = '{"password":"correct"}';
  const original = loginRequest(body, { 'content-length': String(new TextEncoder().encode(body).byteLength) });
  let forwarded;
  const response = await withAegisImmunePipeline({ request: original, next: async (request) => {
    forwarded = request;
    return new Response('ok');
  } });
  assert.equal(response.status, 200);
  assert.equal(forwarded.headers.get('content-length'), null);
  assert.equal(forwarded.headers.get('content-type'), 'application/json');
  assert.deepEqual(await forwarded.json(), { password: 'correct' });
});
