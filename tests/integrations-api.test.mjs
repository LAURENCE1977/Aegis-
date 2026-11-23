import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet } from '../functions/api/integrations.js';
import { createSessionToken, sessionCookie } from '../functions/lib/auth.mjs';

const env = {
  AEGIS_PASSWORD: 'aegis-test-password',
  AEGIS_SESSION_SECRET: 'test-session-secret-that-is-long-enough-for-hmac',
  COMPOSIO_API_KEY: 'test-composio-project-key',
  COMPOSIO_USER_ID: 'aegis-owner',
};

async function authenticatedRequest() {
  const token = await createSessionToken(env.AEGIS_SESSION_SECRET);
  return new Request('https://aegis.example/api/integrations', {
    headers: { Cookie: sessionCookie(token) },
  });
}

test('integration status fails closed when Composio runtime credentials are absent', async () => {
  const response = await onRequestGet({
    request: await authenticatedRequest(),
    env: { ...env, COMPOSIO_API_KEY: '' },
  });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('integration status requires an authenticated AEGIS owner session', async () => {
  const response = await onRequestGet({
    request: new Request('https://aegis.example/api/integrations'),
    env,
  });
  assert.equal(response.status, 401);
});

test('integration status returns redacted Composio connection metadata only', async () => {
  const response = await onRequestGet({
    request: await authenticatedRequest(),
    env: {
      ...env,
      COMPOSIO_FETCH: async (url, init) => {
        assert.match(String(url), /connected_accounts/);
        assert.equal(init.headers['x-api-key'], env.COMPOSIO_API_KEY);
        return new Response(JSON.stringify({
          items: [{
            id: 'ca-github',
            user_id: 'aegis-owner',
            status: 'ACTIVE',
            toolkit: { slug: 'github' },
            state: { val: { access_token: 'must-never-leak' } },
          }],
          next_cursor: null,
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      },
    },
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.connections, [
    { id: 'ca-github', toolkit: 'github', status: 'ACTIVE' },
  ]);
  assert.equal(JSON.stringify(body).includes('must-never-leak'), false);
});
