import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken } from '../functions/lib/auth.mjs';
import { onRequestGet } from '../functions/api/capabilities.js';

const secret = 'test-only-capability-api-secret-with-sufficient-entropy';
const configuredEnv = {
  AEGIS_PASSWORD: 'a-long-test-password-value',
  AEGIS_SESSION_SECRET: secret,
};

test('capability API fails closed when authentication is not configured', async () => {
  const response = await onRequestGet({
    request: new Request('https://aegis.example/api/capabilities'),
    env: {},
  });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('capability API rejects requests without a valid session', async () => {
  const response = await onRequestGet({
    request: new Request('https://aegis.example/api/capabilities'),
    env: configuredEnv,
  });
  assert.equal(response.status, 401);
});

test('capability API returns authenticated manifests without granting permissions', async () => {
  const token = await createSessionToken(secret);
  const response = await onRequestGet({
    request: new Request('https://aegis.example/api/capabilities', {
      headers: { Cookie: '__Host-aegis_session=' + token },
    }),
    env: configuredEnv,
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.match(response.headers.get('Content-Type') || '', /application\\/json/);
  const body = await response.json();
  assert.equal(body.total, body.capabilities.length);
  assert.ok(body.capabilities.length >= 1);
  assert.ok(body.capabilities.every((entry) => Array.isArray(entry.actions)));
  assert.ok(body.capabilities.every((entry) => entry.status === 'approved'));
  assert.ok(body.capabilities.every((entry) => !('secretValue' in entry.auth)));
  assert.deepEqual(body.grants, []);
});

test('capability API rejects a malformed or tampered session token', async () => {
  const response = await onRequestGet({
    request: new Request('https://aegis.example/api/capabilities', {
      headers: { Cookie: '__Host-aegis_session=not.a.valid.token' },
    }),
    env: configuredEnv,
  });
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});
