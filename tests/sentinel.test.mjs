import test from 'node:test';
import assert from 'node:assert/strict';
import { getCapabilityManifest } from '../functions/lib/capability-registry.mjs';
import { runSentinelInvocation } from '../functions/lib/sentinel.mjs';

const manifest = getCapabilityManifest('aegis-github-public-discovery');
const principalId = 'owner';
const resourceId = 'github:public:LAURENCE1977/Aegis-';
const inputDigest = 'sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const grant = {
  status: 'active',
  principalId,
  capabilityId: manifest.id,
  capabilityVersion: manifest.version,
  scopes: ['github:public-metadata:read'],
  resourceIds: [resourceId],
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
};

function harness(overrides = {}) {
  const events = [];
  const calls = { execute: 0, consume: 0 };
  return {
    events,
    calls,
    dependencies: {
      registryLookup: () => manifest,
      loadGrant: async () => grant,
      loadConnection: async () => null,
      loadApproval: async () => null,
      consumeApproval: async () => { calls.consume += 1; return null; },
      recordAudit: async (event) => { events.push(event); },
      execute: async (input, context) => {
        calls.execute += 1;
        return { repository: 'LAURENCE1977/Aegis-', contextId: context.invocationId };
      },
      ...overrides,
    },
  };
}

const request = {
  invocationId: 'invocation-001',
  manifest,
  actionId: 'discover',
  principalId,
  resourceId,
  inputDigest,
  input: { repository: 'LAURENCE1977/Aegis-' },
  now: Date.now(),
};

test('denies by default when the grant loader is unavailable and never executes', async () => {
  const h = harness({ loadGrant: undefined });
  const result = await runSentinelInvocation(request, h.dependencies);
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, 'POLICY_CONTEXT_UNAVAILABLE');
  assert.equal(h.calls.execute, 0);
});

test('denies a policy failure and records the denial before returning', async () => {
  const h = harness({ loadGrant: async () => null });
  const result = await runSentinelInvocation(request, h.dependencies);
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, 'GRANT_REQUIRED');
  assert.equal(h.calls.execute, 0);
  assert.equal(h.events[0].type, 'invocation_denied');
});

test('does not execute if the pre-execution audit record cannot be persisted', async () => {
  const h = harness({ recordAudit: async () => { throw new Error('storage unavailable'); } });
  const result = await runSentinelInvocation(request, h.dependencies);
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, 'AUDIT_UNAVAILABLE');
  assert.equal(h.calls.execute, 0);
});

test('executes only after policy approval and a durable pre-execution audit event', async () => {
  const h = harness();
  const result = await runSentinelInvocation(request, h.dependencies);
  assert.equal(result.allowed, true);
  assert.deepEqual(result.output, {
    repository: 'LAURENCE1977/Aegis-',
    contextId: 'invocation-001',
  });
  assert.equal(h.calls.execute, 1);
  assert.deepEqual(h.events.map((event) => event.type), [
    'invocation_authorized',
    'invocation_succeeded',
  ]);
});

test('records a redacted failure outcome when an adapter throws', async () => {
  const h = harness({ execute: async () => { throw new Error('provider token=super-secret'); } });
  const result = await runSentinelInvocation(request, h.dependencies);
  assert.equal(result.allowed, true);
  assert.equal(result.reasonCode, 'EXECUTION_FAILED');
  assert.equal(result.error.message.includes('super-secret'), false);
  assert.equal(h.events.at(-1).type, 'invocation_failed');
  assert.equal(JSON.stringify(h.events).includes('super-secret'), false);
});

test('requires atomic approval consumption before any human-gated action executes', async () => {
  const writeManifest = {
    ...manifest,
    actions: [{
      id: 'update',
      capability: 'github.repository-update',
      effect: 'write',
      risk: 'medium',
      approval: 'human-always',
      requiredScopes: ['github:repository:write'],
    }],
  };
  const writeRequest = {
    ...request,
    manifest: writeManifest,
    actionId: 'update',
    inputDigest,
  };
  const writeGrant = {
    ...grant,
    scopes: ['github:repository:write'],
  };
  const h = harness({
    registryLookup: () => writeManifest,
    loadGrant: async () => writeGrant,
    loadApproval: async () => ({ id: 'approval-1' }),
    consumeApproval: async () => { h.calls.consume += 1; return null; },
  });
  const result = await runSentinelInvocation(writeRequest, h.dependencies);
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, 'APPROVAL_CONSUMPTION_FAILED');
  assert.equal(h.calls.execute, 0);
  assert.equal(h.calls.consume, 1);
});

test('never invokes an adapter when the exact approval cannot be atomically consumed', async () => {
  const writeManifest = {
    ...manifest,
    actions: [{
      id: 'update',
      capability: 'github.repository-update',
      effect: 'write',
      risk: 'medium',
      approval: 'human-always',
      requiredScopes: ['github:repository:write'],
    }],
  };
  const approval = {
    id: 'approval-1', status: 'approved', principalId,
    capabilityId: writeManifest.id, capabilityVersion: writeManifest.version,
    actionId: 'update', resourceId, connectionId: null, inputDigest,
    expiresAt: new Date(Date.now() + 60_000).toISOString(), consumedAt: null,
  };
  const h = harness({
    registryLookup: () => writeManifest,
    loadGrant: async () => ({ ...grant, scopes: ['github:repository:write'] }),
    loadApproval: async () => approval,
    consumeApproval: async () => { h.calls.consume += 1; return { ...approval, status: 'consumed' }; },
  });
  const result = await runSentinelInvocation({ ...request, manifest: writeManifest, actionId: 'update' }, h.dependencies);
  assert.equal(result.allowed, true);
  assert.equal(h.calls.consume, 1);
  assert.equal(h.calls.execute, 1);
});
