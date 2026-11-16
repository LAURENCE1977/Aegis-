import test from 'node:test';
import assert from 'node:assert/strict';
import { createConnection } from '../functions/lib/capability-connections.mjs';
import { storeVaultSecret } from '../functions/lib/secret-vault.mjs';
import { getCapabilityManifest, validateCapabilityManifest } from '../functions/lib/capability-registry.mjs';
import { createComposioAdapterRegistry } from '../functions/lib/composio-adapters.mjs';
import { runSentinelInvocation } from '../functions/lib/sentinel.mjs';
import { createSessionToken, sessionCookie } from '../functions/lib/auth.mjs';
import {
  onRequestGet as getComposioConnection,
  onRequestPost as createComposioConnection,
  onRequestDelete as revokeComposioConnection,
} from '../functions/api/connections/composio.js';

class MemoryD1 {
  constructor() {
    this.connections = new Map();
    this.secrets = new Map();
  }

  prepare(sql) {
    const db = this;
    return {
      values: [],
      bind(...values) { this.values = values; return this; },
      async run() {
        const v = this.values;
        if (sql.includes('INSERT INTO capability_secrets')) {
          const [id, principal, provider, keyVersion, iv, ciphertext, createdAt] = v;
          db.secrets.set(id, {
            secret_id: id, principal_id: principal, provider_id: provider,
            key_version: keyVersion, iv_b64: iv, ciphertext_b64: ciphertext,
            created_at: createdAt, updated_at: createdAt, status: 'active', revoked_at: null,
          });
          return { meta: { changes: 1 } };
        }
        if (sql.includes('UPDATE capability_connections') && sql.includes('expires_at <= ?')) {
          return { meta: { changes: 0 } };
        }
        if (sql.includes('UPDATE capability_connections') && sql.includes("SET status = 'revoked'")) {
          const [revokedAt, id, principal] = v;
          const row = db.connections.get(id);
          if (!row || row.principal_id !== principal || row.status !== 'active') {
            return { meta: { changes: 0 } };
          }
          row.status = 'revoked';
          row.revoked_at = revokedAt;
          return { meta: { changes: 1 } };
        }
        if (sql.includes('UPDATE capability_secrets') && sql.includes("status = 'revoked'")) {
          const [updatedAt, revokedAt, id, principal, provider] = v;
          const row = db.secrets.get(id);
          if (!row || row.principal_id !== principal || row.provider_id !== provider || row.status !== 'active') {
            return { meta: { changes: 0 } };
          }
          row.status = 'revoked';
          row.iv_b64 = null;
          row.ciphertext_b64 = null;
          row.updated_at = updatedAt;
          row.revoked_at = revokedAt;
          return { meta: { changes: 1 } };
        }
        if (sql.includes('INSERT INTO capability_connections')) {
          const [id, principal, provider, secretRef, scopes, createdBy, createdAt, expiresAt] = v;
          db.connections.set(id, {
            id, principal_id: principal, provider_id: provider, secret_ref: secretRef,
            scopes_json: scopes, created_by: createdBy, created_at: createdAt,
            expires_at: expiresAt, status: 'active', revoked_at: null,
          });
          return { meta: { changes: 1 } };
        }
        return { meta: { changes: 0 } };
      },
      async first() {
        const v = this.values;
        if (sql.includes('SELECT * FROM capability_connections')) {
          if (sql.includes('WHERE id = ?')) {
            const row = db.connections.get(v[0]);
            return row ? { ...row } : null;
          }
          const [principal, provider, now] = v;
          const row = [...db.connections.values()].find((item) =>
            item.principal_id === principal && item.provider_id === provider &&
            item.status === 'active' && item.revoked_at === null &&
            (!item.expires_at || item.expires_at > now));
          return row ? { ...row } : null;
        }
        if (sql.includes('SELECT * FROM capability_secrets')) {
          const [id, principal, provider] = v;
          const row = db.secrets.get(id);
          return row && row.principal_id === principal && row.provider_id === provider
            ? { ...row } : null;
        }
        return null;
      },
    };
  }
}

const rawKey = crypto.getRandomValues(new Uint8Array(32));
const keyB64 = btoa(String.fromCharCode(...rawKey));
const vaultEnv = {
  AEGIS_VAULT_KEYRING: JSON.stringify({ v1: keyB64 }),
  AEGIS_VAULT_ACTIVE_KEY_VERSION: 'v1',
  COMPOSIO_API_KEY: 'server-side-test-key',
};
const sessionId = 'trs_1a2b3c4d5e6f';
const connectedAccountId = 'ca_abc123xyz';

