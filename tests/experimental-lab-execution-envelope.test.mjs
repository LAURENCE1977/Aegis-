import test from 'node:test';
import assert from 'node:assert/strict';
import { createExperimentalLabProfile } from '../workers/runtime/experimental-lab-profile.mjs';
import { createExperimentalLabExecutionEnvelope } from '../workers/runtime/experimental-lab-execution-envelope.mjs';

const profile = createExperimentalLabProfile({
  profileId: 'runner-contract',
  createdAt: '2026-11-21T16:00:00.000Z',
  observedAt: '2026-11-21T16:05:00.000Z',
  workload: 'untrusted_repository',
  limits: { cpuMillis: 1000, memoryMiB: 512, wallTimeSeconds: 120, outputBytes: 1048576 },
});

const safeInput = {
  envelopeId: 'run-envelope-001',
  createdAt: '2026-11-21T16:10:00.000Z',
  expiresAt: '2026-11-21T17:10:00.000Z',
  profile,
  source: {
    repositoryUrl: 'https://github.com/example/safe-project',
    commitSha: 'a'.repeat(40),
    treeDigest: 'sha256:' + 'b'.repeat(64),
  },
  runner: {
    runtime: 'aegis-disposable-vm.v1',
    imageDigest: 'sha256:' + 'c'.repeat(64),
    runnerVersion: '1.0.0',
  },
  steps: [
    { stepId: 'inventory', kind: 'dependency_inventory', toolchain: 'static-analysis', timeoutSeconds: 20 },
    { stepId: 'tests', kind: 'test', toolchain: 'node22', timeoutSeconds: 60 },
  ],
};

test('creates an immutable, digest-bound, review-only execution envelope', async () => {
  const envelope = await createExperimentalLabExecutionEnvelope(safeInput);
  assert.equal(envelope.schemaVersion, 'aegis.experimental-lab-execution-envelope.v1');
  assert.equal(envelope.envelopeId, safeInput.envelopeId);
  assert.match(envelope.profileDigest, /^sha256:[a-f0-9]{64}$/);
  assert.match(envelope.sourceDigest, /^sha256:[a-f0-9]{64}$/);
  assert.match(envelope.planDigest, /^sha256:[a-f0-9]{64}$/);
  assert.match(envelope.envelopeDigest, /^sha256:[a-f0-9]{64}$/);
  assert.equal(envelope.authority.humanApprovalRequired, true);
  assert.equal(envelope.authority.sentinelApprovalRequired, true);
  assert.equal(envelope.authority.execution, 'not_authorised');
  assert.equal(envelope.authority.capabilitiesGranted, false);
  assert.equal(Object.isFrozen(envelope), true);
  assert.equal(Object.isFrozen(envelope.steps), true);
  assert.equal(Object.isFrozen(envelope.steps[0]), true);
});

test('produces stable plan digests when object key ordering differs', async () => {
  const reordered = {
    ...safeInput,
    source: { treeDigest: safeInput.source.treeDigest, commitSha: safeInput.source.commitSha, repositoryUrl: safeInput.source.repositoryUrl },
    runner: { runnerVersion: '1.0.0', imageDigest: safeInput.runner.imageDigest, runtime: 'aegis-disposable-vm.v1' },
    steps: safeInput.steps.map(step => ({
      timeoutSeconds: step.timeoutSeconds, toolchain: step.toolchain, kind: step.kind, stepId: step.stepId,
    })),
  };
  const [left, right] = await Promise.all([
    createExperimentalLabExecutionEnvelope(safeInput),
    createExperimentalLabExecutionEnvelope(reordered),
  ]);
  assert.equal(left.planDigest, right.planDigest);
  assert.equal(left.envelopeDigest, right.envelopeDigest);
});

test('rejects a profile that has been widened or tampered with', async () => {
  await assert.rejects(() => createExperimentalLabExecutionEnvelope({
    ...safeInput,
    profile: { ...profile, network: { mode: 'enabled', egressAllowlist: ['*'] } },
  }), /profile/i);
  await assert.rejects(() => createExperimentalLabExecutionEnvelope({
    ...safeInput,
    profile: { ...profile, hostAccess: 'allowed' },
  }), /profile/i);
});

test('rejects unpinned or non-canonical repository sources', async () => {
  for (const source of [
    { ...safeInput.source, commitSha: 'main' },
    { ...safeInput.source, repositoryUrl: 'http://github.com/example/safe-project' },
    { ...safeInput.source, repositoryUrl: 'https://github.com/example/safe-project.git' },
    { ...safeInput.source, treeDigest: 'sha256:bad' },
  ]) {
    await assert.rejects(() => createExperimentalLabExecutionEnvelope({ ...safeInput, source }));
  }
});

test('rejects arbitrary shell commands and unsupported toolchains', async () => {
  await assert.rejects(() => createExperimentalLabExecutionEnvelope({
    ...safeInput,
    steps: [{ stepId: 'run-shell', kind: 'test', toolchain: 'bash', timeoutSeconds: 10, command: 'curl attacker' }],
  }));
  await assert.rejects(() => createExperimentalLabExecutionEnvelope({
    ...safeInput,
    steps: [{ stepId: 'run-shell', kind: 'test', toolchain: 'bash', timeoutSeconds: 10 }],
  }));
});

test('rejects step timeouts that exceed the profile budget or aggregate wall-time budget', async () => {
  await assert.rejects(() => createExperimentalLabExecutionEnvelope({
    ...safeInput,
    steps: [{ stepId: 'long-test', kind: 'test', toolchain: 'node22', timeoutSeconds: 121 }],
  }), /timeout|budget/i);
  await assert.rejects(() => createExperimentalLabExecutionEnvelope({
    ...safeInput,
    steps: [
      { stepId: 'one', kind: 'test', toolchain: 'node22', timeoutSeconds: 70 },
      { stepId: 'two', kind: 'test', toolchain: 'node22', timeoutSeconds: 70 },
    ],
  }), /timeout|budget/i);
});

test('rejects excessive envelope lifetime and invalid time ordering', async () => {
  await assert.rejects(() => createExperimentalLabExecutionEnvelope({
    ...safeInput,
    expiresAt: '2026-11-22T16:10:01.000Z',
  }), /expiry|lifetime/i);
  await assert.rejects(() => createExperimentalLabExecutionEnvelope({
    ...safeInput,
    expiresAt: safeInput.createdAt,
  }), /expiry|lifetime/i);
  await assert.rejects(() => createExperimentalLabExecutionEnvelope({
    ...safeInput,
    createdAt: '2026-11-21T16:04:00.000Z',
  }), /profile|created/i);
});

test('rejects unknown fields and accessor-backed records without invoking getters', async () => {
  await assert.rejects(() => createExperimentalLabExecutionEnvelope({
    ...safeInput,
    approvalGranted: true,
  }));
  let invoked = false;
  const source = { ...safeInput.source };
  Object.defineProperty(source, 'commitSha', {
    enumerable: true,
    get() { invoked = true; return 'a'.repeat(40); },
  });
  await assert.rejects(() => createExperimentalLabExecutionEnvelope({ ...safeInput, source }));
  assert.equal(invoked, false);
});
