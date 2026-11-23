import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken } from '../functions/lib/auth.mjs';
import { onRequestPost } from '../functions/api/device-assign-run.js';

const OWNER_SECRET = 'owner-session-secret-that-is-at-least-thirty-two-characters';
const DEVICE_ID = '00000000-0000-4000-8000-000000000001';
const RUN_ID = '00000000-0000-4000-8000-000000000010';

class AssignmentD1 {
  constructor({ deviceStatus = 'active', capabilities = ['aegis.jobs.observe'], runStatus = 'planned' } = {}) {
    this.device = { id: DEVICE_ID, owner_id: 'owner', status: deviceStatus, capabilities_json: JSON.stringify(capabilities) };
    this.run = { id: RUN_ID, status: runStatus, assigned_device_id: null, updated_at: null };
    this.events = [];
  }

  prepare(sql) {
    return { sql, values: [], bind(...values) { this.values = values; return this; } };
  }

  async batch(statements) {
    const [update, audit] = statements;
    assert.match(update.sql, /status = 'planned'/);
    assert.match(update.sql, /aegis\.jobs\.observe/);
    const [deviceId, updatedAt, runId, targetDeviceId, ownerId] = update.values;
    const eligible = this.device.id === targetDeviceId && this.device.owner_id === ownerId &&
      this.device.status === 'active' && JSON.parse(this.device.capabilities_json).includes('aegis.jobs.observe') &&
      this.run.id === runId && this.run.status === 'planned';
    if (eligible) {
      this.run.assigned_device_id = deviceId;
      this.run.updated_at = updatedAt;
    }
    const [eventId, eventDeviceId, eventAt, eventRunId, eventAssignedDeviceId, eventUpdatedAt] = audit.values;
    if (eligible && this.run.id === eventRunId && this.run.assigned_device_id === eventAssignedDeviceId &&
        this.run.updated_at === eventUpdatedAt) {
      this.events.push({ eventId, deviceId: eventDeviceId, createdAt: eventAt });
    }
    return [{ meta: { changes: eligible ? 1 : 0 } }, { meta: { changes: eligible ? 1 : 0 } }];
  }
}

async function ownerRequest(db, body, authenticated = true) {
  const session = await createSessionToken(OWNER_SECRET);
  return onRequestPost({
    request: new Request('https://aegis.example/api/device-assign-run', {
      method: 'POST',
      headers: {
        ...(authenticated ? { Cookie: '__Host-aegis_session=' + session } : {}),
        Origin: 'https://aegis.example',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }),
    env: { AEGIS_PASSWORD: 'owner-password-long-enough', AEGIS_SESSION_SECRET: OWNER_SECRET, AEGIS_DB: db },
  });
}

test('owner can assign a planned agent run to an active device with observation permission', async () => {
  const db = new AssignmentD1();
  const response = await ownerRequest(db, { deviceId: DEVICE_ID, agentRunId: RUN_ID });
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), {
    assignment: { agentRunId: RUN_ID, deviceId: DEVICE_ID, assignedAt: db.run.updated_at },
  });
  assert.equal(db.run.assigned_device_id, DEVICE_ID);
  assert.equal(db.events.length, 1);
});

test('assignment rejects revoked devices and devices without observation permission', async () => {
  const revoked = await ownerRequest(new AssignmentD1({ deviceStatus: 'revoked' }), {
    deviceId: DEVICE_ID, agentRunId: RUN_ID,
  });
  assert.equal(revoked.status, 409);
  const unpermitted = await ownerRequest(new AssignmentD1({ capabilities: ['device.status.read'] }), {
    deviceId: DEVICE_ID, agentRunId: RUN_ID,
  });
  assert.equal(unpermitted.status, 409);
});

test('assignment rejects non-planned runs and malformed identifiers', async () => {
  const notPlanned = await ownerRequest(new AssignmentD1({ runStatus: 'queued' }), {
    deviceId: DEVICE_ID, agentRunId: RUN_ID,
  });
  assert.equal(notPlanned.status, 409);
  const malformed = await ownerRequest(new AssignmentD1(), { deviceId: 'not-a-device', agentRunId: RUN_ID });
  assert.equal(malformed.status, 400);
});

test('assignment requires an authenticated owner session', async () => {
  const response = await ownerRequest(new AssignmentD1(), { deviceId: DEVICE_ID, agentRunId: RUN_ID }, false);
  assert.equal(response.status, 401);
});
