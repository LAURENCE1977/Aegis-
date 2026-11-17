import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken } from '../functions/lib/auth.mjs';
import {
  onRequestGet as listAssessments,
  onRequestPost as registerAssessment,
} from '../functions/api/learning/assessments.js';

const secret = 'learning-assessment-api-test-session-secret-long-enough';
const envBase = { AEGIS_PASSWORD: 'test-password-long-enough', AEGIS_SESSION_SECRET: secret };

class EmptyAssessmentD1 {
  prepare(sql) {
    return {
      values: [],
      bind(...values) { this.values = values; return this; },
      async first() { return null; },
      async all() { return { results: [] }; },
      async run() { return { meta: { changes: 0 }; },
    };
  }
}

async function request(path, { method = 'GET', body, authenticated = true, origin = 'https://aegis.example' } = {}) {
  const headers = { Origin: origin, 'Content-Type': 'application/json' };
  if (authenticated) headers.Cookie = '__Host-aegis_session=' + await createSessionToken(secret);
  return new Request('https://aegis.example' + path, {
    method, headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

test('Learning Assessment API requires authentication and same-origin writes', async () => {
  const db = new EmptyAssessmentD1();
  const denied = await listAssessments({
    request: await request('/api/learning/assessments', { authenticated: false }),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(denied.status, 401);

  const crossOrigin = await registerAssessment({
    request: await request('/api/learning/assessments', {
      method: 'POST', origin: 'https://attacker.example', body: {},
    }),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(crossOrigin.status, 403);
});

test('Learning Assessment catalogue rejects repeated and unsupported query parameters', async () => {
  const db = new EmptyAssessmentD1();
  const repeated = await listAssessments({
    request: await request('/api/learning/assessments?limit=5&limit=10'),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(repeated.status, 400);

  const unsupported = await listAssessments({
    request: await request('/api/learning/assessments?owner=other'),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(unsupported.status, 400);
});

test('Learning Assessment catalogue is private and bounded', async () => {
  const response = await listAssessments({
    request: await request('/api/learning/assessments?limit=10'),
    env: { ...envBase, AEGIS_DB: new EmptyAssessmentD1() },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await response.json(), { assessments: [], total: 0 });
});

test('Learning Assessment registration rejects oversized and invalid assessment definitions safely', async () => {
  const db = new EmptyAssessmentD1();
  const invalid = await registerAssessment({
    request: await request('/api/learning/assessments', { method: 'POST', body: {} }),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(invalid.status, 400);
});
