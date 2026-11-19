import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken } from '../functions/lib/auth.mjs';
import { onRequestGet, onRequestPost } from '../functions/api/eval/suites.js';

const secret = 'eval-forge-api-test-session-secret-long-enough';
const envBase = { AEGIS_PASSWORD: 'test-password-long-enough', AEGIS_SESSION_SECRET: secret };

class EvalSuiteApiD1 {
  constructor() { this.rows = new Map(); this.events = []; }
  prepare(sql) {
    const db = this;
    return {
      values: [],
      bind(...values) { this.values = values; return this; },
      async run() {
        const [id, owner, suiteId, version, digest, json, createdAt] = this.values;
        const key = owner + '|' + suiteId + '|' + version;
        if (db.rows.has(key)) return { meta: { changes: 0 } };
        db.rows.set(key, { id, owner_id: owner, suite_id: suiteId, version, suite_digest: digest, suite_json: json, created_at: createdAt });
        db.events.push({ owner_id: owner, suite_id: suiteId, version, event_type: 'registered' });
        return { meta: { changes: 1 } };
      },
      async first() {
        const [owner, suiteId, version] = this.values;
        return db.rows.get(owner + '|' + suiteId + '|' + version) ?? null;
      },
      async all() {
        const [owner, limit] = this.values;
        return { results: [...db.rows.values()].filter(row => row.owner_id === owner).slice(0, limit) };
      },
    };
  }
}

async function request(path, body, options = {}) {
  const headers = { Origin: options.origin ?? 'https://aegis.example', 'Content-Type': 'application/json' };
  if (options.authenticated !== false) headers.Cookie = '__Host-aegis_session=' + await createSessionToken(secret);
  return new Request('https://aegis.example' + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

const suite = {
  id: 'guardian-regression',
  version: '1.0.0',
  title: 'Guardian regression suite',
  taskType: 'reasoning',
  minimumScore: 100,
  cases: [{ id: 'scope-check', weight: 1, required: true }],
};

test('Eval Forge suite API requires an authenticated owner', async () => {
  const response = await onRequestGet({
    request: await request('/api/eval/suites', undefined, { authenticated: false }),
    env: { ...envBase, AEGIS_DB: new EvalSuiteApiD1() },
  });
  assert.equal(response.status, 401);
});

test('Eval Forge suite API registers and lists immutable owner-scoped suite versions', async () => {
  const db = new EvalSuiteApiD1();
  const created = await onRequestPost({
    request: await request('/api/eval/suites', suite),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(created.status, 201);
  const payload = await created.json();
  assert.equal(payload.suite.suite.id, suite.id);
  assert.match(payload.suite.digest, /^[a-f0-9]{64}$/);

  const listed = await onRequestGet({
    request: await request('/api/eval/suites'),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(listed.status, 200);
  assert.equal((await listed.json()).total, 1);
});

test('Eval Forge suite API rejects cross-origin writes, invalid bodies and repeated query parameters', async () => {
  const db = new EvalSuiteApiD1();
  const crossOrigin = await onRequestPost({
    request: await request('/api/eval/suites', suite, { origin: 'https://attacker.example' }),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(crossOrigin.status, 403);
  const invalid = await onRequestPost({
    request: await request('/api/eval/suites', { ...suite, ownerId: 'attacker' }),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(invalid.status, 400);
  const repeated = await onRequestGet({
    request: await request('/api/eval/suites?limit=2&limit=3'),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(repeated.status, 400);
  assert.equal(db.rows.size, 0);
});
