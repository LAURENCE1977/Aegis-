import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken } from '../functions/lib/auth.mjs';
import { onRequestPost as createInvitation } from '../functions/api/devices.js';
import { onRequestPost as enrolDevice } from '../functions/api/device-enrol.js';
import { onRequestPost as heartbeatDevice } from '../functions/api/device-heartbeat.js';

const OWNER_SECRET = 'owner-session-secret-that-is-at-least-thirty-two-characters';
const DEVICE_ID = '00000000-0000-4000-8000-000000000001';

class DeviceD1 {
  constructor() {
    this.invites = new Map();
    this.devices = new Map();
    this.events = [];
  }

  prepare(sql) {
    const db = this;
    return {
      sql,
      values: [],
      bind(...values) { this.values = values; return this; },
      async first() {
        const v = this.values;
        if (sql.includes('SELECT COUNT(*) AS count FROM device_pairing_invites')) {
          return { count: [...db.invites.values()].filter((invite) => invite.created_at > v[1]).length };
        }
        if (sql.includes('SELECT id FROM device_pairing_invites WHERE code_hash')) {
          const invite = [...db.invites.values()].find((item) =>
            item.code_hash === v[0] && !item.consumed_at && !item.revoked_at && item.expires_at > v[1]);
          return invite ? { id: invite.id } : null;
        }
        if (sql.includes('SELECT id FROM devices WHERE id = ? AND token_hash = ? AND status')) {
          const row = db.devices.get(v[0]);
          return row && row.token_hash === v[1] && row.status === 'active' ? { id: row.id } : null;
        }
        return null;
      },
      async all() { return { results: [] }; },
      async run() {
        const v = this.values;
        if (sql.includes('INSERT INTO device_pairing_invites')) {
          db.invites.set(v[0], {
            id: v[0], owner_id: v[1], code_hash: v[2], platform: v[3],
            display_name: v[4], capabilities_json: v[5], expires_at: v[6],
            consumed_at: null, revoked_at: null, created_by: v[7], created_at: v[8],
          });
          return { meta: { changes: 1 } };
        }
        if (sql.includes("UPDATE devices SET last_seen_at")) {
          const row = db.devices.get(v[4]);
          const eligible = row && row.token_hash === v[5] && row.status === 'active' &&
            (!row.last_seen_at || row.last_seen_at <= v[6]);
          if (!eligible) return { meta: { changes: 0 } };
          row.last_seen_at = v[0]; row.app_version = v[1]; row.connectivity = v[2]; row.updated_at = v[3];
          return { meta: { changes: 1 } };
        }
        if (sql.includes('INSERT INTO device_events')) {
          db.events.push({ event_id: v[0], device_id: v[1], event_type: sql.includes("'heartbeat'") ? 'heartbeat' : 'revoked', detail_json: v[2], created_at: v[3] });
          return { meta: { changes: 1 } };
        }
        return { meta: { changes: 0 } };
      },
    };
  }

  async batch(statements) {
    const results = [];
    for (const statement of statements) {
      const sql = statement.sql;
      const v = statement.values;
      if (sql.includes('INSERT INTO devices')) {
        const invite = [...this.invites.values()].find((item) =>
          item.code_hash === v[4] && !item.consumed_at && !item.revoked_at && item.expires_at > v[5]);
        if (!invite) { results.push({ meta: { changes: 0 } }); continue; }
        this.devices.set(v[0], {
          id: v[0], invite_id: invite.id, owner_id: invite.owner_id, platform: invite.platform,
          display_name: invite.display_name, token_hash: v[1], token_version: 1,
          capabilities_json: invite.capabilities_json, status: 'active', last_seen_at: null,
          app_version: null, connectivity: null, created_at: v[2], updated_at: v[3], revoked_at: null,
        });
        results.push({ meta: { changes: 1 } });
      } else if (sql.includes('UPDATE device_pairing_invites')) {
        const invite = [...this.invites.values()].find((item) => item.code_hash === v[1]);
        const device = this.devices.get(v[3]);
        if (invite && device?.invite_id === invite.id && !invite.consumed_at && !invite.revoked_at && invite.expires_at > v[2]) {
          invite.consumed_at = v[0];
          results.push({ meta: { changes: 1 } });
        } else results.push({ meta: { changes: 0 } });
      } else if (sql.includes('INSERT INTO device_events')) {
        this.events.push({ event_id: v[0], device_id: v[2], event_type: 'paired', created_at: v[1] });
        results.push({ meta: { changes: 1 } });
      } else {
        results.push({ meta: { changes: 0 } });
      }
    }
    return results;
  }
}

