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
