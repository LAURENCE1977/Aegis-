import test from 'node:test';
import assert from 'node:assert/strict';
import { createRevocableSessionToken } from '../functions/lib/auth.mjs';
import { onRequestPost } from '../functions/api/sentinel/invoke.js';

const secret = 'sentinel-invoke-test-session-secret-with-enough-entropy';
const sessionRows = new Map();
const envBase = {
  AEGIS_PASSWORD: 'test-password-long-enough',
  AEGIS_SESSION_SECRET: secret,
};

class MemoryD1 {
  constructor(grantRow = null, rateLimitRow = { request_count: 1 }) {
    this.grantRow = grantRow;
    this.rateLimitRow = rateLimitRow;
    this.failRateLimit = false;
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
        if (sql.includes('INSERT INTO capability_invocation_limits')) {
          if (db.failRateLimit) throw new Error('rate-limit store unavailable');
          return db.rateLimitRow;
        }
        return null;
      },
      async run() {
        if (sql.includes('INSERT INTO capability_invocation_audit')) db.auditRows.push(this.values);
        return { meta: { changes: 1 } };
      },
    };
  }
}

async function request(body = {
  capabilityId: 'aegis-module-catalogue',
  actionId: 'list',
  resourceId: 'aegis:modules',
  input: {},
}, { authenticated = true, origin = 'https://aegis.example' } = {}) {
  const headers = {};
  if (authenticated) { const session=await createRevocableSessionToken(secret); sessionRows.set(session.sessionId,{expires_at:session.expiresAt,revoked_at:null,principal_id:'usr_root',tenant_id:'org_root',roles_json:'[\"owner\"]'}); headers.Cookie='__Host-aegis_session='+session.token; }
  if (origin !== null) headers.Origin = origin;
  headers['Content-Type'] = 'application/json';
  return new Request('https://aegis.example/api/sentinel/invoke', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

function activeGrant() {
  const now = Date.now();
  return {
    id: 'grant-1',
    principal_id: 'usr_root',
    capability_id: 'aegis-module-catalogue',
    capability_version: '0.1.0',
    resource_id: 'aegis:modules',
    scopes_json: JSON.stringify(['aegis:module-catalogue:read']),
    status: 'active',
    created_by: 'usr_root',
    created_at: new Date(now - 1000).toISOString(),
    expires_at: new Date(now + 60_000).toISOString(),
    revoked_at: null,
  };
}

test('Sentinel invocation rejects unauthenticated requests before touching D1', async () => {
  const db = new MemoryD1();
  const response = await onRequestPost({
    request: await request(undefined, { authenticated: false }),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(response.status, 401);
  assert.equal(db.prepareCalls, 0);
});

test('Sentinel invocation fails closed when authentication or D1 is unavailable', async () => {
  const unauthenticatedConfig = await onRequestPost({
    request: await request(),
    env: { AEGIS_DB: new MemoryD1() },
  });
  assert.equal(unauthenticatedConfig.status, 503);

  const missingDb = await onRequestPost({
    request: await request(),
    env: envBase,
  });
  assert.equal(missingDb.status, 401);
});

test('Sentinel invocation rejects cross-origin requests before touching D1', async () => {
  const db = new MemoryD1(activeGrant());
  const response = await onRequestPost({
    request: await request(undefined, { origin: 'https://attacker.example' }),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(response.status, 403);
  assert.equal(db.prepareCalls, 1);
});

test('Sentinel invocation exposes only the fixed read-only module action and empty input', async () => {
  for (const body of [
    { capabilityId: 'unknown', actionId: 'run', resourceId: 'aegis:modules', input: {} },
    { capabilityId: 'aegis-module-catalogue', actionId: 'delete', resourceId: 'aegis:modules', input: {} },
    { capabilityId: 'aegis-module-catalogue', actionId: 'list', resourceId: '*', input: {} },
    { capabilityId: 'aegis-module-catalogue', actionId: 'list', resourceId: 'aegis:modules', input: { command: 'run-shell' } },
    { capabilityId: 'aegis-module-catalogue', actionId: 'list', resourceId: 'aegis:modules', input: {}, endpoint: 'https://attacker.example' },
  ]) {
    const db = new MemoryD1(activeGrant());
    const response = await onRequestPost({
      request: await request(body),
      env: { ...envBase, AEGIS_DB: db },
    });
    assert.equal(response.status, 400);
    assert.equal(db.auditRows.length, 0);
  }
});

test('Sentinel invocation denies missing grants and records a redacted denial audit', async () => {
  const db = new MemoryD1();
  const response = await onRequestPost({
    request: await request(),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(response.status, 403);
  const body = await response.json();
  assert.equal(body.reasonCode, 'GRANT_REQUIRED');
  assert.equal(db.auditRows.length, 1);
  assert.equal(JSON.stringify(db.auditRows).includes('module catalogue'), false);
});

test('Sentinel invokes only the granted read-only module adapter and records the audit lifecycle', async () => {
  const db = new MemoryD1(activeGrant());
  const response = await onRequestPost({
    request: await request(),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.reasonCode, 'SUCCESS');
  assert.match(body.invocationId, /^[0-9a-f-]{36}$/i);
  assert.ok(body.output.modules.some(module => module.id === 'forge'));
  assert.equal(db.auditRows.length, 3);
  assert.ok(db.auditRows.every(row => row[1] === body.invocationId));
  assert.equal(JSON.stringify(body).includes('inputDigest'), false);
});
test('Sentinel returns 429 and records a denial when the action budget is exhausted', async () => {
  const db = new MemoryD1(activeGrant(), null);
  const response = await onRequestPost({
    request: await request(),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(response.status, 429);
  const body = await response.json();
  assert.equal(body.reasonCode, 'RATE_LIMITED');
  assert.equal(db.auditRows.length, 1);
});

test('Sentinel fails closed with 503 when rate-limit storage is unavailable', async () => {
  const db = new MemoryD1(activeGrant());
  db.failRateLimit = true;
  const response = await onRequestPost({
    request: await request(),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.reasonCode, 'RATE_LIMIT_STORE_UNAVAILABLE');
  assert.equal(db.auditRows.length, 1);
});
