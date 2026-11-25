import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSessionToken,
  createRevocableSessionToken,
  verifySessionToken,
  readSessionToken,
  isAuthorized,
  sessionCookie,
} from '../functions/lib/auth.mjs';
import { onRequestGet as loginGet, onRequestPost as loginPost } from '../functions/api/login.js';
import { onRequestPost as askPost } from '../functions/api/ask.js';
import {
  onRequestGet as memoryGet,
  onRequestPost as memoryPost,
  onRequestDelete as memoryDelete,
} from '../functions/api/memory.js';

const secret = 'test-only-session-secret-with-sufficient-entropy';
const fixedNow = 1_800_000_000_000;
const configuredEnv = {
  AEGIS_PASSWORD: 'a-long-test-password-value',
  AEGIS_SESSION_SECRET: secret,
};
const storedSessions = new Map();
const sessionDb = {
  prepare(sql) {
    return { bind(...values) {
      return {
        run: async () => {
          if (sql.startsWith('INSERT INTO auth_sessions')) storedSessions.set(values[0], { expires_at: values[2], revoked_at: null });
          else if (sql.startsWith('UPDATE auth_sessions')) { const row = storedSessions.get(values[1]); if (row) row.revoked_at = values[0]; }
          return { success: true };
        },
        first: async () => { const row = storedSessions.get(values[0]); return row && row.expires_at > values[1] && !row.revoked_at ? { session_id: values[0] } : null; },
      };
    }};
  },
};
const persistedEnv = { ...configuredEnv, AEGIS_DB: sessionDb };

test('a newly created session token verifies before its expiry', async () => {
  const token = await createSessionToken(secret, fixedNow);
  assert.equal(await verifySessionToken(token, secret, fixedNow + 1_000), true);
});

test('an expired session token is rejected', async () => {
  const token = await createSessionToken(secret, fixedNow);
  assert.equal(await verifySessionToken(token, secret, fixedNow + 12 * 60 * 60 * 1000 + 1), false);
});

test('a modified session token is rejected', async () => {
  const token = await createSessionToken(secret, fixedNow);
  const [payload, signature] = token.split('.');
  const changedSignature = (signature[0] === 'A' ? 'B' : 'A') + signature.slice(1);
  assert.equal(await verifySessionToken(payload + '.' + changedSignature, secret, fixedNow), false);
});

test('session verification fails closed when the signing secret is missing', async () => {
  const token = await createSessionToken(secret, fixedNow);
  assert.equal(await verifySessionToken(token, '', fixedNow), false);
});

test('the session cookie is HttpOnly, Secure, SameSite Strict and host-only', () => {
  const cookie = sessionCookie('signed-token');
  assert.match(cookie, /^__Host-aegis_session=signed-token;/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Path=\//);
  assert.doesNotMatch(cookie, /Domain=/);
});

test('the session token is read from the named cookie only', () => {
  const request = new Request('https://aegis.example/', {
    headers: { Cookie: 'other=value; __Host-aegis_session=abc.def; another=x' },
  });
  assert.equal(readSessionToken(request), 'abc.def');
});

test('API authorization fails closed without a configured session secret', async () => {
  const request = new Request('https://aegis.example/');
  assert.equal(await isAuthorized(request, {}), false);
});

test('the login endpoint reports missing security configuration', async () => {
  const response = await loginGet({
    request: new Request('https://aegis.example/api/login'),
    env: {},
  });
  assert.equal(response.status, 503);
});

test('the login endpoint rejects an incorrect password', async () => {
  const response = await loginPost({
    request: new Request('https://aegis.example/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://aegis.example' },
      body: JSON.stringify({ password: 'wrong-password-value' }),
    }),
    env: configuredEnv,
  });
  assert.equal(response.status, 401);
});

test('successful login persists a revocable session accepted by the API guard', async () => {
  const response = await loginPost({
    request: new Request('https://aegis.example/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://aegis.example' },
      body: JSON.stringify({ password: configuredEnv.AEGIS_PASSWORD }),
    }),
    env: persistedEnv,
  });
  assert.equal(response.status, 200);
  const token = response.headers.get('Set-Cookie').match(/__Host-aegis_session=([^;]+)/)[1];
  const authenticatedRequest = new Request('https://aegis.example/api/ask', {
    headers: { Cookie: '__Host-aegis_session=' + token },
  });
  assert.equal(await isAuthorized(authenticatedRequest, persistedEnv), true);
});

test('cross-origin login attempts are rejected', async () => {
  const response = await loginPost({
    request: new Request('https://aegis.example/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://attacker.example' },
      body: JSON.stringify({ password: configuredEnv.AEGIS_PASSWORD }),
    }),
    env: configuredEnv,
  });
  assert.equal(response.status, 403);
});

test('the chat API rejects unauthenticated requests before calling the model', async () => {
  const response = await askPost({
    request: new Request('https://aegis.example/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'hello' }),
    }),
    env: { ...configuredEnv, AI: { run: async () => { throw new Error('must not run'); } } },
  });
  assert.equal(response.status, 401);
});

