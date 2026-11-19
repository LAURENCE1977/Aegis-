import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken } from '../functions/lib/auth.mjs';
import {
  onRequestGet as listAttempts,
  onRequestPost as submitAttempt,
} from '../functions/api/learning/assessments/attempts.js';

const secret = 'learning-attempt-api-test-session-secret-long-enough';
const env = { AEGIS_PASSWORD: 'test-password-long-enough', AEGIS_SESSION_SECRET: secret,
  AEGIS_DB: { prepare() { throw new Error('database should not be reached by rejected requests'); } } };

async function makeRequest(path, { method = 'GET', body, authenticated = true, origin = 'https://aegis.example' } = {}) {
  const headers = { Origin: origin, 'Content-Type': 'application/json' };
  if (authenticated) headers.Cookie = '__Host-aegis_session=' + await createSessionToken(secret);
  return new Request('https://aegis.example' + path, {
    method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

test('Learning Attempt API requires authentication and same-origin writes', async () => {
  const unauthenticated = await listAttempts({
    request: await makeRequest('/api/learning/assessments/attempts', { authenticated: false }),
    env,
  });
  assert.equal(unauthenticated.status, 401);

  const crossOrigin = await submitAttempt({
    request: await makeRequest('/api/learning/assessments/attempts', {
      method: 'POST', origin: 'https://attacker.example',
      body: { assessmentId: 'javascript-basics-check', assessmentVersion: '1.0.0', answers: {} },
    }),
    env,
  });
  assert.equal(crossOrigin.status, 403);
});

test('Learning Attempt API requires exact query identity and rejects unsupported parameters', async () => {
  const missing = await listAttempts({
    request: await makeRequest('/api/learning/assessments/attempts?limit=10'),
    env,
  });
  assert.equal(missing.status, 400);

  const unsupported = await listAttempts({
    request: await makeRequest('/api/learning/assessments/attempts?assessmentId=javascript-basics-check&assessmentVersion=1.0.0&owner=other'),
    env,
  });
  assert.equal(unsupported.status, 400);
});

test('Learning Attempt submission rejects client-supplied score and authority fields', async () => {
  const response = await submitAttempt({
    request: await makeRequest('/api/learning/assessments/attempts', {
      method: 'POST',
      body: {
        assessmentId: 'javascript-basics-check', assessmentVersion: '1.0.0',
        answers: { q1: 'b' }, scorePercent: 100, passed: true, masteryVerified: true,
      },
    }),
    env,
  });
  assert.equal(response.status, 400);
});
