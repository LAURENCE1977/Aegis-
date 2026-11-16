import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken } from '../functions/lib/auth.mjs';
import { onRequestPost } from '../functions/api/sentinel/invoke.js';

const secret = 'sentinel-invoke-test-session-secret-with-enough-entropy';
const envBase = {
  AEGIS_PASSWORD: 'test-password-long-enough',
  AEGIS_SESSION_SECRET: secret,
};

class MemoryD1 {
  constructor(grantRow = null) {
    this.grantRow = grantRow;
    this.auditRows = [];
    this.prepareCalls = 0;
  }
  prepare(sql) {
    this.prepareCalls += 1;
    const db = this;
    return {
      values: [],
      bind(...values) { this.values = values; return this; },
      async first() {
        if (sql.includes('FROM capability_grants')) return db.grantRow ? { ...db.grantRow } : null;
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
  if (authenticated) headers.Cookie = '__Host-aegis_session=' + await createSessionToken(secret);
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
    principal_id: 'owner',
    capability_id: 'aegis-module-catalogue',
    capability_version: '0.1.0',
    resource_id: 'aegis:modules',
    scopes_json: JSON.stringify(['aegis:module-catalogue:read']),
    status: 'active',
    created_by: 'owner',
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
  assert.equal(missingDb.status, 503);
});

test('Sentinel invocation rejects cross-origin requests before touching D1', async () => {
  const db = new MemoryD1(activeGrant());
  const response = await onRequestPost({
    request: await request(undefined, { origin: 'https://attacker.example' }),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(response.status, 403);
  assert.equal(db.prepareCalls, 0);
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
  assert.ok(body.output.modules.some(module => module.id === 'forge'));
  assert.equal(db.auditRows.length, 3);
  assert.equal(JSON.stringify(body).includes('inputDigest'), false);
});
