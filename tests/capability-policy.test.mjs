import test from 'node:test';
import assert from 'node:assert/strict';
import { getCapabilityManifest } from '../functions/lib/capability-registry.mjs';
import { evaluateCapabilityPolicy } from '../functions/lib/capability-policy.mjs';

const principalId = 'user-laurence';
const resourceId = 'github:public:LAURENCE1977/Aegis-';
const inputDigest = 'sha256:0123456789abcdef';
const future = (ms = 60_000) => new Date(Date.now() + ms).toISOString();

function readManifest() {
  return getCapabilityManifest('aegis-github-public-discovery');
}

function grantFor(manifest = readManifest(), overrides = {}) {
  return {
    status: 'active',
    principalId,
    capabilityId: manifest.id,
    capabilityVersion: manifest.version,
    scopes: ['github:public-metadata:read'],
    resourceIds: [resourceId],
    expiresAt: future(),
    ...overrides,
  };
}

function writeManifest() {
  const manifest = readManifest();
  manifest.actions = [{
    id: 'update',
    capability: 'github.repository.update',
    effect: 'write',
    risk: 'medium',
    approval: 'human-always',
    requiredScopes: ['github:repository:write'],
  }];
  return manifest;
}

function approvalFor(manifest, actionId = 'update', overrides = {}) {
  return {
    status: 'approved',
    principalId,
    capabilityId: manifest.id,
    capabilityVersion: manifest.version,
    actionId,
    resourceId,
    connectionId: null,
    inputDigest,
    expiresAt: future(),
    consumedAt: null,
    ...overrides,
  };
}

test('allows a bounded read only when an active matching grant exists', () => {
  const manifest = readManifest();
  const decision = evaluateCapabilityPolicy({
    manifest, actionId: 'discover', principalId, resourceId, inputDigest,
    grant: grantFor(manifest),
  });
  assert.deepEqual(decision, { allowed: true, reasonCode: 'ALLOW' });
});

test('denies when the manifest is not approved or has been disabled', () => {
  for (const status of ['candidate', 'reviewed', 'disabled']) {
    const manifest = { ...readManifest(), status };
    const decision = evaluateCapabilityPolicy({
      manifest, actionId: 'discover', principalId, resourceId, inputDigest,
      grant: grantFor(manifest),
    });
    assert.equal(decision.allowed, false);
    assert.equal(decision.reasonCode, 'CAPABILITY_NOT_ENABLED');
  }
});

test('denies unknown actions and missing grants', () => {
  const manifest = readManifest();
  assert.equal(evaluateCapabilityPolicy({
    manifest, actionId: 'unknown', principalId, resourceId, inputDigest,
    grant: grantFor(manifest),
  }).reasonCode, 'ACTION_NOT_FOUND');
  assert.equal(evaluateCapabilityPolicy({
    manifest, actionId: 'discover', principalId, resourceId, inputDigest,
  }).reasonCode, 'GRANT_REQUIRED');
});

test('denies a grant for a different principal or capability version', () => {
  const manifest = readManifest();
  assert.equal(evaluateCapabilityPolicy({
    manifest, actionId: 'discover', principalId, resourceId, inputDigest,
    grant: grantFor(manifest, { principalId: 'another-user' }),
  }).reasonCode, 'PRINCIPAL_MISMATCH');
  assert.equal(evaluateCapabilityPolicy({
    manifest, actionId: 'discover', principalId, resourceId, inputDigest,
    grant: grantFor(manifest, { capabilityVersion: '9.9.9' }),
  }).reasonCode, 'GRANT_MISMATCH');
});

test('denies expired or revoked grants', () => {
  const manifest = readManifest();
  assert.equal(evaluateCapabilityPolicy({
    manifest, actionId: 'discover', principalId, resourceId, inputDigest,
    grant: grantFor(manifest, { expiresAt: new Date(Date.now() - 1000).toISOString() }),
  }).reasonCode, 'GRANT_EXPIRED');
  assert.equal(evaluateCapabilityPolicy({
    manifest, actionId: 'discover', principalId, resourceId, inputDigest,
    grant: grantFor(manifest, { revokedAt: new Date().toISOString() }),
  }).reasonCode, 'GRANT_REVOKED');
});

test('denies missing scopes and resource widening', () => {
  const manifest = readManifest();
  assert.equal(evaluateCapabilityPolicy({
    manifest, actionId: 'discover', principalId, resourceId, inputDigest,
    grant: grantFor(manifest, { scopes: [] }),
  }).reasonCode, 'SCOPE_MISSING');
  assert.equal(evaluateCapabilityPolicy({
    manifest, actionId: 'discover', principalId, resourceId, inputDigest,
    grant: grantFor(manifest, { resourceIds: ['another-resource'] }),
  }).reasonCode, 'RESOURCE_MISMATCH');
  assert.equal(evaluateCapabilityPolicy({
    manifest, actionId: 'discover', principalId, resourceId, inputDigest,
    grant: grantFor(manifest, { resourceIds: ['*'] }),
  }).reasonCode, 'RESOURCE_MISMATCH');
});

