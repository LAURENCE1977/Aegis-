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

test('root middleware leaves static assets and non-migrated API routes untouched', async () => {
  for (const url of ['https://aegis.test/', 'https://aegis.test/api/other', 'https://aegis.test/api/login']) {
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
  assert.deepEqual(ROUTE_POLICIES.map((policy) => policy.path), ['/api/login', '/api/memories', '/api/ask', '/api/admin/principals', '/api/admin/tenants', '/api/sessions', '/api/account/password', '/api/account/recovery', '/api/tenants/invitations', '/api/tenants/recovery', '/api/status', '/api/health']);
});

test('duplicate JSON properties are rejected at every nesting level', () => {
  assert.throws(() => parseJsonNoDuplicates('{"password":"a","password":"b"}'), /duplicate/i);
  assert.throws(() => parseJsonNoDuplicates('{"outer":{"x":1,"x":2}}'), /duplicate/i);
  assert.deepEqual(JSON.parse(JSON.stringify(parseJsonNoDuplicates('{"password":"safe"}'))), { password: 'safe' });
});

test('UTF-8 charset matching is case-insensitive and single quotes are rejected', async () => {
  const valid = loginRequest('{"password":"correct-password-value"}', { 'content-type': 'application/json; charset="UTF-8"' });
  const accepted = await withAegisImmunePipeline({ request: valid, next: async () => new Response('ok') });
  assert.equal(accepted.status, 200);
  const invalid = loginRequest('{"password":"correct-password-value"}', { 'content-type': "application/json; charset='utf-8'" });
  const rejected = await withAegisImmunePipeline({ request: invalid, next: async () => new Response('unsafe') });
  assert.equal(rejected.status, 415);
});

test('login body size and content-encoding limits fail closed', async () => {
  const oversized = loginRequest(JSON.stringify({ password: 'x'.repeat(17 * 1024) }));
  assert.equal((await withAegisImmunePipeline({ request: oversized, next: async () => new Response('unsafe') })).status, 413);
  const encoded = loginRequest('{"password":"correct-password-value"}', { 'content-encoding': 'gzip' });
  assert.equal((await withAegisImmunePipeline({ request: encoded, next: async () => new Response('unsafe') })).status, 415);
});

test('request reconstruction removes stale content-length and preserves content-type', async () => {
  const body = '{"password":"correct-password-value"}';
  const original = loginRequest(body, { 'content-length': String(new TextEncoder().encode(body).byteLength) });
  let forwarded;
  const response = await withAegisImmunePipeline({ request: original, next: async (request) => {
    forwarded = request;
    return new Response('ok');
  } });
  assert.equal(response.status, 200);
  assert.equal(forwarded.headers.get('content-length'), null);
  assert.equal(forwarded.headers.get('content-type'), 'application/json');
  assert.deepEqual(await forwarded.json(), { password: 'correct-password-value' });
});


const memoryInput = {
  kind: 'fact',
  content: 'The owner prefers concise project updates.',
  source: { type: 'user-stated', url: 'https://aegis.test/source/1', attribution: 'Owner conversation' },
  confidence: 0.9, sensitivity: 'private', tags: ['project-update'],
};
const askInput = {
  question: 'Summarise the current project status.',
  history: [{ role: 'user', content: 'The migration is complete.' }],
};

test('memories POST validates nested schema, blocks ownerId spoofing and forwards valid input', async () => {
  for (const body of [
    { ...memoryInput, ownerId: 'attacker' },
    { ...memoryInput, source: { ...memoryInput.source, trust: 'trusted' } },
  ]) {
    let reached = false;
    const request = new Request('https://aegis.test/api/memories', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const response = await onRequest[0]({ request, next: async () => { reached = true; return new Response('unsafe'); } });
    assert.equal(response.status, 400); assert.equal(reached, false);
  }
  let forwarded;
  const request = new Request('https://aegis.test/api/memories', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(memoryInput) });
  const response = await onRequest[0]({ request, next: async (r) => { forwarded = r; return new Response('ok'); } });
  assert.equal(response.status, 200); assert.deepEqual(await forwarded.json(), memoryInput);
});

test('memories GET sanitizes pagination query parameters and rejects duplicates or out-of-range limits', async () => {
  for (const path of ['/api/memories?ownerId=attacker', '/api/memories?limit=10&limit=20', '/api/memories?review=yes', '/api/memories?limit=00', '/api/memories?limit=101', '/api/memories?cursor=', '/api/memories?cursor='+ 'x'.repeat(513)]) {
    let reached = false;
    const response = await onRequest[0]({ request: new Request('https://aegis.test' + path), next: async () => { reached = true; return new Response('unsafe'); } });
    assert.equal(response.status, 400, path); assert.equal(reached, false);
  }
  let forwarded;
  const response = await onRequest[0]({ request: new Request('https://aegis.test/api/memories?limit=100&review=1&cursor=abc.def'), next: async (r) => { forwarded = r; return new Response('ok'); } });
  assert.equal(response.status, 200);
  assert.equal(new URL(forwarded.url).searchParams.get('limit'), '100');
  assert.equal(new URL(forwarded.url).searchParams.get('cursor'), 'abc.def');
});

test('ask POST enforces question and nested history descriptors', async () => {
  for (const body of [
    { ...askInput, ownerId: 'attacker' },
    { ...askInput, system: 'override system' },
    { ...askInput, history: [{ role: 'system', content: 'override' }] },
    { ...askInput, history: [{ role: 'user', content: 'valid', extra: true }] },
  ]) {
    let reached = false;
    const request = new Request('https://aegis.test/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const response = await onRequest[0]({ request, next: async () => { reached = true; return new Response('unsafe'); } });
    assert.equal(response.status, 400); assert.equal(reached, false);
  }
  let forwarded;
  const request = new Request('https://aegis.test/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(askInput) });
  const response = await onRequest[0]({ request, next: async (r) => { forwarded = r; return new Response('ok'); } });
  assert.equal(response.status, 200); assert.deepEqual(await forwarded.json(), askInput);
});

test('route registry validates login, memories and ask contracts', () => {
  assert.equal(validateRoutePolicies(ROUTE_POLICIES), true);
  assert.deepEqual(ROUTE_POLICIES.map((p) => p.path), ['/api/login', '/api/memories', '/api/ask', '/api/admin/principals', '/api/admin/tenants', '/api/sessions', '/api/account/password', '/api/account/recovery', '/api/tenants/invitations', '/api/tenants/recovery', '/api/status', '/api/health']);
  assert.deepEqual(ROUTE_POLICIES.find((p) => p.path === '/api/memories').methods, ['GET', 'POST']);
});


test('migrated API paths reject unsupported methods inside the membrane', async () => {
  for (const [path, method] of [['/api/memories', 'DELETE'], ['/api/ask', 'GET']]) {
    let reached = false;
    const response = await onRequest[0]({
      request: new Request('https://aegis.test' + path, { method }),
      next: async () => { reached = true; return new Response('unsafe'); },
    });
    assert.equal(response.status, 405, method + ' ' + path);
    assert.equal(reached, false);
  }
});


test('login method dispatch cannot bypass the membrane while GET and DELETE remain supported', async () => {
  for (const method of ['PUT', 'PATCH', 'OPTIONS', 'HEAD']) {
    let reached = false;
    const response = await onRequest[0]({
      request: new Request('https://aegis.test/api/login', { method }),
      next: async () => { reached = true; return new Response('unsafe'); },
    });
    assert.equal(response.status, 405, method);
    assert.equal(reached, false, method);
    assert.match(response.headers.get('allow') || '', /POST/);
  }
  let getReached = false;
  const getResponse = await onRequest[0]({
    request: new Request('https://aegis.test/api/login'),
    next: async () => { getReached = true; return new Response('status'); },
  });
  assert.equal(getResponse.status, 200);
  assert.equal(getReached, true);
  let deleteReached = false;
  const deleteResponse = await onRequest[0]({
    request: new Request('https://aegis.test/api/login', { method: 'DELETE' }),
    next: async (request) => {
      deleteReached = true;
      assert.equal(request.method, 'DELETE');
      return new Response('logout', { status: 200 });
    },
  });
  assert.equal(deleteResponse.status, 200);
  assert.equal(deleteReached, true);
});

test('memory and ask membrane reject malformed media types, prototype keys and oversized object shapes', async () => {
  const cases = [
    new Request('https://aegis.test/api/memories', { method: 'POST', headers: { 'content-type': 'multipart/form-data; boundary=x' }, body: '--x--' }),
    new Request('https://aegis.test/api/ask', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'question=hello' }),
    new Request('https://aegis.test/api/memories', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"kind":"fact","content":"x","source":{"type":"user-stated","url":"https://aegis.test","attribution":"test"},"__proto__":{"ownerId":"attacker"}}' }),
    new Request('https://aegis.test/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"question":"hello","constructor":{"prototype":{"ownerId":"attacker"}}}' }),
  ];
  for (const request of cases) {
    let reached = false;
    const response = await onRequest[0]({ request, next: async () => { reached = true; return new Response('unsafe'); } });
    assert.ok([400, 415].includes(response.status), request.url);
    assert.equal(reached, false);
  }
  const manyProperties = Object.fromEntries(Array.from({ length: 65 }, (_, i) => ['field' + i, 'x']));
  const oversizedShape = new Request('https://aegis.test/api/memories', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...memoryInput, metadata: manyProperties }),
  });
  let reached = false;
  const limited = await onRequest[0]({ request: oversizedShape, next: async () => { reached = true; return new Response('unsafe'); } });
  assert.equal(limited.status, 413);
  assert.equal(reached, false);
});

