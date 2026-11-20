import test from 'node:test';
import assert from 'node:assert/strict';
import { getCapabilityManifest } from '../functions/lib/capability-registry.mjs';
import { runSentinelInvocation } from '../functions/lib/sentinel.mjs';

const now = Date.parse('2026-11-20T12:00:00.000Z');
const manifest = getCapabilityManifest('aegis-github-public-discovery');
const request = {
  invocationId: 'invocation-integration-bridge-1',
  principalId: 'owner',
  manifest,
  actionId: 'discover',
  resourceId: 'github:public:LAURENCE1977/Aegis-',
  inputDigest: 'sha256:0123456789abcdef',
  input: { repository: 'LAURENCE1977/Aegis-' },
  now,
  integrationTool: {
    integrationId: 'composio-github',
    connectionKey: 'github-personal',
    toolSlug: 'GITHUB_GET_REPO',
  },
};

const provider = { id: 'composio', status: 'reviewed', verifiedAt: '2026-11-20T11:00:00.000Z' };
const integration = { id: 'composio-github', providerId: 'composio', status: 'reviewed', schemaVersion: 'v1', schemaHash: 'sha256:' + 'a'.repeat(64) };
const connection = {
  id: 'integration-connection-1',
  principalId: 'owner',
  integrationId: 'composio-github',
  status: 'connected',
  revokedAt: null,
  healthState: 'healthy',
  healthCheckedAt: '2026-11-20T11:30:00.000Z',
  connectionType: 'instant_platform_managed',
  authMode: 'shared_platform_account',
  allowedToolSlugs: ['GITHUB_GET_REPO'],
  scopes: ['github:public-metadata:read'],
};

function harness(overrides = {}) {
  const calls = { execute: 0, audit: [] };
  const dependencies = {
    loadGrant: async () => ({
      status: 'active',
      principalId: 'owner',
      capabilityId: manifest.id,
      capabilityVersion: manifest.version,
      scopes: ['github:public-metadata:read'],
      resourceIds: [request.resourceId],
      expiresAt: '2026-11-20T13:00:00.000Z',
    }),
    loadConnection: async () => null,
    loadApproval: async () => null,
    reserveRateLimit: async () => true,
    recordAudit: async event => { calls.audit.push(event); },
    registryLookup: () => manifest,
    loadIntegrationToolContext: async () => ({ provider, integration, connection }),
    execute: async (_input, context) => {
      calls.execute += 1;
      calls.context = context;
      return { ok: true };
    },
    ...overrides,
  };
  return { calls, dependencies };
}

test('routes an integration-backed action through exact inventory preflight before Sentinel execution', async () => {
  const h = harness();
  const result = await runSentinelInvocation(request, h.dependencies);
  assert.equal(result.allowed, true);
  assert.equal(result.reasonCode, 'SUCCESS');
  assert.equal(h.calls.execute, 1);
  assert.equal(h.calls.context.integrationConnectionId, connection.id);
  assert.equal(h.calls.context.integrationToolSlug, 'GITHUB_GET_REPO');
  assert.equal(h.calls.context.integrationId, integration.id);
});

test('denies an integration tool not present in the exact connection allowlist', async () => {
  const h = harness({
    loadIntegrationToolContext: async () => ({
      provider, integration,
      connection: { ...connection, allowedToolSlugs: ['GITHUB_LIST_REPOS'] },
    }),
  });
  const result = await runSentinelInvocation(request, h.dependencies);
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, 'tool_not_allowlisted');
  assert.equal(h.calls.execute, 0);
  assert.equal(h.calls.audit.at(-1).type, 'invocation_denied');
});

test('denies revoked integration connections even if their status still says connected', async () => {
  const h = harness({
    loadIntegrationToolContext: async () => ({
      provider, integration,
      connection: { ...connection, revokedAt: '2026-11-20T11:45:00.000Z' },
    }),
  });
  const result = await runSentinelInvocation(request, h.dependencies);
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, 'connection_revoked');
  assert.equal(h.calls.execute, 0);
});

test('fails closed when integration inventory cannot be loaded', async () => {
  const h = harness({ loadIntegrationToolContext: async () => null });
  const result = await runSentinelInvocation(request, h.dependencies);
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, 'preflight_metadata_missing');
  assert.equal(h.calls.execute, 0);
});

test('fails closed when an integration-backed invocation has no inventory loader', async () => {
  const h = harness();
  delete h.dependencies.loadIntegrationToolContext;
  const result = await runSentinelInvocation(request, h.dependencies);
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, 'POLICY_CONTEXT_UNAVAILABLE');
  assert.equal(h.calls.execute, 0);
});

test('keeps existing non-integration Sentinel invocations compatible', async () => {
  const h = harness();
  const { integrationTool: _integrationTool, ...legacyRequest } = request;
  const result = await runSentinelInvocation(legacyRequest, h.dependencies);
  assert.equal(result.allowed, true);
  assert.equal(h.calls.execute, 1);
});
