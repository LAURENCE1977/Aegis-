import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken } from '../functions/lib/auth.mjs';
import { onRequestPost } from '../functions/api/approval-requests.js';

const sessionSecret = 'approval-request-test-session-secret-with-enough-entropy';
const envBase = {
  AEGIS_PASSWORD: 'test-password-long-enough',
  AEGIS_SESSION_SECRET: sessionSecret,
};

class MemoryD1 {
  constructor(connection = null) { this.connection = connection; this.approvals = new Map(); }
  prepare(sql) {
    const db = this;
    return {
      values: [],
      bind(...values) { this.values = values; return this; },
      async run() {
        if (sql.includes('INSERT INTO capability_approvals')) {
          const [id, principalId, capabilityId, version, actionId, resourceId, summary,
            connectionId, digest, requestedBy, requestedAt, expiresAt] = this.values;
          db.approvals.set(id, {
            id, principal_id: principalId, capability_id: capabilityId,
            capability_version: version, action_id: actionId, resource_id: resourceId,
            operation_summary: summary, connection_id: connectionId, input_digest: digest,
            requested_by: requestedBy, requested_at: requestedAt, expires_at: expiresAt,
            status: 'pending', decided_by: null, decided_at: null, consumed_at: null,
          });
        }
        return { meta: { changes: 1 } };
      },
      async first() {
        if (sql.includes('FROM capability_connections')) return db.connection ? { ...db.connection } : null;
        if (sql.includes('FROM capability_approvals')) return db.approvals.get(this.values[0]) || null;
        return null;
      },
    };
  }
}

async function request(body, { authenticated = true, origin = 'https://aegis.example' } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (authenticated) headers.Cookie = '__Host-aegis_session=' + await createSessionToken(sessionSecret);
  if (origin !== null) headers.Origin = origin;
  return new Request('https://aegis.example/api/approval-requests', {
    method: 'POST', headers, body: JSON.stringify(body),
  });
}

function activeConnection() {
  const now = Date.now();
  return {
    id: 'github-connection-1', principal_id: 'owner', provider_id: 'github',
    secret_ref: 'vault://connections/550e8400-e29b-41d4-a716-446655440000',
    scopes_json: JSON.stringify(['github:private-metadata:read']),
    status: 'active', created_by: 'owner', created_at: new Date(now - 1000).toISOString(),
    expires_at: new Date(now + 60_000).toISOString(), revoked_at: null,
  };
}

test('approval request API rejects unauthenticated and cross-origin requests', async () => {
  const db = new MemoryD1(activeConnection());
  const unauth = await onRequestPost({
    request: await request({ sourceUrl: 'https://github.com/Example/PrivateRepo' }, { authenticated: false }),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(unauth.status, 401);
  const cross = await onRequestPost({
    request: await request({ sourceUrl: 'https://github.com/Example/PrivateRepo' }, { origin: 'https://attacker.example' }),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(cross.status, 403);
  assert.equal(db.approvals.size, 0);
});

test('approval request API derives exact private resource, connection, digest and summary server-side', async () => {
  const db = new MemoryD1(activeConnection());
  const response = await onRequestPost({
    request: await request({ sourceUrl: 'https://github.com/Example/PrivateRepo.git' }),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.approval.resourceId, 'github:private:Example/PrivateRepo');
  assert.equal(body.approval.operationSummary, 'Read private GitHub repository metadata for Example/PrivateRepo');
  assert.equal(body.approval.status, 'pending');
  assert.equal('connectionId' in body.approval, false);
  assert.equal('inputDigest' in body.approval, false);
  const row = [...db.approvals.values()][0];
  assert.equal(row.connection_id, 'github-connection-1');
  assert.match(row.input_digest, /^sha256:[a-f0-9]{64}$/);
});

test('approval request API requires a live GitHub connection and rejects caller-selected bindings', async () => {
  const noConnection = await onRequestPost({
    request: await request({ sourceUrl: 'https://github.com/Example/PrivateRepo' }),
    env: { ...envBase, AEGIS_DB: new MemoryD1() },
  });
  assert.equal(noConnection.status, 409);

  const db = new MemoryD1(activeConnection());
  const tampered = await onRequestPost({
    request: await request({
      sourceUrl: 'https://github.com/Example/PrivateRepo',
      resourceId: 'github:private:Other/Repo',
      connectionId: 'attacker',
    }),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(tampered.status, 400);
  assert.equal(db.approvals.size, 0);
});