async function connectedDb() {
  const db = new MemoryD1();
  const stored = await storeVaultSecret(db, {
    principalId: 'owner',
    providerId: 'composio',
    secret: JSON.stringify({ sessionId, connectedAccountId }),
  }, vaultEnv);
  await createConnection(db, {
    principalId: 'owner',
    providerId: 'composio',
    secretRef: stored.secretRef,
    scopes: ['composio:github-repository:read'],
    createdBy: 'owner',
  });
  return db;
}

function repositoryData() {
  return {
    id: 123,
    name: 'Hello-World',
    full_name: 'octocat/Hello-World',
    html_url: 'https://github.com/octocat/Hello-World',
    description: 'Example repository',
    private: false,
    archived: false,
    fork: false,
    default_branch: 'main',
    stargazers_count: 12,
    language: 'TypeScript',
    license: { name: 'MIT License', spdx_id: 'MIT' },
    ignored_secret: 'must-not-escape',
  };
}

test('registers an approved confidential read-only Composio GitHub capability', () => {
  const manifest = getCapabilityManifest('aegis-composio-github-readonly');
  assert.ok(manifest);
  assert.equal(validateCapabilityManifest(manifest), true);
  assert.equal(manifest.provider.id, 'composio');
  assert.equal(manifest.auth.mode, 'secret-reference');
  assert.equal(manifest.actions[0].effect, 'read');
  assert.equal(manifest.actions[0].approval, 'none');
  assert.deepEqual(manifest.network.egressHosts, ['backend.composio.dev']);
});