async function ownerRequest(db, body) {
  const session = await createSessionToken(OWNER_SECRET);
  return createInvitation({
    request: new Request('https://aegis.example/api/devices', {
      method: 'POST',
      headers: {
        Cookie: '__Host-aegis_session=' + session,
        Origin: 'https://aegis.example',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }),
    env: { AEGIS_PASSWORD: 'owner-password-long-enough', AEGIS_SESSION_SECRET: OWNER_SECRET, AEGIS_DB: db },
  });
}

test('owner creates a short-lived pairing invitation without storing its raw code', async () => {
  const db = new DeviceD1();
  const response = await ownerRequest(db, {
    platform: 'android',
    displayName: 'Laurence phone',
    capabilities: ['device.status.read', 'aegis.jobs.observe'],
  });
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.match(body.invitation.code, /^aegis_pair_[A-Za-z0-9_-]{43}$/);
  const invite = [...db.invites.values()][0];
  assert.ok(invite);
  assert.notEqual(invite.code_hash, body.invitation.code);
  assert.equal(invite.platform, 'android');
  assert.equal(invite.consumed_at, null);
  assert.equal(Date.parse(invite.expires_at) - Date.parse(invite.created_at), 10 * 60 * 1000);
});

test('device enrolment consumes the invitation once and returns a separate device credential', async () => {
  const db = new DeviceD1();
  const inviteResponse = await ownerRequest(db, {
    platform: 'android',
    displayName: 'Phone',
    capabilities: ['device.status.read'],
  });
  const { invitation } = await inviteResponse.json();
  const request = () => enrolDevice({
    request: new Request('https://aegis.example/api/device-enrol', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: invitation.code }),
    }),
    env: { AEGIS_DB: db },
  });

  const first = await request();
  assert.equal(first.status, 201);
  const enrolled = await first.json();
  assert.match(enrolled.credential, /^aegis_dev_[A-Za-z0-9_-]{43}$/);
  const device = db.devices.get(enrolled.device.id);
  assert.ok(device);
  assert.notEqual(device.token_hash, enrolled.credential);
  assert.ok([...db.invites.values()][0].consumed_at);
  assert.equal(db.events.filter((event) => event.event_type === 'paired').length, 1);

  const replay = await request();
  assert.equal(replay.status, 410);
  assert.equal(db.devices.size, 1);
});

test('device heartbeat authenticates the per-device credential and enforces a cooldown', async () => {
  const db = new DeviceD1();
  const inviteResponse = await ownerRequest(db, {
    platform: 'android',
    displayName: 'Phone',
    capabilities: ['device.status.read'],
  });
  const { invitation } = await inviteResponse.json();
  const enrolledResponse = await enrolDevice({
    request: new Request('https://aegis.example/api/device-enrol', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: invitation.code }),
    }),
    env: { AEGIS_DB: db },
  });
  const enrolled = await enrolledResponse.json();
  const makeRequest = (authorization) => heartbeatDevice({
    request: new Request('https://aegis.example/api/device-heartbeat', {
      method: 'POST',
      headers: { Authorization: authorization, 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: enrolled.device.id, appVersion: '0.1.0', connectivity: 'online' }),
    }),
    env: { AEGIS_DB: db },
  });

  const success = await makeRequest('Device ' + enrolled.credential);
  assert.equal(success.status, 200);
  const throttled = await makeRequest('Device ' + enrolled.credential);
  assert.equal(throttled.status, 429);
  const denied = await makeRequest('Bearer ' + enrolled.credential);
  assert.equal(denied.status, 401);
  assert.equal(db.events.filter((event) => event.event_type === 'heartbeat').length, 1);
});

test('browser enrolment keeps the credential out of JavaScript in a Secure HttpOnly cookie', async () => {
  const db = new DeviceD1();
  const inviteResponse = await ownerRequest(db, {
    platform: 'android',
    displayName: 'Browser paired phone',
    capabilities: ['device.status.read'],
  });
  const { invitation } = await inviteResponse.json();
  const response = await enrolDevice({
    request: new Request('https://aegis.example/api/device-enrol', {
      method: 'POST',
      headers: {
        Origin: 'https://aegis.example',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code: invitation.code }),
    }),
    env: { AEGIS_DB: db },
  });
  assert.equal(response.status, 201);
  const cookie = response.headers.get('Set-Cookie');
  assert.match(cookie, /__Host-aegis_device=/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Strict/);
  const body = await response.json();
  assert.equal(body.credential, undefined);
  assert.equal(body.credentialStoredInHttpOnlyCookie, true);
});
