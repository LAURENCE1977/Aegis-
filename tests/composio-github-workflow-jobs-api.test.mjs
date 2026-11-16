import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken } from '../functions/lib/auth.mjs';
import { onRequestPost } from '../functions/api/sentinel/composio-github-workflow-jobs.js';

const secret = 'composio-workflow-jobs-test-session-secret-with-entropy';
const envBase = { AEGIS_PASSWORD: 'test-password-long-enough', AEGIS_SESSION_SECRET: secret };

class CountingD1 {
  constructor() { this.prepareCalls = 0; }
  prepare() { this.prepareCalls += 1; throw new Error('D1 should not be touched for invalid requests'); }
}

async function request(body, { authenticated = true, origin = 'https://aegis.example' } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (authenticated) headers.Cookie = '__Host-aegis_session=' + await createSessionToken(secret);
  if (origin !== null) headers.Origin = origin;
  return new Request('https://aegis.example/api/sentinel/composio-github-workflow-jobs', {
    method: 'POST', headers, body: JSON.stringify(body),
  });
}

test('workflow jobs endpoint rejects unauthenticated requests before D1 access', async () => {
  const db = new CountingD1();
  const response = await onRequestPost({
    request: await request({ owner: 'LAURENCE1977', repo: 'Aegis-', runId: 123 }, { authenticated: false }),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(response.status, 401);
  assert.equal(db.prepareCalls, 0);
});

test('workflow jobs endpoint rejects cross-origin requests before D1 access', async () => {
  const db = new CountingD1();
  const response = await onRequestPost({
    request: await request({ owner: 'LAURENCE1977', repo: 'Aegis-', runId: 123 }, { origin: 'https://attacker.example' }),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(response.status, 403);
  assert.equal(db.prepareCalls, 0);
});

test('workflow jobs endpoint accepts only exact owner, repository and positive integer run ID', async () => {
  for (const body of [
    { owner: 'LAURENCE1977', repo: 'Aegis-', runId: 0 },
    { owner: 'LAURENCE1977', repo: 'Aegis-', runId: 1.5 },
    { owner: 'LAURENCE1977', repo: 'Aegis-', runId: 123, filter: 'all' },
    { owner: 'LAURENCE1977', repo: '../other', runId: 123 },
  ]) {
    const db = new CountingD1();
    const response = await onRequestPost({ request: await request(body), env: { ...envBase, AEGIS_DB: db } });
    assert.equal(response.status, 400);
    assert.equal(db.prepareCalls, 0);
  }
});