test('loads the exact owner connection and vault session only after the Sentinel adapter is called', async () => {
  const db = await connectedDb();
  const calls = [];
  const adapters = createComposioAdapterRegistry({
    db,
    env: vaultEnv,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (url.includes('/toolkits?toolkits=github')) {
        return new Response(JSON.stringify({
          items: [{ slug: 'github', connected_account: { id: connectedAccountId, status: 'ACTIVE' } }],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.endsWith('/tools?limit=100')) {
        return new Response(JSON.stringify({
          items: [{ slug: 'GITHUB_GET_A_REPOSITORY' }],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({
        data: repositoryData(),
        error: null,
        log_id: 'log_123',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    },
  });

  const output = await adapters['aegis-composio-github-readonly:get-repository'](
    { owner: 'octocat', repo: 'Hello-World' },
    {
      capabilityId: 'aegis-composio-github-readonly',
      actionId: 'get-repository',
      principalId: 'owner',
      connectionId: [...db.connections.keys()][0],
      resourceId: 'github:repository:octocat/Hello-World',
      scopes: ['github:repository:read'],
    },
  );

  assert.equal(calls.length, 3);
  assert.ok(calls.every((call) => call.url.startsWith('https://backend.composio.dev/')));
  assert.equal(calls[1].options.headers['x-api-key'], vaultEnv.COMPOSIO_API_KEY);
  assert.deepEqual(JSON.parse(calls[2].options.body), {
    tool_slug: 'GITHUB_GET_A_REPOSITORY',
    arguments: { owner: 'octocat', repo: 'Hello-World' },
    account: connectedAccountId,
  });
  assert.deepEqual(output, {
    repository: {
      id: 123,
      name: 'Hello-World',
      fullName: 'octocat/Hello-World',
      url: 'https://github.com/octocat/Hello-World',
      description: 'Example repository',
      private: false,
      archived: false,
      fork: false,
      defaultBranch: 'main',
      stars: 12,
      language: 'TypeScript',
      licence: { name: 'MIT License', spdxId: 'MIT' },
    },
    provider: 'composio',
    logId: 'log_123',
  });
  assert.equal(JSON.stringify(output).includes('must-not-escape'), false);
});

test('rejects a mismatched connection ID and an ungranted resource before any provider request', async () => {
  const db = await connectedDb();
  let calls = 0;
  const adapters = createComposioAdapterRegistry({
    db,
    env: vaultEnv,
    fetchImpl: async () => { calls += 1; throw new Error('must not fetch'); },
  });
  const handler = adapters['aegis-composio-github-readonly:get-repository'];
  await assert.rejects(handler(
    { owner: 'octocat', repo: 'Hello-World' },
    { capabilityId: 'aegis-composio-github-readonly', actionId: 'get-repository', principalId: 'owner', connectionId: 'another-connection', resourceId: 'github:repository:octocat/Hello-World', scopes: ['github:repository:read'] },
  ), /connection/i);
  await assert.rejects(handler(
    { owner: 'octocat', repo: 'Hello-World' },
    { capabilityId: 'aegis-composio-github-readonly', actionId: 'get-repository', principalId: 'owner', connectionId: [...db.connections.keys()][0], resourceId: 'github:repository:octocat/Other-Repo', scopes: ['github:repository:read'] },
  ), /resource/i);
  assert.equal(calls, 0);
});

test('rejects unexpected tool exposure, extra input fields and missing server secrets', async () => {
  const db = await connectedDb();
  const tools = createComposioAdapterRegistry({
    db,
    env: vaultEnv,
    fetchImpl: async (url) => new Response(JSON.stringify(url.includes('/toolkits?toolkits=github')
      ? { items: [{ slug: 'github', connected_account: { id: connectedAccountId, status: 'ACTIVE' } }] }
      : { items: [
          { slug: 'GITHUB_GET_A_REPOSITORY' },
          { slug: 'GITHUB_CREATE_AN_ISSUE' },
        ] }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
  });
  await assert.rejects(tools['aegis-composio-github-readonly:get-repository'](
    { owner: 'octocat', repo: 'Hello-World' },
    { capabilityId: 'aegis-composio-github-readonly', actionId: 'get-repository', principalId: 'owner', connectionId: [...db.connections.keys()][0], resourceId: 'github:repository:octocat/Hello-World', scopes: ['github:repository:read'] },
  ), /tool allowlist/i);

  const extras = createComposioAdapterRegistry({
    db,
    env: vaultEnv,
    fetchImpl: async () => { throw new Error('must not fetch'); },
  });
  await assert.rejects(extras['aegis-composio-github-readonly:get-repository'](
    { owner: 'octocat', repo: 'Hello-World', command: 'delete' },
    { principalId: 'owner', connectionId: [...db.connections.keys()][0], resourceId: 'github:repository:octocat/Hello-World' },
  ), /input/i);

  const noSecret = createComposioAdapterRegistry({
    db,
    env: { ...vaultEnv, COMPOSIO_API_KEY: '' },
    fetchImpl: async () => { throw new Error('must not fetch'); },
  });
  await assert.rejects(noSecret['aegis-composio-github-readonly:get-repository'](
    { owner: 'octocat', repo: 'Hello-World' },
    { capabilityId: 'aegis-composio-github-readonly', actionId: 'get-repository', principalId: 'owner', connectionId: [...db.connections.keys()][0], resourceId: 'github:repository:octocat/Hello-World', scopes: ['github:repository:read'] },
  ), /API key/i);
});


test('runs the private repository read only after Sentinel validates the exact grant and connection', async () => {
  const db = await connectedDb();
  const connectionId = [...db.connections.keys()][0];
  const resourceId = 'github:repository:octocat/Hello-World';
  const now = Date.parse('2026-11-16T10:00:00.000Z');
  const manifest = getCapabilityManifest('aegis-composio-github-readonly');
  const audit = [];
  const adapters = createComposioAdapterRegistry({
    db,
    env: vaultEnv,
    fetchImpl: async (url) => {
      if (url.includes('/toolkits?toolkits=github')) {
        return new Response(JSON.stringify({
          items: [{ slug: 'github', connected_account: { id: connectedAccountId, status: 'ACTIVE' } }],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.endsWith('/tools?limit=100')) {
        return new Response(JSON.stringify({ items: [{ slug: 'GITHUB_GET_A_REPOSITORY' }] }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({
        data: repositoryData(), error: null, log_id: 'log_123',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    },
  });
  const handler = adapters['aegis-composio-github-readonly:get-repository'];
  const connection = {
    id: connectionId,
    principalId: 'owner',
    providerId: 'composio',
    status: 'active',
    scopes: ['composio:github-repository:read'],
  };
  const dependencies = {
    loadGrant: async () => ({
      id: 'grant-composio-1',
      principalId: 'owner',
      capabilityId: manifest.id,
      capabilityVersion: manifest.version,
      resourceId,
      resourceIds: [resourceId],
      scopes: ['github:repository:read'],
      status: 'active',
      expiresAt: new Date(now + 60_000).toISOString(),
    }),
    loadConnection: async () => connection,
    loadApproval: async () => null,
    reserveRateLimit: async () => true,
    recordAudit: async (event) => { audit.push(event); },
    registryLookup: getCapabilityManifest,
    execute: handler,
  };

  const result = await runSentinelInvocation({
    invocationId: 'composio-read-1',
    principalId: 'owner',
    manifest,
    actionId: 'get-repository',
    resourceId,
    inputDigest: 'sha256:' + 'a'.repeat(64),
    input: { owner: 'octocat', repo: 'Hello-World' },
    now,
  }, dependencies);

  assert.equal(result.allowed, true);
  assert.equal(result.reasonCode, 'SUCCESS');
  assert.equal(result.output.repository.fullName, 'octocat/Hello-World');
  assert.deepEqual(audit.map((event) => event.type), [
    'invocation_policy_allowed',
    'invocation_authorized',
    'invocation_succeeded',
  ]);
  assert.ok(audit.every((event) => !('input' in event) && !('secret' in event)));
});

test('Sentinel denies a missing exact-resource grant before the Composio adapter is called', async () => {
  const db = await connectedDb();
  const connectionId = [...db.connections.keys()][0];
  const manifest = getCapabilityManifest('aegis-composio-github-readonly');
  const audit = [];
  let providerCalls = 0;
  const handler = createComposioAdapterRegistry({
    db,
    env: vaultEnv,
    fetchImpl: async () => { providerCalls += 1; throw new Error('must not fetch'); },
  })['aegis-composio-github-readonly:get-repository'];
  const result = await runSentinelInvocation({
    invocationId: 'composio-read-denied',
    principalId: 'owner',
    manifest,
    actionId: 'get-repository',
    resourceId: 'github:repository:octocat/Hello-World',
    inputDigest: 'sha256:' + 'b'.repeat(64),
    input: { owner: 'octocat', repo: 'Hello-World' },
    now: Date.parse('2026-11-16T10:00:00.000Z'),
  }, {
    loadGrant: async () => null,
    loadConnection: async () => ({
      id: connectionId, principalId: 'owner', providerId: 'composio',
      status: 'active', scopes: ['composio:github-repository:read'],
    }),
    loadApproval: async () => null,
    reserveRateLimit: async () => true,
    recordAudit: async (event) => { audit.push(event); },
    registryLookup: getCapabilityManifest,
    execute: handler,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, 'GRANT_REQUIRED');
  assert.equal(providerCalls, 0);
  assert.deepEqual(audit.map((event) => event.type), ['invocation_denied']);
});


test('owner-only Composio setup stores session material in the vault and supports status and local revocation', async () => {
  const db = new MemoryD1();
  const env = {
    ...vaultEnv,
    AEGIS_DB: db,
    AEGIS_PASSWORD: 'test-password-at-least-12',
    AEGIS_SESSION_SECRET: 's'.repeat(64),
  };
  const token = await createSessionToken(env.AEGIS_SESSION_SECRET);
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith('/api/v3.1/tool_router/session')) {
      return new Response(JSON.stringify({ session_id: sessionId }), {
        status: 201, headers: { 'Content-Type': 'application/json' },
      });
    }
    if (String(url).endsWith('/link')) {
      return new Response(JSON.stringify({
        redirect_url: 'https://app.composio.dev/link/lt_abc123',
        connected_account_id: connectedAccountId,
      }), { status: 201, headers: { 'Content-Type': 'application/json' } });
    }
    if (String(url).includes('/toolkits?toolkits=github')) {
      return new Response(JSON.stringify({
        items: [{ slug: 'github', connected_account: { id: connectedAccountId, status: 'ACTIVE' } }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (options.method === 'DELETE') return new Response(null, { status: 204 });
    throw new Error('Unexpected Composio request');
  };

  const request = (method, body) => new Request('https://aegis.example/api/connections/composio', {
    method,
    headers: {
      Cookie: sessionCookie(token),
      Origin: 'https://aegis.example',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  try {
    const created = await createComposioConnection({ request: request('POST', {}), env });
    assert.equal(created.status, 201);
    const createdBody = await created.json();
    assert.equal(createdBody.redirectUrl, 'https://app.composio.dev/link/lt_abc123');
    assert.equal(createdBody.connection.providerId, 'composio');
    assert.equal('secretRef' in createdBody.connection, false);
    assert.equal(JSON.stringify(createdBody).includes(env.COMPOSIO_API_KEY), false);
    assert.equal(JSON.stringify(createdBody).includes(sessionId), false);
    assert.equal(db.secrets.size, 1);
    assert.ok([...db.secrets.values()][0].ciphertext_b64);

    const status = await getComposioConnection({ request: request('GET'), env });
    assert.equal(status.status, 200);
    const statusBody = await status.json();
    assert.equal(statusBody.configured, true);
    assert.equal(statusBody.connected, true);

    const revoked = await revokeComposioConnection({ request: request('DELETE'), env });
    assert.equal(revoked.status, 200);
    const revokedBody = await revoked.json();
    assert.equal(revokedBody.revoked, true);
    assert.equal([...db.connections.values()][0].status, 'revoked');
    assert.equal([...db.secrets.values()][0].ciphertext_b64, null);
    assert.ok(calls.some((call) => call.options.method === 'DELETE'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
