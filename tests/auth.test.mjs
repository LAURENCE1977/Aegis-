import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSessionToken,
  verifySessionToken,
  readSessionToken,
  isAuthorized,
  sessionCookie,
} from '../functions/lib/auth.mjs';
import { authorizeOwner } from '../functions/lib/owner-api.mjs';
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

test('successful login issues a session cookie accepted by the API guard', async () => {
  const response = await loginPost({
    request: new Request('https://aegis.example/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://aegis.example' },
      body: JSON.stringify({ password: configuredEnv.AEGIS_PASSWORD }),
    }),
    env: configuredEnv,
  });
  assert.equal(response.status, 200);
  const cookie = response.headers.get('Set-Cookie');
  const token = cookie.match(/__Host-aegis_session=([^;]+)/)[1];
  const authenticatedRequest = new Request('https://aegis.example/api/ask', {
    headers: { Cookie: '__Host-aegis_session=' + token },
  });
  assert.equal(await isAuthorized(authenticatedRequest, configuredEnv), true);
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

test('the public login endpoint never discloses deployment secret names or configuration details', async () => {
  const response = await loginGet({
    request: new Request('https://aegis.example/api/login'),
    env: {},
  });
  const body = await response.json();
  assert.equal(response.status, 503);
  assert.equal(body.error, 'Sign-in is temporarily unavailable. Please contact the AEGIS administrator.');
  assert.doesNotMatch(JSON.stringify(body), /AEGIS_PASSWORD|AEGIS_SESSION_SECRET|secret|environment variable/i);
});

test('session tokens carry canonical versioned owner and session identity claims', async () => {
  const { validateSessionClaims, SESSION_CLAIMS_SCHEMA_VERSION } = await import('../functions/lib/auth.mjs');
  const token = await createSessionToken(secret, fixedNow);
  const [encodedPayload] = token.split('.');
  const claims = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  assert.equal(claims.schemaVersion, SESSION_CLAIMS_SCHEMA_VERSION);
  assert.equal(claims.principalId, 'owner');
  assert.match(claims.sessionId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.equal(validateSessionClaims(claims, fixedNow + 1000), true);
});

test('session claim validation rejects identity tampering, unknown fields and invalid lifetime', async () => {
  const { validateSessionClaims } = await import('../functions/lib/auth.mjs');
  const token = await createSessionToken(secret, fixedNow);
  const [encodedPayload] = token.split('.');
  const claims = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  for (const candidate of [
    { ...claims, principalId: 'administrator' },
    { ...claims, sessionId: 'not-a-session-id' },
    { ...claims, schemaVersion: '99.0' },
    { ...claims, extra: 'untrusted' },
    { ...claims, expiresAt: new Date(fixedNow + 13 * 60 * 60 * 1000).toISOString() },
    { ...claims, issuedAt: new Date(fixedNow + 60_000).toISOString() },
  ]) assert.throws(() => validateSessionClaims(candidate, fixedNow));
  assert.throws(() => validateSessionClaims({ ...claims, expiresAt: claims.issuedAt }, fixedNow));
});

test('owner API guard accepts only correctly signed canonical owner-session claims', async () => {
  const { SESSION_CLAIMS_SCHEMA_VERSION } = await import('../functions/lib/auth.mjs');
  const ownerToken = await createSessionToken(secret);
  const ownerRequest = new Request('https://aegis.example/api/memory', {
    headers: { Cookie: '__Host-aegis_session=' + ownerToken },
  });
  assert.equal(await authorizeOwner(ownerRequest, configuredEnv), null);

  const issuedAtMs = Math.floor(Date.now() / 1000) * 1000;
  const claims = {
    schemaVersion: SESSION_CLAIMS_SCHEMA_VERSION,
    principalId: 'administrator',
    sessionId: crypto.randomUUID(),
    issuedAt: new Date(issuedAtMs).toISOString(),
    expiresAt: new Date(issuedAtMs + 12 * 60 * 60 * 1000).toISOString(),
  };
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = new Uint8Array(await crypto.subtle.sign(
    'HMAC', key, new TextEncoder().encode(payload),
  ));
  const forgedPrincipalToken = payload + '.' + Buffer.from(signature).toString('base64url');
  const rejected = await authorizeOwner(new Request('https://aegis.example/api/memory', {
    headers: { Cookie: '__Host-aegis_session=' + forgedPrincipalToken },
  }), configuredEnv);
  assert.equal(rejected.status, 401);
});
