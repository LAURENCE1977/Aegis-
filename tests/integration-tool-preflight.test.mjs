import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateIntegrationToolPreflight } from '../functions/lib/integration-tool-preflight.mjs';

const now = Date.parse('2026-11-20T12:00:00.000Z');
const provider = { id: 'composio', status: 'reviewed' };
const integration = { id: 'composio-github', providerId: 'composio', status: 'reviewed' };
const connection = {
  id: 'connection-github-personal',
  principalId: 'owner',
  integrationId: 'composio-github',
  status: 'connected',
  healthState: 'healthy',
  healthCheckedAt: '2026-11-20T11:30:00.000Z',
  connectionType: 'instant_platform_managed',
  authMode: 'shared_platform_account',
  allowedToolSlugs: ['GITHUB_GET_REPO'],
  scopes: ['github:repository-metadata:read'],
};

function evaluate(overrides = {}) {
  return evaluateIntegrationToolPreflight({
    provider,
    integration,
    connection,
    principalId: 'owner',
    toolSlug: 'GITHUB_GET_REPO',
    requiredScopes: ['github:repository-metadata:read'],
    now,
    ...overrides,
  });
}

test('permits only a reviewed, healthy, fresh, exact allowed tool as eligible for Sentinel', () => {
  assert.deepEqual(evaluate(), { eligible: true, reason: 'eligible_for_sentinel_review' });
});

test('does not treat eligibility as a grant or approval', () => {
  const result = evaluate();
  assert.equal('granted' in result, false);
  assert.equal('approved' in result, false);
  assert.equal('execute' in result, false);
});

test('rejects a tool whose schema is discoverable but whose exact slug is not allowlisted', () => {
  assert.deepEqual(evaluate({ toolSlug: 'GITHUB_DELETE_REPOSITORY' }), {
    eligible: false, reason: 'tool_not_allowlisted',
  });
});

test('rejects stale, missing, future or non-healthy connection evidence', () => {
  assert.equal(evaluate({ connection: { ...connection, healthCheckedAt: null } }).eligible, false);
  assert.equal(evaluate({ connection: { ...connection, healthCheckedAt: '2026-11-19T11:00:00.000Z' } }).reason, 'health_evidence_stale');
  assert.equal(evaluate({ connection: { ...connection, healthCheckedAt: '2026-11-20T12:02:00.000Z' } }).reason, 'health_evidence_invalid');
  assert.equal(evaluate({ connection: { ...connection, healthState: 'degraded' } }).reason, 'connection_not_healthy');
});

test('rejects mismatched principal, integration or provider identities', () => {
  assert.equal(evaluate({ principalId: 'other-owner' }).reason, 'connection_principal_mismatch');
  assert.equal(evaluate({ integration: { ...integration, id: 'other-integration' } }).reason, 'connection_integration_mismatch');
  assert.equal(evaluate({ integration: { ...integration, providerId: 'other-provider' } }).reason, 'provider_integration_mismatch');
});

test('requires every requested scope to be present exactly', () => {
  assert.equal(evaluate({ requiredScopes: ['github:repository-metadata:read', 'github:issues:write'] }).reason, 'required_scope_missing');
});

test('rejects unreviewed definitions, disconnected connections and unknown auth modes', () => {
  assert.equal(evaluate({ provider: { ...provider, status: 'discovered' } }).reason, 'provider_not_reviewed');
  assert.equal(evaluate({ integration: { ...integration, status: 'discovered' } }).reason, 'integration_not_reviewed');
  assert.equal(evaluate({ connection: { ...connection, status: 'connected_unverified' } }).reason, 'connection_not_connected');
  assert.equal(evaluate({ connection: { ...connection, authMode: 'unknown' } }).reason, 'connection_auth_unknown');
});

test('fails closed for wildcard, malformed and duplicate tool or scope metadata', () => {
  assert.equal(evaluate({ connection: { ...connection, allowedToolSlugs: ['*'] } }).reason, 'connection_allowlist_invalid');
  assert.equal(evaluate({ connection: { ...connection, allowedToolSlugs: ['GITHUB_GET_REPO', 'GITHUB_GET_REPO'] } }).reason, 'connection_allowlist_invalid');
  assert.equal(evaluate({ requiredScopes: ['*'] }).reason, 'required_scopes_invalid');
});

test('rejects revoked, disabled and expired health evidence', () => {
  assert.equal(evaluate({ connection: { ...connection, status: 'revoked' } }).reason, 'connection_not_connected');
  assert.equal(evaluate({ connection: { ...connection, status: 'disabled' } }).reason, 'connection_not_connected');
  assert.equal(evaluate({ connection: { ...connection, healthCheckedAt: '2026-11-19T10:00:00.000Z' } }).reason, 'health_evidence_stale');
});
