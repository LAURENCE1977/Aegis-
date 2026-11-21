import test from 'node:test';
import assert from 'node:assert/strict';
import { createExperimentalLabVmProviderContract } from '../workers/runtime/experimental-lab-vm-provider-contract.mjs';

const safeInput = {
  providerId: 'firecracker-local',
  providerVersion: '1.0.0',
  runtime: 'aegis-disposable-vm.v1',
  operations: ['create', 'inspect', 'cancel', 'destroy', 'verify_destroyed'],
  capabilities: {
    disposableInstances: true,
    pinnedImages: true,
    networkIsolation: true,
    cpuQuota: true,
    memoryQuota: true,
    pidQuota: true,
    diskQuota: true,
    outputQuota: true,
    wallTimeQuota: true,
    readOnlySourceMount: true,
    quarantinedOutput: true,
    credentialIsolation: true,
    nonRootGuest: true,
    verifiedTeardown: true,
  },
  resourceCeilings: {
    cpuMillis: 4000,
    memoryMiB: 4096,
    wallTimeSeconds: 3600,
    outputBytes: 10485760,
  },
};

test('creates a frozen provider contract that remains unqualified and unauthorised', () => {
  const contract = createExperimentalLabVmProviderContract(safeInput);
  assert.equal(contract.schemaVersion, 'aegis.experimental-lab-vm-provider-contract.v1');
  assert.equal(contract.providerId, safeInput.providerId);
  assert.equal(contract.runtime, safeInput.runtime);
  assert.equal(contract.qualification, 'declared_unverified');
  assert.equal(contract.execution, 'not_authorised');
  assert.equal(contract.humanApprovalRequired, true);
  assert.equal(contract.sentinelApprovalRequired, true);
  assert.equal(Object.isFrozen(contract), true);
  assert.equal(Object.isFrozen(contract.capabilities), true);
  assert.equal(Object.isFrozen(contract.operations), true);
  assert.equal(Object.isFrozen(contract.resourceCeilings), true);
});

test('normalises operation order while requiring the complete lifecycle surface', () => {
  const reversed = { ...safeInput, operations: [...safeInput.operations].reverse() };
  const contract = createExperimentalLabVmProviderContract(reversed);
  assert.deepEqual(contract.operations, ['cancel', 'create', 'destroy', 'inspect', 'verify_destroyed']);
  for (const missing of safeInput.operations) {
    assert.throws(() => createExperimentalLabVmProviderContract({
      ...safeInput,
      operations: safeInput.operations.filter(operation => operation !== missing),
    }), /operation|lifecycle/i);
  }
});

test('rejects providers that do not declare every required isolation control', () => {
  for (const capability of Object.keys(safeInput.capabilities)) {
    assert.throws(() => createExperimentalLabVmProviderContract({
      ...safeInput,
      capabilities: { ...safeInput.capabilities, [capability]: false },
    }), /capabilit|isolation/i);
  }
});

test('rejects resource ceilings outside the experimental lab hard limits', () => {
  for (const [name, value] of Object.entries({
    cpuMillis: 4001,
    memoryMiB: 4097,
    wallTimeSeconds: 3601,
    outputBytes: 10485761,
  })) {
    assert.throws(() => createExperimentalLabVmProviderContract({
      ...safeInput,
      resourceCeilings: { ...safeInput.resourceCeilings, [name]: value },
    }), /limit|ceiling/i);
  }
});

test('rejects unsupported runtime, malformed identity and unknown fields', () => {
  assert.throws(() => createExperimentalLabVmProviderContract({ ...safeInput, runtime: 'docker' }));
  assert.throws(() => createExperimentalLabVmProviderContract({ ...safeInput, providerId: '../host' }));
  assert.throws(() => createExperimentalLabVmProviderContract({ ...safeInput, trusted: true }));
});

test('rejects accessor-backed declarations without invoking getters', () => {
  let invoked = false;
  const capabilities = { ...safeInput.capabilities };
  Object.defineProperty(capabilities, 'networkIsolation', {
    enumerable: true,
    get() { invoked = true; return true; },
  });
  assert.throws(() => createExperimentalLabVmProviderContract({ ...safeInput, capabilities }));
  assert.equal(invoked, false);
});
