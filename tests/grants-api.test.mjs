import test from 'node:test';
import assert from 'node:assert/strict';
import { createRevocableSessionToken } from '../functions/lib/auth.mjs';
import { createCapabilityGrant } from '../functions/lib/capability-grants.mjs';
import {
  onRequestDelete,
  onRequestGet,
  onRequestPost,
} from '../functions/api/grants.js';

const secret = 'grant-api-test-session-secret-with-enough-entropy';
const sessions = new Map();
const envBase = {
  AEGIS_PASSWORD: 'test-password-long-enough',
  AEGIS_SESSION_SECRET: secret,
};

class MemoryD1 {
  constructor() { this.rows = new Map(); }
  prepare(sql) {
    const db = this;
    if (sql.includes('FROM auth_sessions')) return { bind(sid, now) { return { first: async () => { const row=sessions.get(sid); return row && row.expires_at>now && !row.revoked_at ? {session_id:sid,...row} : null; } }; } };
    return {
      values: [],
      bind(...values) { this.values = values; return this; },
      async run() {
        const v = this.values;
        if (sql.includes('INSERT INTO capability_grants')) {
          const [id, principal, capability, version, resource, scopes, createdBy, createdAt, expiresAt] = v;
          const row = {
            id, principal_id: principal, capability_id: capability,
            capability_version: version, resource_id: resource, scopes_json: scopes,
            status: 'active', created_by: createdBy, created_at: createdAt,
            expires_at: expiresAt, revoked_at: null,
          };
          db.rows.set(id, row);
          return { meta: { changes: 1 } };
        }
        if (sql.includes('UPDATE capability_grants')) {
          const [revokedAt, id, principal] = v;
          const row = db.rows.get(id);
          if (!row || row.principal_id !== principal || row.status !== 'active') {
            return { meta: { changes: 0 } };
          }
          row.status = 'revoked';
          row.revoked_at = revokedAt;
          return { meta: { changes: 1 } };
        }
        return { meta: { changes: 0 } };
      },
      async first() {
        if (sql.includes('SELECT * FROM capability_grants WHERE id')) {
          const row = db.rows.get(this.values[0]);
          return row ? { ...row } : null;
        }
        return null;
      },
      async all() {
        const [principal, limit] = this.values;
        return {
          results: [...db.rows.values()]
            .filter(row => row.principal_id === principal)
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
            .slice(0, limit)
            .map(row => ({ ...row })),
        };
      },
    };
  }
}

