import test from 'node:test';
import assert from 'node:assert/strict';
import { createExperimentalLabProfile } from '../workers/runtime/experimental-lab-profile.mjs';

const safeInput = {
  profileId: 'repo-inspection',
  createdAt: '2026-11-21T16:00:00.000Z',
  observedAt: '2026-11-21T16:05:00.000Z',
  workload: 'untrusted_repository',
  limits: { cpuMillis: 1000, memoryMiB: 512, wallTimeSeconds: 120, outputBytes: 1048576 },
};

test('creates a frozen deny-by-default experimental lab profile', () => {
  const profile = createExperimentalLabProfile(safeInput);
  assert.equal(profile.schemaVersion, 'aegis.experimental-lab-profile.v1');
  assert.equal(profile.profileId, safeInput.profileId);
  assert.equal(profile.trust, 'untrusted');
  assert.equal(profile.network.mode, 'disabled');
  assert.equal(profile.filesystem.root, 'ephemeral');
  assert.equal(profile.filesystem.sourceMount, 'read_only');
  assert.equal(profile.filesystem.output, 'quarantine');
  assert.equal(profile.credentials.mode, 'none');
  assert.equal(profile.hostAccess, 'denied');
  assert.equal(profile.containerSocket, 'denied');
  assert.equal(profile.privileged, false);
  assert.equal(profile.execution, 'not_authorised');
  assert.equal(profile.sentinelApprovalRequired, true);
  assert.equal(Object.isFrozen(profile), true);
  assert.equal(Object.isFrozen(profile.limits), true);
});

test('supports bounded resource limits only within hard ceilings', () => {
  assert.throws(() => createExperimentalLabProfile({
    ...safeInput, limits: { ...safeInput.limits, memoryMiB: 8192 },
  }), /limit|maximum/i);
  assert.throws(() => createExperimentalLabProfile({
    ...safeInput, limits: { ...safeInput.limits, wallTimeSeconds: 3601 },
  }), /limit|maximum/i);
});

test('rejects attempts to enable network, credentials, host mounts or privileged execution', () => {
  for (const override of [
    { network: { mode: 'internet' } },
    { credentials: { mode: 'inherit' } },
    { filesystem: { root: 'host' } },
    { hostAccess: 'allowed' },
    { containerSocket: 'allowed' },
    { privileged: true },
    { execution: 'authorised' },
  ]) {
    assert.throws(() => createExperimentalLabProfile({ ...safeInput, ...override }));
  }
});

test('rejects unknown workload types and malformed profile identifiers', () => {
  assert.throws(() => createExperimentalLabProfile({ ...safeInput, workload: 'arbitrary_shell' }));
  assert.throws(() => createExperimentalLabProfile({ ...safeInput, profileId: '../escape' }));
});

test('rejects future observations and non-canonical timestamps', () => {
  assert.throws(() => createExperimentalLabProfile({
    ...safeInput, observedAt: '2026-11-21T15:59:59.000Z',
  }), /future|observation/i);
  assert.throws(() => createExperimentalLabProfile({
    ...safeInput, createdAt: '2026-11-21',
  }), /timestamp/i);
});

test('rejects extra fields and accessor-backed input without invoking getters', () => {
  assert.throws(() => createExperimentalLabProfile({ ...safeInput, command: 'curl evil' }));
  let invoked = false;
  const hostile = { ...safeInput };
  Object.defineProperty(hostile, 'workload', {
    enumerable: true, get() { invoked = true; return 'untrusted_repository'; },
  });
  assert.throws(() => createExperimentalLabProfile(hostile));
  assert.equal(invoked, false);
});
