import test from 'node:test';
import assert from 'node:assert/strict';
import { createRevocableSessionToken } from '../functions/lib/auth.mjs';
import { onRequestGet } from '../functions/api/modules.js';

const secret = 'test-only-module-api-secret-with-sufficient-entropy';
const sessionRows = new Map();
const configuredEnv = {
  AEGIS_PASSWORD: 'a-long-test-password-value',
  AEGIS_SESSION_SECRET: secret,
  AEGIS_DB: { prepare(sql) { return { bind(sid, now) { return { first: async () => { const row=sessionRows.get(sid); return sql.includes('FROM auth_sessions') && row && row.expires_at>now ? {session_id:sid,...row} : null; } }; } }; } },
};

test('module API fails closed when authentication is not configured', async () => {
  const response = await onRequestGet({
    request: new Request('https://aegis.example/api/modules'),
    env: {},
  });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('module API rejects requests without a valid session', async () => {
  const response = await onRequestGet({
    request: new Request('https://aegis.example/api/modules'),
    env: configuredEnv,
  });
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('module API returns the catalogue to an authenticated session without granting permissions', async () => {
  const session = await createRevocableSessionToken(secret);
  sessionRows.set(session.sessionId,{expires_at:session.expiresAt,revoked_at:null,principal_id:'usr_root',tenant_id:'org_root',roles_json:'[\"owner\"]'});
  const token = session.token;
  const response = await onRequestGet({
    request: new Request('https://aegis.example/api/modules', {
      headers: { Cookie: '__Host-aegis_session=' + token },
    }),
    env: configuredEnv,
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.match(response.headers.get('Content-Type') || '', /application\/json/);

  const body = await response.json();
  assert.equal(body.total, body.modules.length);
  assert.ok(body.modules.length > 0);
  for (const module of body.modules) {
    assert.ok(['available', 'planned'].includes(module.status));
    assert.ok(Array.isArray(module.capabilities));
    assert.deepEqual(module.permissions, []);
  }
});

test('module API rejects a malformed or tampered session token', async () => {
  const response = await onRequestGet({
    request: new Request('https://aegis.example/api/modules', {
      headers: { Cookie: '__Host-aegis_session=not.a.valid.token' },
    }),
    env: configuredEnv,
  });
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});
