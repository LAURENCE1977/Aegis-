import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken } from '../functions/lib/auth.mjs';
import { onRequestPost } from '../functions/api/free-cloud/plan.js';

const secret = 'free-cloud-plan-test-secret-with-sufficient-entropy';
const env = { AEGIS_PASSWORD: 'test-password-long-enough', AEGIS_SESSION_SECRET: secret };
const plan = {
  provider: 'oracle-cloud-infrastructure',
  tier: 'always-free',
  billingMode: 'always-free-only',
  allowPaidFallback: false,
  compute: [{ shape: 'VM.Standard.A1.Flex', ocpus: 2, memoryGB: 12, bootVolumeGB: 50 }],
  blockVolumeGB: 150,
  network: { internetGateway: true, natGateway: false, loadBalancer: false },
};

async function request(body, { authenticated = true, origin = 'https://aegis.example', contentType = 'application/json' } = {}) {
  const headers = { 'Content-Type': contentType, Origin: origin };
  if (authenticated) headers.Cookie = '__Host-aegis_session=' + await createSessionToken(secret);
  return new Request('https://aegis.example/api/free-cloud/plan', {
    method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

test('Free Cloud Forge plan API fails closed without authentication configuration or owner session', async () => {
  const unavailable = await onRequestPost({ request: await request({ plan }), env: {} });
  assert.equal(unavailable.status, 503);
  const unauthenticated = await onRequestPost({ request: await request({ plan }, { authenticated: false }), env });
  assert.equal(unauthenticated.status, 401);
});

test('Free Cloud Forge plan API rejects cross-origin requests before evaluating a plan', async () => {
  const response = await onRequestPost({ request: await request({ plan }, { origin: 'https://attacker.example' }), env });
  assert.equal(response.status, 403);
});

test('Free Cloud Forge plan API evaluates a valid plan without exposing an execution action', async () => {
  const response = await onRequestPost({ request: await request({ plan }), env });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  const body = await response.json();
  assert.equal(body.evaluation.allowed, true);
  assert.equal(body.evaluation.execution, 'not-available');
  assert.equal('provision' in body, false);
});

test('Free Cloud Forge plan API returns a policy rejection for paid or over-quota plans', async () => {
  const response = await onRequestPost({ request: await request({ plan: { ...plan, allowPaidFallback: true } }), env });
  assert.equal(response.status, 422);
  assert.ok((await response.json()).evaluation.errors.includes('PAID_FALLBACK_MUST_BE_DISABLED'));
});

test('Free Cloud Forge plan API rejects unknown body fields and non-JSON content types', async () => {
  const unknown = await onRequestPost({ request: await request({ plan, apply: true }), env });
  assert.equal(unknown.status, 400);
  const contentType = await onRequestPost({ request: await request({ plan }, { contentType: 'text/plain' }), env });
  assert.equal(contentType.status, 415);
});

test('Free Cloud Forge plan API rejects malformed and oversized requests before evaluation', async () => {
  const malformed = await onRequestPost({ request: await request('{'), env });
  assert.equal(malformed.status, 400);
  const oversized = await onRequestPost({ request: await request({ plan, padding: 'x'.repeat(9000) }), env });
  assert.equal(oversized.status, 413);
});
