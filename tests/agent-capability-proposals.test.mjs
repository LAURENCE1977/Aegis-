import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgentCapabilityProposal } from '../workers/runtime/agent-capability-proposals.mjs';

const runId = '123e4567-e89b-42d3-a456-426614174000';
const principalId = 'owner';

test('creates a non-executable proposal from the trusted registry and owner context', async () => {
  const proposal = await createAgentCapabilityProposal({
    capabilityId: 'aegis-github-public-discovery',
    actionId: 'discover',
    resourceId: 'github:public:LAURENCE1977/Aegis-',
    input: { sourceUrl: 'https://github.com/LAURENCE1977/Aegis-' },
  }, { runId, principalId });

  assert.equal(proposal.runId, runId);
  assert.equal(proposal.principalId, principalId);
  assert.equal(proposal.capabilityId, 'aegis-github-public-discovery');
  assert.equal(proposal.capabilityVersion, '0.1.0');
  assert.equal(proposal.actionId, 'discover');
  assert.deepEqual(proposal.requiredScopes, ['github:public-metadata:read']);
  assert.equal(proposal.effect, 'read');
  assert.equal(proposal.risk, 'low');
  assert.equal(proposal.approval, 'none');
  assert.equal(proposal.status, 'proposed');
  assert.equal(proposal.execution, 'disabled');
  assert.match(proposal.inputDigest, /^sha256:[a-f0-9]{64}$/);
  assert.equal('input' in proposal, false);
  assert.equal('output' in proposal, false);
  assert.equal('adapter' in proposal, false);
});

test('rejects caller-supplied authority, manifest and execution fields', async () => {
  await assert.rejects(() => createAgentCapabilityProposal({
    capabilityId: 'aegis-github-public-discovery',
    actionId: 'discover',
    resourceId: 'github:public:LAURENCE1977/Aegis-',
    input: { sourceUrl: 'https://github.com/LAURENCE1977/Aegis-' },
    principalId: 'attacker',
    manifest: {},
    execute: true,
  }, { runId, principalId }), /Invalid agent capability proposal/);
});

test('rejects unknown, disabled or unregistered capabilities and actions', async () => {
  await assert.rejects(() => createAgentCapabilityProposal({
    capabilityId: 'unknown-capability',
    actionId: 'discover',
    resourceId: 'github:public:LAURENCE1977/Aegis-',
    input: {},
  }, { runId, principalId }), /not approved/);

  await assert.rejects(() => createAgentCapabilityProposal({
    capabilityId: 'aegis-github-public-discovery',
    actionId: 'delete',
    resourceId: 'github:public:LAURENCE1977/Aegis-',
    input: {},
  }, { runId, principalId }), /not approved/);
});

test('rejects wildcard, traversal and malformed resource identifiers', async () => {
  for (const resourceId of ['*', 'github:public:*', 'github:public:../private', 'bad resource']) {
    await assert.rejects(() => createAgentCapabilityProposal({
      capabilityId: 'aegis-github-public-discovery',
      actionId: 'discover',
      resourceId,
      input: {},
    }, { runId, principalId }), /Invalid agent capability proposal/);
  }
});

test('rejects unsafe, cyclic and oversized input before producing a proposal', async () => {
  const cyclic = {};
  cyclic.self = cyclic;
  for (const input of [
    { marker: Number.NaN },
    cyclic,
    { sourceUrl: 'x'.repeat(5000) },
  ]) {
    await assert.rejects(() => createAgentCapabilityProposal({
      capabilityId: 'aegis-github-public-discovery',
      actionId: 'discover',
      resourceId: 'github:public:LAURENCE1977/Aegis-',
      input,
    }, { runId, principalId }), /Invalid proposal input/);
  }
});

test('requires trusted persisted run and principal context', async () => {
  const request = {
    capabilityId: 'aegis-github-public-discovery',
    actionId: 'discover',
    resourceId: 'github:public:LAURENCE1977/Aegis-',
    input: {},
  };
  await assert.rejects(() => createAgentCapabilityProposal(request, { principalId }), /Invalid trusted context/);
  await assert.rejects(() => createAgentCapabilityProposal(request, { runId, principalId: '' }), /Invalid trusted context/);
});
