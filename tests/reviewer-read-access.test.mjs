import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken, createReviewerSessionToken, reviewerSessionCookie } from '../functions/lib/auth.mjs';
import { onRequestGet as getApprovals } from '../functions/api/approvals.js';
import { onRequestGet as listGuardianResources, onRequestPost as createGuardianResource } from '../functions/api/guardian/resources.js';
import { onRequestGet as getGuardianResource } from '../functions/api/guardian/resources/[id].js';

const ownerSecret = 'reviewer-read-owner-session-secret-with-enough-entropy';
const reviewerSecret = 'reviewer-read-session-secret-with-enough-entropy';
const envBase = {
  AEGIS_PASSWORD: 'owner-password-long-enough',
  AEGIS_SESSION_SECRET: ownerSecret,
  AEGIS_REVIEWER_PASSWORD: 'reviewer-password-long-enough',
  AEGIS_REVIEWER_SESSION_SECRET: reviewerSecret,
};

class ReadOnlyD1 {
  prepare() {
    return {
      bind() { return this; },
      async all() { return { results: [] }; },
      async first() { return null; },
    };
  }
}

async function request(path, principal = 'reviewer', method = 'GET') {
  const headers = { Origin: 'https://aegis.example' };
  if (principal === 'reviewer') {
    headers.Cookie = reviewerSessionCookie(await createReviewerSessionToken(reviewerSecret));
  } else if (principal === 'owner') {
    headers.Cookie = '__Host-aegis_session=' + await createSessionToken(ownerSecret);
  }
  return new Request('https://aegis.example' + path, { method, headers });
}

test('reviewer can read pending approvals without the owner session', async () => {
  const response = await getApprovals({
    request: await request('/api/approvals', 'reviewer'),
    env: { ...envBase, AEGIS_DB: new ReadOnlyD1() },
  });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).approvals, []);
});

test('reviewer can read the owner-scoped Guardian catalogue and resource detail without owner credentials', async () => {
  const listed = await listGuardianResources({
    request: await request('/api/guardian/resources?limit=10', 'reviewer'),
    env: { ...envBase, AEGIS_DB: new ReadOnlyD1() },
  });
  assert.equal(listed.status, 200);
  assert.deepEqual((await listed.json()).resources, []);

  const detail = await getGuardianResource({
    request: await request('/api/guardian/resources/resource-1234567890abcdef1234567890abcdef', 'reviewer'),
    env: { ...envBase, AEGIS_DB: new ReadOnlyD1() },
    params: { id: 'resource-1234567890abcdef1234567890abcdef' },
  });
  assert.equal(detail.status, 404);
});

test('reviewer identity cannot create Guardian resources or bypass owner-only intake', async () => {
  const response = await createGuardianResource({
    request: await request('/api/guardian/resources', 'reviewer', 'POST'),
    env: { ...envBase, AEGIS_DB: new ReadOnlyD1() },
  });
  assert.equal(response.status, 401);
});

test('owner remains able to read the approval inbox and Guardian catalogue', async () => {
  const approvals = await getApprovals({
    request: await request('/api/approvals', 'owner'),
    env: { ...envBase, AEGIS_DB: new ReadOnlyD1() },
  });
  const resources = await listGuardianResources({
    request: await request('/api/guardian/resources', 'owner'),
    env: { ...envBase, AEGIS_DB: new ReadOnlyD1() },
  });
  assert.equal(approvals.status, 200);
  assert.equal(resources.status, 200);
});
