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

test('creates a separate short-lived pairing code and hashes it before storage', async () => {
  const { createPairingCode, hashPairingCode } = await import('../workers/runtime/devices.mjs');
  const code = createPairingCode();
  assert.match(code, /^aegis_pair_[A-Za-z0-9_-]{43}$/);
  const digest = await hashPairingCode(code);
  assert.match(digest, /^[a-f0-9]{64}$/);
  assert.notEqual(digest, code);
  assert.equal(await hashPairingCode(code), digest);
  assert.notEqual(await hashPairingCode(createPairingCode()), digest);
});

test('rejects malformed pairing codes before hashing', async () => {
  const { hashPairingCode } = await import('../workers/runtime/devices.mjs');
  await assert.rejects(() => hashPairingCode('aegis_dev_not-a-pairing-code'), /pairing code/i);
});

test('accepts only a single pairing code field for device enrolment', async () => {
  const { validatePairingRedemption } = await import('../workers/runtime/devices.mjs');
  assert.deepEqual(validatePairingRedemption({
    code: 'aegis_pair_' + 'A'.repeat(43),
  }), { code: 'aegis_pair_' + 'A'.repeat(43) });
  assert.throws(() => validatePairingRedemption({
    code: 'aegis_pair_' + 'A'.repeat(43),
    ownerId: 'attacker',
  }), /unexpected/i);
  assert.throws(() => validatePairingRedemption({ code: 'expired-or-malformed' }), /pairing code/i);
});

test('parses only the dedicated Device authorization scheme', async () => {
  const { parseDeviceAuthorization } = await import('../workers/runtime/devices.mjs');
  const token = 'aegis_dev_' + 'B'.repeat(43);
  assert.equal(parseDeviceAuthorization('Device ' + token), token);
  assert.equal(parseDeviceAuthorization('Bearer ' + token), null);
  assert.equal(parseDeviceAuthorization('Device ' + 'short'), null);
  assert.equal(parseDeviceAuthorization(null), null);
});