test('write actions require an exact, unexpired, unused approval', () => {
  const manifest = writeManifest();
  const grant = grantFor(manifest, { scopes: ['github:repository:write'] });
  const input = { manifest, actionId: 'update', principalId, resourceId, inputDigest, grant };
  assert.equal(evaluateCapabilityPolicy(input).reasonCode, 'APPROVAL_REQUIRED');
  assert.deepEqual(evaluateCapabilityPolicy({
    ...input, approval: approvalFor(manifest),
  }), { allowed: true, reasonCode: 'ALLOW' });
});

test('approval cannot be reused for a changed payload, resource, action or version', () => {
  const manifest = writeManifest();
  const grant = grantFor(manifest, { scopes: ['github:repository:write'] });
  const approval = approvalFor(manifest);
  const input = { manifest, actionId: 'update', principalId, resourceId, inputDigest, grant, approval };
  assert.equal(evaluateCapabilityPolicy({
    ...input, inputDigest: 'sha256:changed',
  }).reasonCode, 'APPROVAL_MISMATCH');
  assert.equal(evaluateCapabilityPolicy({
    ...input, resourceId: 'github:another/repo',
  }).reasonCode, 'APPROVAL_MISMATCH');
  assert.equal(evaluateCapabilityPolicy({
    ...input, approval: { ...approval, actionId: 'delete' },
  }).reasonCode, 'APPROVAL_MISMATCH');
  assert.equal(evaluateCapabilityPolicy({
    ...input, approval: { ...approval, capabilityVersion: '2.0.0' },
  }).reasonCode, 'APPROVAL_MISMATCH');
});

test('expired, denied or consumed approvals are rejected', () => {
  const manifest = writeManifest();
  const grant = grantFor(manifest, { scopes: ['github:repository:write'] });
  const input = { manifest, actionId: 'update', principalId, resourceId, inputDigest, grant };
  assert.equal(evaluateCapabilityPolicy({
    ...input, approval: approvalFor(manifest, 'update', { expiresAt: new Date(Date.now() - 1000).toISOString() }),
  }).reasonCode, 'APPROVAL_EXPIRED');
  assert.equal(evaluateCapabilityPolicy({
    ...input, approval: approvalFor(manifest, 'update', { status: 'denied' }),
  }).reasonCode, 'APPROVAL_INVALID');
  assert.equal(evaluateCapabilityPolicy({
    ...input, approval: approvalFor(manifest, 'update', { consumedAt: new Date().toISOString() }),
  }).reasonCode, 'APPROVAL_REPLAYED');
});

test('external authentication requires an active connection owned by the principal', () => {
  const manifest = { ...readManifest(), auth: { mode: 'oauth2' }, provider: { id: 'github', kind: 'external' } };
  const grant = grantFor(manifest);
  const input = { manifest, actionId: 'discover', principalId, resourceId, inputDigest, grant };
  assert.equal(evaluateCapabilityPolicy(input).reasonCode, 'CONNECTION_REQUIRED');
  const connection = { id: 'conn-1', status: 'active', ownerId: principalId, providerId: 'github' };
  assert.equal(evaluateCapabilityPolicy({ ...input, connection }).allowed, true);
  assert.equal(evaluateCapabilityPolicy({
    ...input, connection: { ...connection, ownerId: 'other-user' },
  }).reasonCode, 'CONNECTION_INVALID');
});

test('denies exhausted call and spend budgets', () => {
  const manifest = readManifest();
  const input = {
    manifest, actionId: 'discover', principalId, resourceId, inputDigest,
    grant: grantFor(manifest),
  };
  assert.equal(evaluateCapabilityPolicy({
    ...input, budget: { remainingCalls: 0, remainingSpend: 10, estimatedCost: 1 },
  }).reasonCode, 'BUDGET_EXHAUSTED');
  assert.equal(evaluateCapabilityPolicy({
    ...input, budget: { remainingCalls: 1, remainingSpend: 0.1, estimatedCost: 1 },
  }).reasonCode, 'BUDGET_EXHAUSTED');
});

test('invalid manifests fail closed without throwing', () => {
  const decision = evaluateCapabilityPolicy({
    manifest: { id: 'broken' }, actionId: 'discover', principalId, resourceId, inputDigest,
    grant: {},
  });
  assert.deepEqual(decision, { allowed: false, reasonCode: 'MANIFEST_INVALID' });
});
