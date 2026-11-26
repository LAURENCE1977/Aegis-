import test from 'node:test';
import assert from 'node:assert/strict';
import { createRevocableSessionToken } from '../functions/lib/auth.mjs';
import { onRequestPost } from '../functions/api/sentinel/github-discover.js';

const secret = 'sentinel-github-test-session-secret-with-enough-entropy';
const sessionRows = new Map();
const envBase = {
  AEGIS_PASSWORD: 'test-password-long-enough',
  AEGIS_SESSION_SECRET: secret,
};

class MemoryD1 {
  constructor(grantRow = null, rateLimitRow = { request_count: 1 }) {
    this.grantRow = grantRow;
    this.rateLimitRow = rateLimitRow;
    this.auditRows = [];
    this.prepareCalls = 0;
  }
  prepare(sql) {
    this.prepareCalls += 1;
    const db = this;
    if (sql.includes('FROM auth_sessions')) return { bind(sid, now) { return { first: async () => { const row=sessionRows.get(sid); return row && row.expires_at>now && !row.revoked_at ? {session_id:sid,...row} : null; } }; } };
    return {
      values: [],
      bind(...values) { this.values = values; return this; },
      async first() {
        if (sql.includes('FROM capability_grants')) return db.grantRow ? { ...db.grantRow } : null;
        if (sql.includes('INSERT INTO capability_invocation_limits')) return db.rateLimitRow;
        return null;
      },
      async run() {
        if (sql.includes('INSERT INTO capability_invocation_audit')) db.auditRows.push(this.values);
        return { meta: { changes: 1 } };
      },
    };
  }
}

async function request(body = { sourceUrl: 'https://github.com/Example/Repo' }, {
  authenticated = true,
  origin = 'https://aegis.example',
} = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (authenticated) { const session=await createRevocableSessionToken(secret); sessionRows.set(session.sessionId,{expires_at:session.expiresAt,revoked_at:null,principal_id:'usr_root',tenant_id:'org_root',roles_json:'[\"owner\"]'}); headers.Cookie='__Host-aegis_session='+session.token; }
  if (origin !== null) headers.Origin = origin;
  return new Request('https://aegis.example/api/sentinel/github-discover', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

function activeGrant() {
  const now = Date.now();
  return {
    id: 'github-grant-1',
    principal_id: 'usr_root',
    capability_id: 'aegis-github-public-discovery',
    capability_version: '0.1.0',
    resource_id: 'github:public:Example/Repo',
    scopes_json: JSON.stringify(['github:public-metadata:read']),
    status: 'active',
    created_by: 'usr_root',
    created_at: new Date(now - 1000).toISOString(),
    expires_at: new Date(now + 60_000).toISOString(),
    revoked_at: null,
  };
}

function githubResponse(overrides = {}) {
  return new Response(JSON.stringify({
    full_name: 'Example/Repo',
    html_url: 'https://github.com/Example/Repo',
    description: 'A public example repository',
    default_branch: 'main',
    private: false,
    archived: false,
    fork: false,
    pushed_at: '2026-11-01T00:00:00Z',
    stargazers_count: 12,
    language: 'TypeScript',
    license: { spdx_id: 'MIT', name: 'MIT License' },
    ...overrides,
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

test('GitHub discovery rejects unauthenticated requests before touching D1', async () => {
  const db = new MemoryD1(activeGrant());
  const response = await onRequestPost({
    request: await request(undefined, { authenticated: false }),
    env: { ...envBase, AEGIS_DB: db },
    fetchImpl: async () => { throw new Error('must not fetch'); },
  });
  assert.equal(response.status, 401);
  assert.equal(db.prepareCalls, 0);
});

test('GitHub discovery rejects cross-origin and malformed repository URLs before fetching', async () => {
  let fetchCalls = 0;
  const db = new MemoryD1(activeGrant());
  const crossOrigin = await onRequestPost({
    request: await request(undefined, { origin: 'https://attacker.example' }),
    env: { ...envBase, AEGIS_DB: db },
    fetchImpl: async () => { fetchCalls += 1; throw new Error('must not fetch'); },
  });
  assert.equal(crossOrigin.status, 403);

  for (const sourceUrl of [
    'https://attacker.example/Example/Repo',
    'https://github.com/Example/Repo/issues/1',
    'https://github.com/Example/Repo?tab=readme',
  ]) {
    const response = await onRequestPost({
      request: await request({ sourceUrl }),
      env: { ...envBase, AEGIS_DB: db },
      fetchImpl: async () => { fetchCalls += 1; throw new Error('must not fetch'); },
    });
    assert.equal(response.status, 400);
  }
  assert.equal(fetchCalls, 0);
});

test('GitHub discovery requires an exact repository grant before external fetch', async () => {
  const db = new MemoryD1();
  let fetchCalls = 0;
  const response = await onRequestPost({
    request: await request(),
    env: { ...envBase, AEGIS_DB: db },
    fetchImpl: async () => { fetchCalls += 1; throw new Error('must not fetch'); },
  });
  assert.equal(response.status, 403);
  const body = await response.json();
  assert.equal(body.reasonCode, 'GRANT_REQUIRED');
  assert.equal(db.auditRows.length, 1);
  assert.equal(fetchCalls, 0);
});

test('GitHub discovery enforces the atomic rate limit before external fetch', async () => {
  const db = new MemoryD1(activeGrant(), null);
  let fetchCalls = 0;
  const response = await onRequestPost({
    request: await request(),
    env: { ...envBase, AEGIS_DB: db },
    fetchImpl: async () => { fetchCalls += 1; throw new Error('must not fetch'); },
  });
  assert.equal(response.status, 429);
  assert.equal((await response.json()).reasonCode, 'RATE_LIMITED');
  assert.equal(db.auditRows.length, 1);
  assert.equal(fetchCalls, 0);
});

test('GitHub discovery executes only the fixed public metadata adapter and audits the invocation', async () => {
  const db = new MemoryD1(activeGrant());
  let requestedUrl;
  let requestedOptions;
  const response = await onRequestPost({
    request: await request({ sourceUrl: 'https://github.com/Example/Repo.git' }),
    env: { ...envBase, AEGIS_DB: db },
    fetchImpl: async (url, options) => {
      requestedUrl = url;
      requestedOptions = options;
      return githubResponse();
    },
  });
  assert.equal(response.status, 200);
  assert.equal(requestedUrl, 'https://api.github.com/repos/Example/Repo');
  assert.equal(requestedOptions.redirect, 'error');
  assert.ok(requestedOptions.signal);
  const body = await response.json();
  assert.equal(body.reasonCode, 'SUCCESS');
  assert.match(body.invocationId, /^[0-9a-f-]{36}$/i);
  assert.equal(body.repository.fullName, 'Example/Repo');
  assert.equal(body.repository.private, false);
  assert.equal(db.auditRows.length, 3);
  assert.ok(db.auditRows.every(row => row[1] === body.invocationId));
});

test('GitHub discovery rejects private repository metadata and records execution failure', async () => {
  const db = new MemoryD1(activeGrant());
  const response = await onRequestPost({
    request: await request(),
    env: { ...envBase, AEGIS_DB: db },
    fetchImpl: async () => githubResponse({ private: true }),
  });
  assert.equal(response.status, 502);
  const body = await response.json();
  assert.equal(body.reasonCode, 'EXECUTION_FAILED');
  assert.equal('output' in body, false);
  assert.equal(db.auditRows.length, 3);
});