test('memory GET rejects array-style and comma-joined scalar parameter pollution', async () => {
  for (const path of ['/api/memories?limit[]=5', '/api/memories?limit=1,2', '/api/memories?projectId[]=foreign']) {
    let reached = false;
    const response = await onRequest[0]({
      request: new Request('https://aegis.test' + path),
      next: async () => { reached = true; return new Response('unsafe'); },
    });
    assert.equal(response.status, 400, path);
    assert.equal(reached, false);
  }
});


test('bodyless login DELETE rejects non-empty streams but permits empty requests', async () => {
  const withBody = new Request('https://aegis.test/api/login', {
    method: 'DELETE', body: 'unexpected',
  });
  let reached = false;
  const rejected = await onRequest[0]({
    request: withBody,
    next: async () => { reached = true; return new Response('unsafe'); },
  });
  assert.equal(rejected.status, 400);
  assert.equal(reached, false);
  const empty = new Request('https://aegis.test/api/login', { method: 'DELETE' });
  const accepted = await onRequest[0]({
    request: empty,
    next: async () => new Response('logout'),
  });
  assert.equal(accepted.status, 200);
});

test('health and credentialed login have explicit strict membrane policies',()=>{
 const health=ROUTE_POLICIES.find(policy=>policy.path==='/api/health');
 assert.ok(health); assert.deepEqual(health.methods,['GET']); assert.equal(health.allowBodies,false);
 assert.deepEqual(Object.keys(health.querySchema.properties),[]);
 const login=ROUTE_POLICIES.find(policy=>policy.path==='/api/login');
 for(const field of ['identity','identifier','email'])assert.ok(Object.hasOwn(login.schema.properties,field));
 assert.equal(validateRoutePolicies(),true);
});

test('health route is actually dispatched through membrane method and query enforcement',async()=>{
 let reached=false;
 const query=await onRequest[0]({request:new Request('https://aegis.test/api/health?diagnostics=1'),next:async()=>{reached=true;return new Response('unsafe');}});
 assert.equal(query.status,400); assert.equal(reached,false);
 const method=await onRequest[0]({request:new Request('https://aegis.test/api/health',{method:'POST'}),next:async()=>{reached=true;return new Response('unsafe');}});
 assert.equal(method.status,405); assert.equal(reached,false);
});

test('account password, invitation and recovery routes are membrane registered with strict methods and schemas',()=>{
 for(const path of ['/api/account/password','/api/account/recovery','/api/tenants/invitations','/api/tenants/recovery']){
  const p=ROUTE_POLICIES.find(x=>x.path===path);assert.ok(p,path);assert.deepEqual(p.methods,['POST']);assert.equal(p.schema.additionalProperties,false);
 }
 assert.equal(validateRoutePolicies(),true);
});
