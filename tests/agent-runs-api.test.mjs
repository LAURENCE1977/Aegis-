import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken } from '../functions/lib/auth.mjs';
import { onRequestGet, onRequestPost } from '../functions/api/agent-runs.js';

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


const JOB_TOKEN = 'runtime-job-token-that-is-at-least-thirty-two-characters';
const IDEMPOTENCY_KEY = 'owner-task-00000001';

async function postRun(input, { authenticated = true, origin = 'https://aegis.example', runtime, token = JOB_TOKEN } = {}) {
  const session = await createSessionToken(OWNER_SECRET);
  return onRequestPost({
    request: new Request('https://aegis.example/api/agent-runs', {
      method: 'POST',
      headers: {
        ...(authenticated ? { Cookie: '__Host-aegis_session=' + session } : {}),
        ...(origin ? { Origin: origin } : {}),
        'Content-Type': 'application/json',
        'Idempotency-Key': IDEMPOTENCY_KEY,
      },
      body: JSON.stringify(input),
    }),
    env: {
      AEGIS_PASSWORD: 'owner-password-long-enough',
      AEGIS_SESSION_SECRET: OWNER_SECRET,
      AEGIS_JOB_TOKEN: token,
      AEGIS_RUNTIME: runtime,
    },
  });
}

test('owner can submit a bounded plan-only agent run through the private runtime binding', async () => {
  let forwarded;
  const runtime = {
    async fetch(request) {
      forwarded = request;
      return new Response(JSON.stringify({
        run: {
          id: '00000000-0000-4000-8000-000000000020',
          objective: 'Review the AEGIS runtime',
          specialists: ['researcher', 'engineer', 'reviewer'],
          status: 'queued',
          attempts: 0,
          createdAt: '2026-11-24T10:00:00.000Z',
          updatedAt: '2026-11-24T10:00:00.000Z',
          plan: null,
          errorCode: null,
        },
      }), { status: 201, headers: { 'Content-Type': 'application/json' } });
    },
  };

  const response = await postRun({ objective: '  Review the AEGIS runtime  ' }, { runtime });
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  const body = await response.json();
  assert.equal(body.run.objective, 'Review the AEGIS runtime');
  assert.equal(body.run.status, 'queued');
  assert.equal(forwarded.method, 'POST');
  assert.equal(new URL(forwarded.url).pathname, '/v1/agent-runs');
  assert.equal(forwarded.headers.get('Authorization'), 'Bearer ' + JOB_TOKEN);
  assert.equal(forwarded.headers.get('Idempotency-Key'), IDEMPOTENCY_KEY);
  assert.deepEqual(await forwarded.json(), {
    objective: 'Review the AEGIS runtime',
    specialists: ['researcher', 'engineer', 'reviewer'],
  });
});

test('agent-run submission requires an authenticated owner session and same-origin request', async () => {
  let calls = 0;
  const runtime = { async fetch() { calls += 1; return Response.json({ run: {} }, { status: 201 }); } };
  assert.equal((await postRun({ objective: 'Review safely' }, { runtime, authenticated: false })).status, 401);
  assert.equal((await postRun({ objective: 'Review safely' }, { runtime, origin: 'https://attacker.example' })).status, 403);
  assert.equal(calls, 0);
});

test('agent-run submission fails closed when runtime binding or server token is missing', async () => {
  const missingBinding = await postRun({ objective: 'Review safely' }, { runtime: undefined });
  assert.equal(missingBinding.status, 503);
  const missingToken = await postRun({ objective: 'Review safely' }, { runtime: { async fetch() { assert.fail('must not call runtime'); } }, token: '' });
  assert.equal(missingToken.status, 503);
});

test('agent-run submission rejects malformed or over-privileged input before contacting runtime', async () => {
  let calls = 0;
  const runtime = { async fetch() { calls += 1; return Response.json({ run: {} }, { status: 201 }); } };
  assert.equal((await postRun({ objective: 'Review safely', execute: true }, { runtime })).status, 400);
  assert.equal((await postRun({ objective: '   ' }, { runtime })).status, 400);
  assert.equal(calls, 0);
});

test('agent-run submission maps an unavailable runtime to a safe service error', async () => {
  const runtime = { async fetch() { throw new Error('private runtime detail'); } };
  const response = await postRun({ objective: 'Review safely' }, { runtime });
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /private runtime detail/);
});
