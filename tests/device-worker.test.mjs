import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEVICE_CAPABILITIES,
  createDeviceToken,
  hashDeviceToken,
  validateDeviceHeartbeat,
  validateDeviceRegistration,
} from '../workers/runtime/devices.mjs';

test('accepts only a bounded Android or Chromebook registration with explicit capabilities', () => {
  const registration = validateDeviceRegistration({
    platform: 'android',
    displayName: 'Laurence phone',
    capabilities: ['device.status.read', 'aegis.jobs.observe'],
  });
  assert.deepEqual(registration, {
    platform: 'android',
    displayName: 'Laurence phone',
    capabilities: ['device.status.read', 'aegis.jobs.observe'],
  });
  assert.deepEqual(DEVICE_CAPABILITIES, [
    'device.status.read',
    'aegis.jobs.observe',
    'aegis.approvals.review',
  ]);
});

test('rejects unknown platforms, unapproved capabilities and extra registration fields', () => {
  assert.throws(() => validateDeviceRegistration({
    platform: 'linux',
    displayName: 'Desktop',
    capabilities: ['device.status.read'],
  }), /platform/i);
  assert.throws(() => validateDeviceRegistration({
    platform: 'android',
    displayName: 'Phone',
    capabilities: ['shell.exec'],
  }), /capabilit/i);
  assert.throws(() => validateDeviceRegistration({
    platform: 'android',
    displayName: 'Phone',
    capabilities: ['device.status.read'],
    admin: true,
  }), /unexpected/i);
});

test('rejects malformed names and duplicate or empty capability lists', () => {
  assert.throws(() => validateDeviceRegistration({
    platform: 'android',
    displayName: '   ',
    capabilities: ['device.status.read'],
  }), /name/i);
  assert.throws(() => validateDeviceRegistration({
    platform: 'android',
    displayName: 'Phone',
    capabilities: [],
  }), /capabilit/i);
  assert.throws(() => validateDeviceRegistration({
    platform: 'android',
    displayName: 'Phone',
    capabilities: ['device.status.read', 'device.status.read'],
  }), /duplicate/i);
});

test('accepts a minimal heartbeat and rejects attempts to smuggle commands or identity changes', () => {
  assert.deepEqual(validateDeviceHeartbeat({ appVersion: '0.1.0', connectivity: 'online' }), {
    appVersion: '0.1.0',
    connectivity: 'online',
  });
  assert.throws(() => validateDeviceHeartbeat({
    appVersion: '0.1.0',
    connectivity: 'online',
    command: 'shell',
  }), /unexpected/i);
  assert.throws(() => validateDeviceHeartbeat({
    appVersion: '0.1.0',
    connectivity: 'online',
    capabilities: ['shell.exec'],
  }), /unexpected/i);
});

test('issues a high-entropy per-device token and stores only a stable SHA-256 digest', async () => {
  const token = createDeviceToken();
  assert.match(token, /^aegis_dev_[A-Za-z0-9_-]{43}$/);
  const digest = await hashDeviceToken(token);
  assert.match(digest, /^[a-f0-9]{64}$/);
  assert.notEqual(digest, token);
  assert.equal(await hashDeviceToken(token), digest);
  assert.notEqual(await hashDeviceToken(createDeviceToken()), digest);
});
