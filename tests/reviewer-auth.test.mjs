import test from 'node:test';
import assert from 'node:assert/strict';
import {
  reviewerAuthConfigAvailable,
  createReviewerSessionToken,
  isReviewerAuthorized,
  reviewerSessionCookie,
  clearReviewerSessionCookie,
} from '../functions/lib/auth.mjs';
import { onRequestPost as reviewerLogin } from '../functions/api/reviewer-login.js';
import { onRequestPatch as reviewGuardianResource } from '../functions/api/guardian/resources/[id].js';

const ownerSecret = 'owner-session-secret-that-is-at-least-32-characters';
const reviewerSecret = 'reviewer-session-secret-that-is-at-least-32-characters';
const env = {
  AEGIS_PASSWORD: 'owner-password-long-enough',
  AEGIS_SESSION_SECRET: ownerSecret,
  AEGIS_REVIEWER_PASSWORD: 'reviewer-password-long-enough',
  AEGIS_REVIEWER_SESSION_SECRET: reviewerSecret,
};

test('reviewer authentication is unavailable unless independent reviewer credentials are configured', () => {
  assert.equal(reviewerAuthConfigAvailable(env), true);
  assert.equal(reviewerAuthConfigAvailable({ ...env, AEGIS_REVIEWER_PASSWORD: undefined }), false);
  assert.equal(reviewerAuthConfigAvailable({ ...env, AEGIS_REVIEWER_SESSION_SECRET: 'short' }), false);
});

test('reviewer session is separately signed, role-bound and stored in its own HttpOnly cookie', async () => {
  const token = await createReviewerSessionToken(reviewerSecret);
  const request = new Request('https://aegis.example/api/guardian/resources/x', {
    headers: { Cookie: reviewerSessionCookie(token) },
  });
  assert.equal(await isReviewerAuthorized(request, env), true);
  assert.equal(reviewerSessionCookie(token).includes('HttpOnly; Secure; SameSite=Strict'), true);
  assert.equal(clearReviewerSessionCookie().includes('Max-Age=0'), true);

  const ownerOnly = new Request('https://aegis.example/api/guardian/resources/x', {
    headers: { Cookie: '__Host-aegis_session=' + token },
  });
  assert.equal(await isReviewerAuthorized(ownerOnly, env), false);
  const reviewerCookieWithOwnerToken = new Request('https://aegis.example/api/guardian/resources/x', {
    headers: { Cookie: reviewerSessionCookie(await (await import('../functions/lib/auth.mjs')).createSessionToken(ownerSecret)) },
  });
  assert.equal(await isReviewerAuthorized(reviewerCookieWithOwnerToken, env), false);
});

test('reviewer login rejects owner credentials and issues only the reviewer cookie', async () => {
  const makeRequest = (password) => new Request('https://aegis.example/api/reviewer-login', {
    method: 'POST',
    headers: { Origin: 'https://aegis.example', 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  const ownerAttempt = await reviewerLogin({ request: makeRequest(env.AEGIS_PASSWORD), env });
  assert.equal(ownerAttempt.status, 401);
  assert.equal(ownerAttempt.headers.get('Set-Cookie'), null);

  const valid = await reviewerLogin({ request: makeRequest(env.AEGIS_REVIEWER_PASSWORD), env });
  assert.equal(valid.status, 200);
  assert.match(valid.headers.get('Set-Cookie'), /^__Host-aegis_reviewer_session=/);
});

test('Guardian review mutations reject an owner session and require the separate reviewer session', async () => {
  const ownerToken = (await import('../functions/lib/auth.mjs')).createSessionToken;
  const owner = await ownerToken(ownerSecret);
  const reviewer = await createReviewerSessionToken(reviewerSecret);
  const makeRequest = (cookie) => new Request('https://aegis.example/api/guardian/resources/resource-1234567890abcdef1234567890abcdef', {
    method: 'PATCH',
    headers: { Origin: 'https://aegis.example', Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'reviewed', note: 'Independent review completed.', expectedUpdatedAt: '2026-11-17T11:00:00.000Z' }),
  });
  const params = { id: 'resource-1234567890abcdef1234567890abcdef' };
  const noDb = {};
  const ownerResponse = await reviewGuardianResource({ request: makeRequest('__Host-aegis_session=' + await owner), env: { ...env, AEGIS_DB: noDb }, params });
  assert.equal(ownerResponse.status, 401);
  const reviewerResponse = await reviewGuardianResource({ request: makeRequest(reviewerSessionCookie(reviewer)), env: { ...env, AEGIS_DB: noDb }, params });
  assert.equal(reviewerResponse.status, 503);
});
