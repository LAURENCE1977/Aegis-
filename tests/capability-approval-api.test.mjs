import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken } from '../functions/lib/auth.mjs';
import { createApprovalRequest } from '../functions/lib/capability-approvals.mjs';
import {
  onRequestGet,
  onRequestPost,
} from '../functions/api/approvals.js';

const secret = 'approval-api-test-session-secret-with-enough-entropy';
const envBase = {
  AEGIS_PASSWORD: 'test-password-long-enough',
  AEGIS_SESSION_SECRET: secret,
};
const binding = {
  principalId: 'owner',
  capabilityId: 'github-repository',
  capabilityVersion: '1.2.0',
  actionId: 'update-description',
  resourceId: 'github:repo:owner/project',
  connectionId: 'connection-1',
  inputDigest: 'sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  requestedBy: 'agent:forge',
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
};

class MemoryD1 {
  constructor() { this.rows = new Map(); }
  prepare(sql) {
    const db = this;
    return {
      values: [],
      bind(...values) { this.values = values; return this; },
      async run() {
        const v = this.values;
        if (sql.includes('INSERT INTO capability_approvals')) {
          db.rows.set(v[0], {
            id: v[0], principal_id: v[1], capability_id: v[2],
            capability_version: v[3], action_id: v[4], resource_id: v[5],
            connection_id: v[6], input_digest: v[7], requested_by: v[8],
            requested_at: v[9], expires_at: v[10], status: 'pending',
            decided_by: null, decided_at: null, consumed_at: null,
          });
          return { meta: { changes: 1 } };
        }
        return { meta: { changes: 0 } };
      },
      async first() {
        const v = this.values;
        if (sql.includes('SELECT * FROM capability_approvals WHERE id = ?')) {
          const row = db.rows.get(v[0]);
          return row ? { ...row } : null;
        }
        if (sql.includes('UPDATE capability_approvals')) {
          const [decision, decidedBy, decidedAt, id, now] = v;
          const row = db.rows.get(id);
          if (!row || row.status !== 'pending' || row.expires_at <= now) return null;
          row.status = decision;
          row.decided_by = decidedBy;
          row.decided_at = decidedAt;
          return { ...row };
        }
        return null;
      },
      async all() {
        const rows = [...db.rows.values()]
          .filter(row => row.status === 'pending')
          .sort((a, b) => a.requested_at.localeCompare(b.requested_at))
          .map(row => ({ ...row }));
        return { results: rows };
      },
    };
  }
}

async function authenticatedRequest(path, { method = 'GET', body, origin = 'https://aegis.example' } = {}) {
  const token = await createSessionToken(secret);
  const headers = { Cookie: '__Host-aegis_session=' + token };
  if (origin !== null) headers.Origin = origin;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return new Request('https://aegis.example' + path, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

test('approval inbox rejects unauthenticated reads before accessing D1', async () => {
  const response = await onRequestGet({
    request: new Request('https://aegis.example/api/approvals'),
    env: { ...envBase, APPROVALS: { prepare() { throw new Error('must not access D1'); } } },
  });
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('approval inbox fails closed when the D1 binding is missing', async () => {
  const response = await onRequestGet({
    request: await authenticatedRequest('/api/approvals'),
    env: envBase,
  });
  assert.equal(response.status, 503);
});

test('approval inbox returns pending exact-operation details without exposing the input digest', async () => {
  const db = new MemoryD1();
  const record = await createApprovalRequest(db, binding);
  const response = await onRequestGet({
    request: await authenticatedRequest('/api/approvals'),
    env: { ...envBase, APPROVALS: db },
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.approvals.length, 1);
  assert.equal(body.approvals[0].id, record.id);
  assert.equal(body.approvals[0].actionId, binding.actionId);
  assert.equal(body.approvals[0].resourceId, binding.resourceId);
  assert.equal('inputDigest' in body.approvals[0], false);
});

test('approval decisions reject missing and hostile origins before changing D1', async () => {
  for (const origin of [null, 'https://attacker.example']) {
    const db = new MemoryD1();
    const pending = await createApprovalRequest(db, binding);
    const response = await onRequestPost({
      request: await authenticatedRequest('/api/approvals', {
        method: 'POST',
        origin,
        body: { id: pending.id, decision: 'approved' },
      }),
      env: { ...envBase, APPROVALS: db },
    });
    assert.equal(response.status, 403);
    assert.equal(db.rows.get(pending.id).status, 'pending');
  }
});

test('only the authenticated owner can decide a pending approval and the API supplies the actor', async () => {
  const db = new MemoryD1();
  const pending = await createApprovalRequest(db, binding);
  const response = await onRequestPost({
    request: await authenticatedRequest('/api/approvals', {
      method: 'POST',
      body: { id: pending.id, decision: 'approved', decidedBy: 'attacker' },
    }),
    env: { ...envBase, APPROVALS: db },
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.approval.status, 'approved');
  assert.equal(body.approval.decidedBy, 'owner');
  assert.equal(db.rows.get(pending.id).decided_by, 'owner');
});

test('approval decisions reject malformed JSON and invalid decision values', async () => {
  const token = await createSessionToken(secret);
  const malformed = await onRequestPost({
    request: new Request('https://aegis.example/api/approvals', {
      method: 'POST',
      headers: {
        Origin: 'https://aegis.example',
        Cookie: '__Host-aegis_session=' + token,
        'Content-Type': 'application/json',
      },
      body: '{',
    }),
    env: { ...envBase, APPROVALS: new MemoryD1() },
  });
  assert.equal(malformed.status, 400);

  const invalid = await onRequestPost({
    request: await authenticatedRequest('/api/approvals', {
      method: 'POST',
      body: { id: 'approval-1', decision: 'execute' },
    }),
    env: { ...envBase, APPROVALS: new MemoryD1() },
  });
  assert.equal(invalid.status, 400);
});
