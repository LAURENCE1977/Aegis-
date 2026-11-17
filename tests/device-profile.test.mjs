import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDeviceProfile, createDeviceProfile } from '../functions/lib/device-profile.mjs';

const now = '2026-11-17T12:00:00.000Z';
const valid = {
  schemaVersion: 1,
  deviceId: '7f2e8d0a-5a6b-4f2c-9b3e-1d4c6a8f0b2e',
  platform: 'web',
  deviceClass: 'desktop',
  observedAt: now,
  observationMode: 'read-only',
  system: {
    osFamily: { status: 'observed', value: 'ChromeOS', source: 'navigator.userAgentData', observedAt: now, confidence: 'high' },
    osVersion: { status: 'unsupported', value: null, source: 'browser-api', observedAt: now, confidence: 'none' },
    architecture: { status: 'observed', value: 'arm64', source: 'navigator.userAgentData', observedAt: now, confidence: 'high' },
    logicalProcessors: { status: 'observed', value: 8, source: 'navigator.hardwareConcurrency', observedAt: now, confidence: 'medium' },
    memoryBytes: { status: 'not-permitted', value: null, source: 'browser-api', observedAt: now, confidence: 'none' },
    storageBytes: { status: 'observed', value: 100000000000, source: 'storage-estimate', observedAt: now, confidence: 'medium' },
    storageFreeBytes: { status: 'observed', value: 45000000000, source: 'storage-estimate', observedAt: now, confidence: 'medium' },
    gpuAcceleration: { status: 'observed', value: true, source: 'webgl-capability-check', observedAt: now, confidence: 'medium' },
  },
  aegis: { version: '0.1.0', activeModules: ['adaptive-guardian'], resourceBudget: { maxBackgroundTasks: 2, maxConcurrency: 1 } },
  permissions: ['device-profile:read'],
};

test('accepts a minimal, read-only, provenance-labelled device profile', () => {
  assert.equal(validateDeviceProfile(valid), true);
});

test('does not treat unavailable, unsupported or denied observations as healthy values', () => {
  for (const status of ['unsupported', 'not-permitted', 'not-available', 'stale']) {
    const profile = structuredClone(valid);
    profile.system.memoryBytes = { status, value: null, source: 'browser-api', observedAt: now, confidence: 'none' };
    assert.equal(validateDeviceProfile(profile), true);
  }
  assert.throws(() => validateDeviceProfile({
    ...valid,
    system: { ...valid.system, memoryBytes: { status: 'unsupported', value: 16384, source: 'browser-api', observedAt: now, confidence: 'high' } },
  }));
});

test('rejects hardware-derived identifiers, personal inventory and unexpected fields', () => {
  assert.throws(() => validateDeviceProfile({ ...valid, serialNumber: 'device-serial' }));
  assert.throws(() => validateDeviceProfile({ ...valid, installedApplications: ['private-app-list'] }));
  assert.throws(() => validateDeviceProfile({ ...valid, deviceId: 'CPU-ARM64-MODEL-X' }));
});

test('rejects impossible resource values and storage free space greater than capacity', () => {
  assert.throws(() => validateDeviceProfile({
    ...valid, system: { ...valid.system, logicalProcessors: { ...valid.system.logicalProcessors, value: 0 } },
  }));
  assert.throws(() => validateDeviceProfile({
    ...valid, system: { ...valid.system, storageFreeBytes: { ...valid.system.storageFreeBytes, value: 200000000000 } },
  }));
});

test('creates profiles with a random revocable identifier and never grants host mutation authority', () => {
  const profile = createDeviceProfile({ platform: 'web', deviceClass: 'desktop', observedAt: now, system: valid.system, aegis: valid.aegis, permissions: valid.permissions });
  assert.match(profile.deviceId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.equal(profile.observationMode, 'read-only');
  assert.equal(validateDeviceProfile(profile), true);
});
