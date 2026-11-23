import test from 'node:test';
import assert from 'node:assert/strict';
import runtime from '../workers/runtime/index.mjs';
import { hashDeviceToken } from '../workers/runtime/devices.mjs';

const DEVICE_ID = '00000000-0000-4000-8000-000000000001';
const OTHER_DEVICE_ID = '00000000-0000-4000-8000-000000000002';
const TOKEN = 'aegis_dev_' + 'A'.repeat(43);

class DeviceRuntimeD1 {
  constructor(deviceStatus = 'active', capabilities = ['aegis.jobs.observe']) {
    this.device = {
      id: DEVICE_ID,
      owner_id: 'owner',
      status: deviceStatus,
      token_hash: null,
      capabilities_json: JSON.stringify(capabilities),
    };
    this.runs = [
      {
        id: '00000000-0000-4000-8000-000000000010',
        objective: 'Assigned plan',
        status: 'planned',
        plan_json: JSON.stringify({ execution: 'plan-only', steps: [{ specialist: 'engineer' }] }),
      },
      {
        id: '00000000-0000-4000-8000-000000000011',
        objective: 'Another device plan',
        status: 'planned',
        plan_json: JSON.stringify({ execution: 'plan-only', steps: [] }),
      },
    ];
    this.runs[0].assigned_device_id = DEVICE_ID;
    this.runs[1].assigned_device_id = OTHER_DEVICE_ID;
  }

  prepare(sql) {
    const db = this;
    return {
      values: [],
      bind(...values) { this.values = values; return this; },
      async first() {
        if (sql.includes('FROM devices WHERE id = ? AND token_hash = ?')) {
          const [id, tokenHash] = this.values;
          return db.device.id === id && db.device.token_hash === tokenHash ? db.device : null;
        }
        return null;
      },
      async all() {
        if (sql.includes('FROM agent_runs WHERE assigned_device_id = ?')) {
          const [deviceId] = this.values;
          return { results: db.runs.filter((run) => run.assigned_device_id === deviceId) };
        }
        return { results: [] };
      },
    };
  }
}

async function makeEnv(status, capabilities) {
  const DB = new DeviceRuntimeD1(status, capabilities);
  DB.device.token_hash = await hashDeviceToken(TOKEN);
  return { DB, AGENT_RUNS_ENABLED: 'true' };
}

function request(deviceId = DEVICE_ID, authorization = 'Device ' + TOKEN) {
  return new Request('https://runtime.example/v1/devices/' + deviceId + '/agent-runs', {
    headers: { Authorization: authorization },
  });
}

test('device can read only agent plans explicitly assigned to itself', async () => {
  const env = await makeEnv();
  const response = await runtime.fetch(request(), env);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.agentRuns.length, 1);
  assert.equal(body.agentRuns[0].id, '00000000-0000-4000-8000-000000000010');
  assert.equal(body.agentRuns[0].objective, 'Assigned plan');
  assert.equal(body.agentRuns[0].plan.execution, 'plan-only');
});

test('device agent-plan endpoint rejects missing or invalid device credentials', async () => {
  const env = await makeEnv();
  const response = await runtime.fetch(request(DEVICE_ID, 'Bearer ' + TOKEN), env);
  assert.equal(response.status, 401);
});

test('revoked device cannot read assigned agent plans', async () => {
  const env = await makeEnv('revoked');
  const response = await runtime.fetch(request(), env);
  assert.equal(response.status, 401);
});

test('device without the observation capability cannot read assigned agent plans', async () => {
  const env = await makeEnv('active', ['device.status.read']);
  const response = await runtime.fetch(request(), env);
  assert.equal(response.status, 403);
});

test('device cannot query another device identifier', async () => {
  const env = await makeEnv();
  const response = await runtime.fetch(request(OTHER_DEVICE_ID), env);
  assert.equal(response.status, 401);
});