async function request(path, { method = 'GET', body, origin = 'https://aegis.example', authenticated = true } = {}) {
  const headers = {};
  if (authenticated) {
    const session = await createRevocableSessionToken(secret);
    sessions.set(session.sessionId,{expires_at:session.expiresAt,revoked_at:null,principal_id:'usr-root',tenant_id:'org-root',roles_json:'[\"owner\"]'});
    const token = session.token;
    headers.Cookie = '__Host-aegis_session=' + token;
  }
  if (origin !== null) headers.Origin = origin;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return new Request('https://aegis.example' + path, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

const grantBody = () => ({
  capabilityId: 'aegis-module-catalogue',
  actionIds: ['list'],
  resourceId: 'aegis:modules',
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
});

test('grant history rejects unauthenticated reads before touching D1', async () => {
  const response = await onRequestGet({
    request: await request('/api/grants', { authenticated: false }),
    env: { ...envBase, AEGIS_DB: { prepare() { throw new Error('must not access D1'); } } },
  });
  assert.equal(response.status, 401);
});

test('grant history fails closed when D1 is unavailable', async () => {
  const response = await onRequestGet({
    request: await request('/api/grants'),
    env: envBase,
  });
  assert.equal(response.status, 401);
});

test('grant history returns only owner-scoped safe metadata', async () => {
  const db = new MemoryD1();
  const record = await createCapabilityGrant(db, {
    principalId: 'owner',
    capabilityId: 'aegis-module-catalogue',
    capabilityVersion: '0.1.0',
    resourceId: 'aegis:modules',
    scopes: ['aegis:module-catalogue:read'],
    createdBy: 'owner',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });
  const response = await onRequestGet({
    request: await request('/api/grants'),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.grants.length, 1);
  assert.equal(body.grants[0].id, record.id);
  assert.deepEqual(body.grants[0].scopes, ['aegis:module-catalogue:read']);
  assert.equal('secretRef' in body.grants[0], false);
});

test('grant creation rejects missing and hostile origins without writing', async () => {
  for (const origin of [null, 'https://attacker.example']) {
    const db = new MemoryD1();
    const response = await onRequestPost({
      request: await request('/api/grants', { method: 'POST', origin, body: grantBody() }),
      env: { ...envBase, AEGIS_DB: db },
    });
    assert.equal(response.status, 403);
    assert.equal(db.rows.size, 0);
  }
});

test('grant creation derives owner, version and scopes from the approved registry', async () => {
  const db = new MemoryD1();
  const response = await onRequestPost({
    request: await request('/api/grants', { method: 'POST', body: grantBody() }),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(db.rows.get(body.grant.id).principal_id, 'owner');
  assert.equal(body.grant.createdBy, 'owner');
  assert.equal(body.grant.capabilityVersion, '0.1.0');
  assert.deepEqual(body.grant.scopes, ['aegis:module-catalogue:read']);
  assert.equal(body.grant.status, 'active');
});

test('grant creation rejects unregistered capabilities, actions and caller-supplied permissions', async () => {
  for (const body of [
    { ...grantBody(), capabilityId: 'unknown-capability' },
    { ...grantBody(), actionIds: ['delete'] },
    { ...grantBody(), scopes: ['aegis:admin:write'] },
    { ...grantBody(), principalId: 'attacker' },
    { ...grantBody(), resourceId: '*' },
  ]) {
    const db = new MemoryD1();
    const response = await onRequestPost({
      request: await request('/api/grants', { method: 'POST', body }),
      env: { ...envBase, AEGIS_DB: db },
    });
    assert.equal(response.status, 400);
    assert.equal(db.rows.size, 0);
  }
});

test('grant revocation is owner-authenticated, same-origin and scoped to the owner', async () => {
  const db = new MemoryD1();
  const grant = await createCapabilityGrant(db, {
    principalId: 'owner',
    capabilityId: 'aegis-module-catalogue',
    capabilityVersion: '0.1.0',
    resourceId: 'aegis:modules',
    scopes: ['aegis:module-catalogue:read'],
    createdBy: 'owner',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });
  const denied = await onRequestDelete({
    request: await request('/api/grants', { method: 'DELETE', origin: 'https://attacker.example', body: { id: grant.id } }),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(denied.status, 403);
  assert.equal(db.rows.get(grant.id).status, 'active');

  const response = await onRequestDelete({
    request: await request('/api/grants', { method: 'DELETE', body: { id: grant.id } }),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(response.status, 200);
  assert.equal(db.rows.get(grant.id).status, 'revoked');
});

test('grant endpoints reject malformed JSON, extra fields and oversized bodies', async () => {
  const malformed = new Request('https://aegis.example/api/grants', {
    method: 'POST',
    headers: {
      Origin: 'https://aegis.example',
      Cookie: '__Host-aegis_session=' + await createSessionToken(secret),
      'Content-Type': 'application/json',
    },
    body: '{',
  });
  assert.equal((await onRequestPost({ request: malformed, env: { ...envBase, AEGIS_DB: new MemoryD1() } })).status, 400);

  const oversized = await onRequestPost({
    request: await request('/api/grants', { method: 'POST', body: 'x'.repeat(3000) }),
    env: { ...envBase, AEGIS_DB: new MemoryD1() },
  });
  assert.equal(oversized.status, 413);
});
