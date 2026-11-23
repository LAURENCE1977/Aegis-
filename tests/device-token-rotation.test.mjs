import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost as rotateDeviceToken } from '../functions/api/device-token-rotate.js';
import { createDeviceToken, hashDeviceToken } from '../workers/runtime/devices.mjs';

const DEVICE_ID = '00000000-0000-4000-8000-000000000001';

class RotationD1 {
  constructor({ tokenHash, status = 'active', tokenVersion = 1 } = {}) {
    this.device = {
      id: DEVICE_ID,
      token_hash: tokenHash,
      status,
      token_version: tokenVersion,
      updated_at: '2026-11-23T00:00:00.000Z',
    };
    this.events = [];
    this.failNextBatch = false;
  }

  prepare(sql) {
    return {
      sql,
      values: [],
      bind(...values) { this.values = values; return this; },
    };
  }

  async batch(statements) {
    if (this.failNextBatch) {
      this.failNextBatch = false;
      throw new Error('simulated transaction failure');
    }
    const update = statements[0];
    const event = statements[1];
    const [nextHash, now, deviceId, oldHash] = update.values;
    const eligible = this.device.id === deviceId &&
      this.device.token_hash === oldHash && this.device.status === 'active';
    if (!eligible) return [{ meta: { changes: 0 } }, { meta: { changes: 0 } }];

    const previous = { ...this.device };
    const nextVersion = this.device.token_version + 1;
    this.device.token_hash = nextHash;
    this.device.token_version = nextVersion;
    this.device.updated_at = now;
    const [eventId, eventAt, eventDeviceId, eventHash] = event.values;
    if (eventDeviceId === deviceId && eventHash === nextHash && eventAt === now) {
      this.events.push({ event_id: eventId, device_id: deviceId, event_type: 'token_rotated', token_version: nextVersion });
      return [{ meta: { changes: 1 } }, { meta: { changes: 1 } }];
    }
    this.device = previous;
    throw new Error('audit event did not match rotation');
  }
}

function request(db, token, deviceId = DEVICE_ID) {
  return rotateDeviceToken({
    request: new Request('https://aegis.example/api/device-token-rotate', {
      method: 'POST',
      headers: {
        Authorization: 'Device ' + token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ deviceId }),
    }),
    env: { AEGIS_DB: db },
  });
}

test('rotates an active device credential once and records the new token version', async () => {
  const oldToken = createDeviceToken();
  const oldHash = await hashDeviceToken(oldToken);
  const db = new RotationD1({ tokenHash: oldHash });
  const response = await request(db, oldToken);

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.match(body.credential, /^aegis_dev_[A-Za-z0-9_-]{43}$/);
  assert.notEqual(body.credential, oldToken);
  assert.equal(db.device.token_hash, await hashDeviceToken(body.credential));
  assert.equal(db.device.token_version, 2);
  assert.equal(db.events.length, 1);
  assert.equal(db.events[0].event_type, 'token_rotated');
});

test('rejects reuse of the previous credential after successful rotation', async () => {
  const oldToken = createDeviceToken();
  const db = new RotationD1({ tokenHash: await hashDeviceToken(oldToken) });
  const first = await request(db, oldToken);
  assert.equal(first.status, 200);

  const replay = await request(db, oldToken);
  assert.equal(replay.status, 401);
  assert.equal(db.device.token_version, 2);
  assert.equal(db.events.length, 1);
});

test('does not rotate a revoked device credential', async () => {
  const token = createDeviceToken();
  const db = new RotationD1({ tokenHash: await hashDeviceToken(token), status: 'revoked' });
  const response = await request(db, token);
  assert.equal(response.status, 401);
  assert.equal(db.device.token_version, 1);
  assert.equal(db.events.length, 0);
});

test('leaves the existing credential valid if the rotation transaction fails', async () => {
  const token = createDeviceToken();
  const oldHash = await hashDeviceToken(token);
  const db = new RotationD1({ tokenHash: oldHash });
  db.failNextBatch = true;

  const response = await request(db, token);
  assert.equal(response.status, 503);
  assert.equal(db.device.token_hash, oldHash);
  assert.equal(db.device.token_version, 1);
  assert.equal(db.events.length, 0);
});
