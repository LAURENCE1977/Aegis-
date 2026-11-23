import test from 'node:test';
import assert from 'node:assert/strict';
import { hashDeviceToken } from '../workers/runtime/devices.mjs';
import { onRequestGet } from '../functions/api/device-agent-runs.js';

const DEVICE_ID = '00000000-0000-4000-8000-000000000001';
const TOKEN = 'aegis_dev_' + 'A'.repeat(43);

class DeviceRunsD1 {
  constructor({ status = 'active', capabilities = ['aegis.jobs.observe'], rows = [] } = {}) {
    this.device = { id: DEVICE_ID, status, capabilities_json: JSON.stringify(capabilities), token_hash: null };
    this.rows = rows;
    this.sql = [];
    this.values = [];
  }

  prepare(sql) {
    const db = this;
    return {
      bind(...values) { this.values = values; return this; },
      async first() {
        db.sql.push(sql);
        db.values.push(this.values);
        if (sql.includes('FROM devices')) {
          const [id, tokenHash] = this.values;
          return db.device.id === id && db.device.token_hash === tokenHash && db.device.status === 'active'
            ? { id: db.device.id, capabilities_json: db.device.capabilities_json }
            : null;
        }
        return null;
      },
      async all() {
        db.sql.push(sql);
        db.values.push(this.values);
        return { results: db.rows };
      },
    };
  }
}

async function makeDb(options) {
  const db = new DeviceRunsD1(options);
  db.device.token_hash = await hashDeviceToken(TOKEN);
  return db;
}

function request({ token = TOKEN, deviceId = DEVICE_ID, origin = 'https://aegis.example', cookie = false } = {}) {
  return new Request('https://aegis.example/api/device-agent-runs?deviceId=' + encodeURIComponent(deviceId), {
    headers: {
      ...(origin ? { Origin: origin } : {}),
      ...(token ? cookie ? { Cookie: '__Host-aegis_device=' + token } : { Authorization: 'Device ' + token } : {}),
    },
  });
}

test('same-origin browser device cookie returns only plans assigned to that device', async () => {
  const plan = { execution: 'plan-only', steps: [{ specialist: 'reviewer' }] };
  const db = await makeDb({ rows: [{
    id: '00000000-0000-4000-8000-000000000010',
    objective: 'Review runtime',
    status: 'planned',
    plan_json: JSON.stringify(plan),
    created_at: '2026-11-23T10:00:00.000Z',
    updated_at: '2026-11-23T10:01:00.000Z',
    idempotency_key: 'must-not-leak',
    specialists_json: '["reviewer"]',
  }] });
  const response = await onRequestGet({ request: request({ cookie: true }), env: { AEGIS_DB: db } });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.agentRuns[0], {
    id: '00000000-0000-4000-8000-000000000010',
    objective: 'Review runtime',
    status: 'planned',
    plan,
    createdAt: '2026-11-23T10:00:00.000Z',
    updatedAt: '2026-11-23T10:01:00.000Z',
  });
  assert.match(db.sql[1], /assigned_device_id = \?/);
  assert.match(db.sql[1], /LIMIT 50/);
  assert.equal(JSON.stringify(body).includes('must-not-leak'), false);
});

test('native device authorization is accepted without an owner session', async () => {
  const db = await makeDb();
  const response = await onRequestGet({ request: request(), env: { AEGIS_DB: db } });
  assert.equal(response.status, 200);
});

test('invalid or revoked device credentials are rejected', async () => {
  const invalid = await makeDb();
  const invalidResponse = await onRequestGet({
    request: request({ token: 'aegis_dev_' + 'B'.repeat(43) }),
    env: { AEGIS_DB: invalid },
  });
  assert.equal(invalidResponse.status, 401);

  const revoked = await makeDb({ status: 'revoked' });
  const revokedResponse = await onRequestGet({ request: request(), env: { AEGIS_DB: revoked } });
  assert.equal(revokedResponse.status, 401);
});

test('device without observation capability is denied', async () => {
  const db = await makeDb({ capabilities: ['device.status.read'] });
  const response = await onRequestGet({ request: request(), env: { AEGIS_DB: db } });
  assert.equal(response.status, 403);
});

test('invalid device IDs, hostile origins and missing database fail closed', async () => {
  const db = await makeDb();
  const invalidId = await onRequestGet({ request: request({ deviceId: 'bad' }), env: { AEGIS_DB: db } });
  assert.equal(invalidId.status, 400);
  const hostileOrigin = await onRequestGet({
    request: request({ origin: 'https://evil.example' }),
    env: { AEGIS_DB: db },
  });
  assert.equal(hostileOrigin.status, 403);
  const missingDb = await onRequestGet({ request: request(), env: {} });
  assert.equal(missingDb.status, 503);
});
