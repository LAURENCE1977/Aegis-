import test from 'node:test';
import assert from 'node:assert/strict';
import { getCapabilityManifest } from '../functions/lib/capability-registry.mjs';
import { runAgentCapabilityRequest } from '../workers/runtime/agent-capability-bridge.mjs';

const manifest = getCapabilityManifest('aegis-github-public-discovery');
const resourceId = 'github:public:LAURENCE1977/Aegis-';
const principalId = 'owner';
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
  const calls = { execute: 0 };
  return {
    events,
    calls,
    dependencies: {
      registryLookup: getCapabilityManifest,
      loadGrant: async () => grant,
      loadConnection: async () => null,
      loadApproval: async () => null,
      recordAudit: async (event) => { events.push(event); },
      consumeApproval: async () => null,
      execute: async (input, context) => {
        calls.execute += 1;
        return { accepted: true, invocationId: context.invocationId, input };
      },
      ...overrides,
    },
  };
}

test('uses the trusted principal context and server registry, never caller-supplied authority', async () => {
  const h = harness();
  const result = await runAgentCapabilityRequest({
    capabilityId: manifest.id,
    actionId: 'discover',
    resourceId,
    input: { repository: 'LAURENCE1977/Aegis-' },
  }, { principalId }, h.dependencies);
  assert.equal(result.allowed, true);
  assert.equal(h.calls.execute, 1);
  assert.equal(result.output.accepted, true);
  assert.equal(result.output.input.repository, 'LAURENCE1977/Aegis-');
});

test('rejects caller-supplied manifests, principals, adapters and unknown request fields', async () => {
  const h = harness();
  const result = await runAgentCapabilityRequest({
    capabilityId: manifest.id,
    actionId: 'discover',
    resourceId,
    input: {},
    manifest,
    principalId: 'attacker',
    execute: async () => 'bypass',
  }, { principalId }, h.dependencies);
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, 'INVALID_AGENT_CAPABILITY_REQUEST');
  assert.equal(h.calls.execute, 0);
});

test('fails closed when trusted Sentinel dependencies are missing', async () => {
  const result = await runAgentCapabilityRequest({
    capabilityId: manifest.id,
    actionId: 'discover',
    resourceId,
    input: {},
  }, { principalId }, {});
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, 'POLICY_CONTEXT_UNAVAILABLE');
});

test('does not invoke an adapter for unknown capabilities or actions', async () => {
  const h = harness();
  const unknown = await runAgentCapabilityRequest({
    capabilityId: 'unregistered-capability',
    actionId: 'discover',
    resourceId,
    input: {},
  }, { principalId }, h.dependencies);
  assert.equal(unknown.allowed, false);
  assert.equal(unknown.reasonCode, 'CAPABILITY_NOT_REGISTERED');
  const action = await runAgentCapabilityRequest({
    capabilityId: manifest.id,
    actionId: 'delete',
    resourceId,
    input: {},
  }, { principalId }, h.dependencies);
  assert.equal(action.allowed, false);
  assert.equal(action.reasonCode, 'ACTION_NOT_FOUND');
  assert.equal(h.calls.execute, 0);
});

test('canonical input digest is stable across object key order and audit excludes raw payload', async () => {
  const a = harness();
  const b = harness();
  const [first, second] = await Promise.all([
    runAgentCapabilityRequest({
      capabilityId: manifest.id, actionId: 'discover', resourceId,
      input: { repository: 'LAURENCE1977/Aegis-', include: ['issues', 'pulls'], privateMarker: 'PRIVATE_PAYLOAD_MARKER' },
    }, { principalId }, a.dependencies),
    runAgentCapabilityRequest({
      capabilityId: manifest.id, actionId: 'discover', resourceId,
      input: { privateMarker: 'PRIVATE_PAYLOAD_MARKER', include: ['issues', 'pulls'], repository: 'LAURENCE1977/Aegis-' },
    }, { principalId }, b.dependencies),
  ]);
  assert.equal(first.allowed, true, first.reasonCode);
  assert.equal(second.allowed, true, second.reasonCode);
  assert.equal(a.events[0].inputDigest, b.events[0].inputDigest);
  assert.equal(JSON.stringify(a.events).includes('PRIVATE_PAYLOAD_MARKER'), false);
});

test('rejects oversized and non-JSON input before Sentinel or adapter execution', async () => {
  const h = harness();
  const oversized = await runAgentCapabilityRequest({
    capabilityId: manifest.id, actionId: 'discover', resourceId,
    input: { data: 'x'.repeat(manifest.limits.maxRequestBytes + 1) },
  }, { principalId }, h.dependencies);
  assert.equal(oversized.allowed, false);
  assert.equal(oversized.reasonCode, 'INPUT_TOO_LARGE');
  const invalid = await runAgentCapabilityRequest({
    capabilityId: manifest.id, actionId: 'discover', resourceId,
    input: { nested: { value: Number.NaN } },
  }, { principalId }, h.dependencies);
  assert.equal(invalid.allowed, false);
  assert.equal(invalid.reasonCode, 'INPUT_NOT_JSON_SAFE');
  assert.equal(h.calls.execute, 0);
});
