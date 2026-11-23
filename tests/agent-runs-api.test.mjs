import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken } from '../functions/lib/auth.mjs';
import { onRequestGet } from '../functions/api/agent-runs.js';

const OWNER_SECRET = 'owner-session-secret-that-is-at-least-thirty-two-characters';

class AgentRunsD1 {
  constructor(rows = []) { this.rows = rows; this.sql = ''; this.values = []; }
  prepare(sql) {
    const db = this;
    return {
      bind(...values) { db.values = values; return this; },
      async all() { db.sql = sql; return { results: db.rows }; },
    };
  }
}

async function getRuns(db, authenticated = true) {
  const session = await createSessionToken(OWNER_SECRET);
  return onRequestGet({
    request: new Request('https://aegis.example/api/agent-runs', {
      headers: authenticated ? { Cookie: '__Host-aegis_session=' + session } : {},
    }),
    env: { AEGIS_PASSWORD: 'owner-password-long-enough', AEGIS_SESSION_SECRET: OWNER_SECRET, AEGIS_DB: db },
  });
}

test('owner receives bounded agent-run inventory with parsed plan and no internal fields', async () => {
  const plan = { execution: 'plan-only', steps: [{ specialist: 'reviewer' }] };
  const db = new AgentRunsD1([{
    id: '00000000-0000-4000-8000-000000000010',
    objective: 'Review runtime',
    status: 'planned',
    plan_json: JSON.stringify(plan),
    assigned_device_id: null,
    created_at: '2026-11-23T10:00:00.000Z',
    updated_at: '2026-11-23T10:01:00.000Z',
    specialists_json: '["reviewer"]',
    idempotency_key: 'private-key',
    error_code: null,
  }]);
  const response = await getRuns(db);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.agentRuns[0], {
    id: '00000000-0000-4000-8000-000000000010',
    objective: 'Review runtime',
    status: 'planned',
    plan,
    assignedDeviceId: null,
    createdAt: '2026-11-23T10:00:00.000Z',
    updatedAt: '2026-11-23T10:01:00.000Z',
  });
  assert.match(db.sql, /ORDER BY created_at DESC LIMIT 50/);
  assert.doesNotMatch(db.sql, /idempotency_key|specialists_json|error_code/);
  assert.match(db.sql, /LIMIT 50/);
  assert.equal(JSON.stringify(body).includes('private-key'), false);
});

test('agent-run inventory requires an authenticated owner session', async () => {
  const response = await getRuns(new AgentRunsD1(), false);
  assert.equal(response.status, 401);
});

test('agent-run inventory fails closed when the database is unavailable', async () => {
  const response = await getRuns(null);
  assert.equal(response.status, 503);
});

test('malformed stored plans are returned as null rather than breaking the inventory', async () => {
  const db = new AgentRunsD1([{
    id: '00000000-0000-4000-8000-000000000011',
    objective: 'Review safely',
    status: 'planned',
    plan_json: '{bad json',
    assigned_device_id: null,
    created_at: '2026-11-23T10:00:00.000Z',
    updated_at: '2026-11-23T10:00:00.000Z',
  }]);
  const response = await getRuns(db);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).agentRuns[0].plan, null);
});
