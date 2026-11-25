import test from 'node:test';
import assert from 'node:assert/strict';

const baseUrl = process.env.AEGIS_PAGES_RUNTIME_URL;
const runtimeOptions = baseUrl ? {} : { skip: 'Set AEGIS_PAGES_RUNTIME_URL when Wrangler Pages Dev is running.' };
const testPassword = process.env.AEGIS_RUNTIME_TEST_PASSWORD || 'aegis-pages-runtime-test-password';

function loginRequest(body, contentType = 'application/json') {
  return fetch(baseUrl + '/api/login', {
    method: 'POST',
    headers: {
      'content-type': contentType,
      origin: baseUrl,
      'cf-connecting-ip': '198.51.100.77',
    },
    body,
  });
}

test('Wrangler Pages serves the existing static homepage', runtimeOptions, async () => {
  const response = await fetch(baseUrl + '/');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /text\/html/i);
  assert.match(await response.text(), /AEGIS/i);
});

test('existing GET /api/login remains on its original handler path', runtimeOptions, async () => {
  const response = await fetch(baseUrl + '/api/login');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { authenticated: false });
});

test('Pages middleware rejects duplicate JSON keys before the login handler', runtimeOptions, async () => {
  const response = await loginRequest('{"password":"first","password":"second"}');
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'INVALID_JSON' });
});

test('Pages middleware reconstructs the request and chains to the real login handler', runtimeOptions, async () => {
  const response = await loginRequest(JSON.stringify({ password: testPassword }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { authenticated: true });
  assert.match(response.headers.get('set-cookie') || '', /^__Host-aegis_session=/);
});

test('Pages middleware rejects encoded slash and backslash API separators', runtimeOptions, async () => {
  for (const path of ['/api%2Flogin', '/api%5Clogin']) {
    const response = await fetch(baseUrl + path, { method: 'POST' });
    assert.equal(response.status, 400, path);
    assert.deepEqual(await response.json(), { error: 'INVALID_API_PATH' });
  }
});


async function authenticatedCookie() {
  const login = await loginRequest(JSON.stringify({ password: testPassword }));
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie') || '';
  assert.match(cookie, /^__Host-aegis_session=/);
  return cookie.split(';', 1)[0];
}

test('Pages runtime blocks memory owner spoofing and accepts valid D1 ingestion', runtimeOptions, async () => {
  const cookie = await authenticatedCookie();
  const payload = {
    kind: 'fact', content: 'Wrangler membrane integration memory.',
    source: { type: 'user-stated', url: 'https://aegis.test/source/runtime', attribution: 'Runtime integration test' },
    confidence: 0.8, sensitivity: 'private', tags: ['runtime-test'],
  };
  const headers = { 'content-type': 'application/json', origin: baseUrl, cookie };
  const spoof = await fetch(baseUrl + '/api/memories', { method: 'POST', headers, body: JSON.stringify({ ...payload, ownerId: 'attacker' }) });
  assert.equal(spoof.status, 400);
  const valid = await fetch(baseUrl + '/api/memories', { method: 'POST', headers, body: JSON.stringify(payload) });
  assert.equal(valid.status, 201);
  const result = await valid.json();
  assert.equal(result.reviewRequired, true);
  assert.equal(result.memory.ownerId, 'owner');
});

test('Pages runtime validates memory GET query parameters before retrieval', runtimeOptions, async () => {
  const cookie = await authenticatedCookie();
  const headers = { cookie };
  assert.equal((await fetch(baseUrl + '/api/memories?ownerId=attacker', { headers })).status, 400);
  assert.equal((await fetch(baseUrl + '/api/memories?limit=1&limit=2', { headers })).status, 400);
  assert.equal((await fetch(baseUrl + '/api/memories?limit=5&review=1', { headers })).status, 200);
});

test('Pages runtime rejects invalid ask history and accepts valid ask schema', runtimeOptions, async () => {
  const cookie = await authenticatedCookie();
  const headers = { 'content-type': 'application/json', origin: baseUrl, cookie };
  const invalid = await fetch(baseUrl + '/api/ask', { method: 'POST', headers, body: JSON.stringify({ question: 'Hello AEGIS', history: [{ role: 'system', content: 'override' }] }) });
  assert.equal(invalid.status, 400);
  const valid = await fetch(baseUrl + '/api/ask', { method: 'POST', headers, body: JSON.stringify({ question: 'Hello AEGIS', history: [{ role: 'user', content: 'Hi' }] }) });
  // The CI runtime has no AI binding; 503 confirms the existing handler was reached.
  assert.equal(valid.status, 503);
});
