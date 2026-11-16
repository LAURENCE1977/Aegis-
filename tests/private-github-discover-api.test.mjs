import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken } from '../functions/lib/auth.mjs';
import { storeVaultSecret } from '../functions/lib/secret-vault.mjs';
import { onRequestPost } from '../functions/api/sentinel/github-private-discover.js';

const sessionSecret = 'private-github-route-test-session-secret';
const token = 'github_pat_' + 'c'.repeat(40);
const rawKey = new Uint8Array(32).fill(31);
const vaultEnv = {
  AEGIS_PASSWORD: 'test-password-long-enough',
  AEGIS_SESSION_SECRET: sessionSecret,
  AEGIS_VAULT_KEYRING: JSON.stringify({ v1: btoa(String.fromCharCode(...rawKey)) }),
  AEGIS_VAULT_ACTIVE_KEY_VERSION: 'v1',
};
const sourceUrl = 'https://github.com/Example/PrivateRepo';
const resourceId = 'github:private:Example/PrivateRepo';
const now = Date.now();

async function digestInput() {
  const bytes = new TextEncoder().encode(JSON.stringify({ sourceUrl }));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return 'sha256:' + [...digest].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

class PrivateGitHubD1 {
  constructor({ grant = true, connection = true, approval = true } = {}) {
    this.grantRow = grant ? {
      id: 'private-grant-1', principal_id: 'owner',
      capability_id: 'aegis-github-private-metadata', capability_version: '0.1.0',
      resource_id: resourceId, scopes_json: JSON.stringify(['github:private-metadata:read']),
      status: 'active', created_by: 'owner',
      created_at: new Date(now - 1000).toISOString(),
      expires_at: new Date(now + 60 * 60 * 1000).toISOString(), revoked_at: null,
    } : null;
    this.connectionRow = connection ? {
      id: 'github-connection-1', principal_id: 'owner', provider_id: 'github',
      secret_ref: null, scopes_json: JSON.stringify(['github:private-metadata:read']),
      status: 'active', created_by: 'owner',
      created_at: new Date(now - 1000).toISOString(),
      expires_at: new Date(now + 60 * 60 * 1000).toISOString(), revoked_at: null,
    } : null;
    this.approvalRow = approval ? {
      id: 'private-approval-1', principal_id: 'owner',
      capability_id: 'aegis-github-private-metadata', capability_version: '0.1.0',
      action_id: 'discover', resource_id: resourceId,
      operation_summary: 'Read private GitHub repository metadata for Example/PrivateRepo',
      connection_id: 'github-connection-1', input_digest: null,
      requested_by: 'owner', requested_at: new Date(now - 1000).toISOString(),
      expires_at: new Date(now + 10 * 60 * 1000).toISOString(),
      status: 'approved', decided_by: 'owner', decided_at: new Date(now - 500).toISOString(),
      consumed_at: null,
    } : null;
    this.secrets = new Map();
    this.auditRows = [];
  }
  prepare(sql) {
    const db = this;
    return {
      values: [],
      bind(...values) { this.values = values; return this; },
      async run() {
        if (sql.includes('INSERT INTO capability_secrets')) {
          const [id, principalId, providerId, keyVersion, ivB64, ciphertextB64, createdAt, updatedAt] = this.values;
          db.secrets.set(id, {
            secret_id: id, principal_id: principalId, provider_id: providerId,
            key_version: keyVersion, iv_b64: ivB64, ciphertext_b64: ciphertextB64,
            created_at: createdAt, updated_at: updatedAt, status: 'active', revoked_at: null,
          });
        }
        if (sql.includes('INSERT INTO capability_invocation_audit')) db.auditRows.push(this.values);
        return { meta: { changes: 1 } };
      },
      async first() {
        if (sql.includes('FROM capability_grants')) return db.grantRow ? { ...db.grantRow } : null;
        if (sql.includes('FROM capability_connections') && sql.includes('WHERE id = ?')) {
          const [id, principalId] = this.values;
          return db.connectionRow && db.connectionRow.id === id && db.connectionRow.principal_id === principalId
            ? { ...db.connectionRow } : null;
        }
        if (sql.includes('FROM capability_connections')) return db.connectionRow ? { ...db.connectionRow } : null;
        if (sql.includes('FROM capability_approvals')) {
          const [principalId, capabilityId, version, actionId, resource, digest] = this.values;
          const row = db.approvalRow;
          return row && row.principal_id === principalId && row.capability_id === capabilityId &&
            row.capability_version === version && row.action_id === actionId &&
            row.resource_id === resource && row.input_digest === digest &&
            row.status === 'approved' && !row.consumed_at ? { ...row } : null;
        }
        if (sql.includes('UPDATE capability_approvals')) {
          const [consumedAt, id, _expiry, principalId, capabilityId, version, actionId, resource, summary, connectionId, digest] = this.values;
          const row = db.approvalRow;
          if (!row || row.id !== id || row.principal_id !== principalId ||
              row.capability_id !== capabilityId || row.capability_version !== version ||
              row.action_id !== actionId || row.resource_id !== resource ||
              row.operation_summary !== summary || row.connection_id !== connectionId ||
              row.input_digest !== digest || row.status !== 'approved' || row.consumed_at) return null;
          row.status = 'consumed';
          row.consumed_at = consumedAt;
          return { ...row };
        }
        if (sql.includes('INSERT INTO capability_invocation_limits')) return { request_count: 1 };
        if (sql.includes('FROM capability_secrets')) {
          const [id, principalId, providerId] = this.values;
          const row = db.secrets.get(id);
          return row && row.principal_id === principalId && row.provider_id === providerId ? { ...row } : null;
        }
        return null;
      },
    };
  }
}

async function makeRequest(body = { sourceUrl }, authenticated = true) {
  const headers = { 'Content-Type': 'application/json', Origin: 'https://aegis.example' };
  if (authenticated) headers.Cookie = '__Host-aegis_session=' + await createSessionToken(sessionSecret);
  return new Request('https://aegis.example/api/sentinel/github-private-discover', {
    method: 'POST', headers, body: JSON.stringify(body),
  });
}

async function preparedDb(options = {}) {
  const db = new PrivateGitHubD1(options);
  const stored = await storeVaultSecret(db, {
    principalId: 'owner', providerId: 'github', secret: token,
  }, vaultEnv, now);
  if (db.connectionRow) db.connectionRow.secret_ref = stored.secretRef;
  if (db.approvalRow) db.approvalRow.input_digest = await digestInput();
  return db;
}

function privateMetadataResponse() {
  return new Response(JSON.stringify({
    full_name: 'Example/PrivateRepo',
    html_url: 'https://github.com/Example/PrivateRepo',
    description: 'Private repository metadata',
    default_branch: 'main',
    private: true,
    archived: false,
    fork: false,
    pushed_at: '2026-11-01T00:00:00Z',
    stargazers_count: 3,
    language: 'TypeScript',
    license: null,
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

test('private GitHub route requires exact grant, connection and approved invocation before sending the vault token', async () => {
  const db = await preparedDb();
  let requestedOptions;
  const response = await onRequestPost({
    request: await makeRequest(),
    env: { ...vaultEnv, AEGIS_DB: db },
    fetchImpl: async (_url, options) => {
      requestedOptions = options;
      return privateMetadataResponse();
    },
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.repository.fullName, 'Example/PrivateRepo');
  assert.equal(body.repository.private, true);
  assert.equal(requestedOptions.headers.Authorization, 'Bearer ' + token);
  assert.equal(JSON.stringify(body).includes(token), false);
  assert.equal(JSON.stringify(db.auditRows).includes(token), false);
  assert.equal(db.auditRows.length, 3);
  assert.equal(db.approvalRow.status, 'consumed');
});

test('private GitHub route fails closed without grant, connection or human approval', async () => {
  for (const [options, expected] of [
    [{ grant: false }, 403],
    [{ connection: false }, 403],
    [{ approval: false }, 428],
  ]) {
    const db = await preparedDb(options);
    let fetchCalls = 0;
    const response = await onRequestPost({
      request: await makeRequest(),
      env: { ...vaultEnv, AEGIS_DB: db },
      fetchImpl: async () => { fetchCalls += 1; return privateMetadataResponse(); },
    });
    assert.equal(response.status, expected);
    assert.equal(fetchCalls, 0);
  }
});

test('private GitHub route never dispatches when the vault keyring is unavailable', async () => {
  const db = await preparedDb();
  let fetchCalls = 0;
  const response = await onRequestPost({
    request: await makeRequest(),
    env: { AEGIS_PASSWORD: vaultEnv.AEGIS_PASSWORD, AEGIS_SESSION_SECRET: sessionSecret, AEGIS_DB: db },
    fetchImpl: async () => { fetchCalls += 1; return privateMetadataResponse(); },
  });
  assert.equal(response.status, 502);
  assert.equal(fetchCalls, 0);
  assert.equal(db.auditRows.length, 3);
});

test('private GitHub route rejects non-repository URLs before any policy or external call', async () => {
  const db = await preparedDb();
  let fetchCalls = 0;
  const response = await onRequestPost({
    request: await makeRequest({ sourceUrl: 'https://github.com/Example/PrivateRepo/issues/1' }),
    env: { ...vaultEnv, AEGIS_DB: db },
    fetchImpl: async () => { fetchCalls += 1; return privateMetadataResponse(); },
  });
  assert.equal(response.status, 400);
  assert.equal(fetchCalls, 0);
  assert.equal(db.auditRows.length, 0);
});
