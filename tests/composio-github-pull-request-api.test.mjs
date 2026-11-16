import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken } from '../functions/lib/auth.mjs';
import { onRequestPost } from '../functions/api/sentinel/composio-github-pull-request.js';

const secret = 'composio-pull-request-test-session-secret-with-entropy';
const envBase = {
  AEGIS_PASSWORD: 'test-password-long-enough',
  AEGIS_SESSION_SECRET: secret,
};

class CountingD1 {
  constructor() { this.prepareCalls = 0; }
  prepare() {
    this.prepareCalls += 1;
    throw new Error('D1 should not be touched for invalid requests');
  }
}

async function request(body, { authenticated = true, origin = 'https://aegis.example' } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (authenticated) headers.Cookie = '__Host-aegis_session=' + await createSessionToken(secret);
  if (origin !== null) headers.Origin = origin;
  return new Request('https://aegis.example/api/sentinel/composio-github-pull-request', {
    method: 'POST', headers, body: JSON.stringify(body),
  });
}

test('pull request endpoint rejects unauthenticated requests before D1 access', async () => {
  const db = new CountingD1();
  const response = await onRequestPost({
    request: await request({ owner: 'LAURENCE1977', repo: 'Aegis-', pullNumber: 101 }, { authenticated: false }),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(response.status, 401);
  assert.equal(db.prepareCalls, 0);
});

test('pull request endpoint rejects cross-origin requests before D1 access', async () => {
  const db = new CountingD1();
  const response = await onRequestPost({
    request: await request({ owner: 'LAURENCE1977', repo: 'Aegis-', pullNumber: 101 }, { origin: 'https://attacker.example' }),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(response.status, 403);
  assert.equal(db.prepareCalls, 0);
});

test('pull request endpoint accepts only an exact owner, repository and positive integer PR number', async () => {
  for (const body of [
    { owner: 'LAURENCE1977', repo: 'Aegis-', pullNumber: 0 },
    { owner: 'LAURENCE1977', repo: 'Aegis-', pullNumber: 1.5 },
    { owner: 'LAURENCE1977', repo: 'Aegis-', pullNumber: 101, toolSlug: 'GITHUB_DELETE_REPOSITORY' },
    { owner: 'LAURENCE1977', repo: '../other', pullNumber: 101 },
  ]) {
    const db = new CountingD1();
    const response = await onRequestPost({
      request: await request(body),
      env: { ...envBase, AEGIS_DB: db },
    });
    assert.equal(response.status, 400);
    assert.equal(db.prepareCalls, 0);
  }
});