test('the memory read API rejects unauthenticated requests before reading KV', async () => {
  const response = await memoryGet({
    request: new Request('https://aegis.example/api/memory'),
    env: { ...configuredEnv, MEMORY: { get: async () => { throw new Error('must not read'); } } },
  });
  assert.equal(response.status, 401);
});

test('memory writes and deletes reject unauthenticated requests', async () => {
  const env = {
    ...configuredEnv,
    MEMORY: {
      get: async () => '[]',
      put: async () => { throw new Error('must not write'); },
      delete: async () => { throw new Error('must not delete'); },
    },
  };
  const post = await memoryPost({
    request: new Request('https://aegis.example/api/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: 'private note' }),
    }),
    env,
  });
  const del = await memoryDelete({
    request: new Request('https://aegis.example/api/memory', { method: 'DELETE' }),
    env,
  });
  assert.equal(post.status, 401);
  assert.equal(del.status, 401);
});


test('login rejects requests without an Origin header', async () => {
  const response = await loginPost({
    request: new Request('https://aegis.example/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: configuredEnv.AEGIS_PASSWORD }),
    }),
    env: configuredEnv,
  });
  assert.equal(response.status, 403);
});

test('memory writes reject cross-origin requests before changing KV', async () => {
  const token = await createSessionToken(secret);
  let writes = 0;
  const response = await memoryPost({
    request: new Request('https://aegis.example/api/memory', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://attacker.example',
        Cookie: '__Host-aegis_session=' + token,
      },
      body: JSON.stringify({ note: 'private note' }),
    }),
    env: { ...configuredEnv, MEMORY: { get: async () => '[]', put: async () => { writes += 1; } } },
  });
  assert.equal(response.status, 403);
  assert.equal(writes, 0);
});

test('memory deletes reject cross-origin requests before changing KV', async () => {
  const token = await createSessionToken(secret);
  let deletes = 0;
  const response = await memoryDelete({
    request: new Request('https://aegis.example/api/memory', {
      method: 'DELETE',
      headers: { Origin: 'https://attacker.example', Cookie: '__Host-aegis_session=' + token },
    }),
    env: { ...configuredEnv, MEMORY: { get: async () => '[]', put: async () => {}, delete: async () => { deletes += 1; } } },
  });
  assert.equal(response.status, 403);
  assert.equal(deletes, 0);
});


test('chat rejects cross-origin requests before invoking the model', async () => {
  const token = await createSessionToken(secret);
  let modelCalls = 0;
  const response = await askPost({
    request: new Request('https://aegis.example/api/ask', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://attacker.example',
        Cookie: '__Host-aegis_session=' + token,
      },
      body: JSON.stringify({ question: 'hello' }),
    }),
    env: { ...configuredEnv, AI: { run: async () => { modelCalls += 1; return { response: 'hello' }; } } },
  });
  assert.equal(response.status, 403);
  assert.equal(modelCalls, 0);
});


test('login refuses to issue a session when D1 session storage is unavailable', async () => {
  const response = await loginPost({
    request: new Request('https://aegis.example/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://aegis.example' },
      body: JSON.stringify({ password: configuredEnv.AEGIS_PASSWORD }),
    }),
    env: configuredEnv,
  });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('Set-Cookie'), null);
});

test('logout revokes the D1 session and clears the browser cookie', async () => {
  const login = await loginPost({
    request: new Request('https://aegis.example/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://aegis.example' },
      body: JSON.stringify({ password: configuredEnv.AEGIS_PASSWORD }),
    }),
    env: persistedEnv,
  });
  const token = login.headers.get('Set-Cookie').match(/__Host-aegis_session=([^;]+)/)[1];
  const cookie = '__Host-aegis_session=' + token;
  const request = new Request('https://aegis.example/api/ask', { headers: { Cookie: cookie } });
  assert.equal(await isAuthorized(request, persistedEnv), true);
  const { onRequestDelete } = await import('../functions/api/login.js');
  const logout = await onRequestDelete({
    request: new Request('https://aegis.example/api/login', { method: 'DELETE', headers: { Origin: 'https://aegis.example', Cookie: cookie } }),
    env: persistedEnv,
  });
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get('Set-Cookie') || '', /Max-Age=0/);
  assert.equal(await isAuthorized(request, persistedEnv), false);
});

test('a valid stateless legacy token remains valid during its original 12-hour migration window', async () => {
  const token = await createSessionToken(secret, fixedNow);
  const request = new Request('https://aegis.example/api/ask', { headers: { Cookie: '__Host-aegis_session=' + token } });
  assert.equal(await isAuthorized(request, persistedEnv, fixedNow + 1_000), true);
  assert.equal(await isAuthorized(request, persistedEnv, fixedNow + 12 * 60 * 60 * 1000 + 1), false);
});

test('D1 session lookup errors fail closed', async () => {
  const { token } = await createRevocableSessionToken(secret, fixedNow);
  const request = new Request('https://aegis.example/api/ask', { headers: { Cookie: '__Host-aegis_session=' + token } });
  const brokenEnv = { ...configuredEnv, AEGIS_DB: { prepare() { throw new Error('D1 unavailable'); } } };
  assert.equal(await isAuthorized(request, brokenEnv, fixedNow + 1_000), false);
});
