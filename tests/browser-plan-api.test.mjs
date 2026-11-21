import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken } from '../functions/lib/auth.mjs';
import { onRequestPost } from '../functions/api/browser-plan.js';

const secret = 'browser-plan-test-session-secret-long-enough';
const envBase = {
  AEGIS_PASSWORD: 'test-password-long-enough',
  AEGIS_SESSION_SECRET: secret,
  AEGIS_BROWSER_ALLOWED_HOSTS: 'docs.example.com, console.example.net',
};

async function request(body, { authenticated = true, origin = 'https://aegis.example' } = {}) {
  const headers = { 'Content-Type': 'application/json', Origin: origin };
  if (authenticated) {
    headers.Cookie = '__Host-aegis_session=' + await createSessionToken(secret);
  }
  return new Request('https://aegis.example/api/browser-plan', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

const readOnlyPlan = {
  version: 1,
  startUrl: 'https://docs.example.com/guide',
  actions: [{ id: 'inspect-1', kind: 'inspect' }],
};

test('browser plan endpoint requires configured authentication and a signed session', async () => {
  const noConfig = await onRequestPost({
    request: await request({ plan: readOnlyPlan }),
    env: {},
  });
  assert.equal(noConfig.status, 503);

  const noSession = await onRequestPost({
    request: await request({ plan: readOnlyPlan }, { authenticated: false }),
    env: envBase,
  });
  assert.equal(noSession.status, 401);
});

test('browser plan endpoint rejects cross-origin requests', async () => {
  const response = await onRequestPost({
    request: await request({ plan: readOnlyPlan }, { origin: 'https://attacker.example' }),
    env: envBase,
  });
  assert.equal(response.status, 403);
});

test('browser plan endpoint returns a non-executable read-only plan after policy validation', async () => {
  const response = await onRequestPost({
    request: await request({ plan: readOnlyPlan }),
    env: envBase,
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.ok, true);
  assert.equal(result.decision.mode, 'read_only');
  assert.equal(result.decision.executionAllowed, false);
  assert.deepEqual(result.decision.approvalRequiredActionIds, []);
  assert.equal(result.plan.startUrl, 'https://docs.example.com/guide');
});

test('browser plan endpoint classifies interactions as requiring Sentinel approval and never executes them', async () => {
  const response = await onRequestPost({
    request: await request({
      plan: {
        version: 1,
        startUrl: 'https://console.example.net',
        actions: [{ id: 'submit-1', kind: 'submit' }],
      },
    }),
    env: envBase,
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.decision.mode, 'approval_required');
  assert.deepEqual(result.decision.approvalRequiredActionIds, ['submit-1']);
  assert.equal(result.decision.executionAllowed, false);
});

test('browser plan endpoint fails closed without a configured host allowlist', async () => {
  const response = await onRequestPost({
    request: await request({ plan: readOnlyPlan }),
    env: { ...envBase, AEGIS_BROWSER_ALLOWED_HOSTS: '' },
  });
  assert.equal(response.status, 503);
});

test('browser plan endpoint rejects malformed and oversized requests', async () => {
  const malformed = await onRequestPost({
    request: new Request('https://aegis.example/api/browser-plan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://aegis.example',
        Cookie: '__Host-aegis_session=' + await createSessionToken(secret),
      },
      body: '{invalid',
    }),
    env: envBase,
  });
  assert.equal(malformed.status, 400);

  const oversized = await onRequestPost({
    request: new Request('https://aegis.example/api/browser-plan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://aegis.example',
        Cookie: '__Host-aegis_session=' + await createSessionToken(secret),
      },
      body: JSON.stringify({ plan: { ...readOnlyPlan, padding: 'x'.repeat(17000) } }),
    }),
    env: envBase,
  });
  assert.equal(oversized.status, 413);
});
