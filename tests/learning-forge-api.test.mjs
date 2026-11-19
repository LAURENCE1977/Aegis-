import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken } from '../functions/lib/auth.mjs';
import { onRequestGet, onRequestPost } from '../functions/api/learning/paths.js';

const secret = 'learning-forge-api-test-session-secret-long-enough';
const envBase = { AEGIS_PASSWORD: 'test-password-long-enough', AEGIS_SESSION_SECRET: secret };

class LearningPathApiD1 {
  constructor() { this.rows = new Map(); this.events = []; }
  prepare(sql) {
    const db = this;
    return {
      values: [],
      bind(...values) { this.values = values; return this; },
      async run() {
        const [id, owner, pathId, version, digest, json, createdAt] = this.values;
        const key = owner + '|' + pathId + '|' + version;
        if (db.rows.has(key)) return { meta: { changes: 0 } };
        db.rows.set(key, { id, owner_id: owner, path_id: pathId, version, graph_digest: digest, graph_json: json, created_at: createdAt });
        db.events.push({ owner_id: owner, path_id: pathId, version, event_type: 'registered' });
        return { meta: { changes: 1 } };
      },
      async first() {
        const [owner, pathId, version] = this.values;
        return db.rows.get(owner + '|' + pathId + '|' + version) ?? null;
      },
      async all() {
        const [owner, limit] = this.values;
        return { results: [...db.rows.values()].filter(row => row.owner_id === owner).slice(0, limit) };
      },
    };
  }
}

async function makeRequest(path, body, options = {}) {
  const headers = { Origin: options.origin ?? 'https://aegis.example', 'Content-Type': 'application/json' };
  if (options.authenticated !== false) headers.Cookie = '__Host-aegis_session=' + await createSessionToken(secret);
  return new Request('https://aegis.example' + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

const learningPath = {
  id: 'javascript-foundations',
  version: '1.0.0',
  title: 'JavaScript Foundations',
  description: 'A beginner path for practical JavaScript.',
  nodes: [{
    id: 'javascript-basics', title: 'JavaScript basics',
    outcomes: ['Explain variables'], prerequisites: [], difficulty: 'beginner',
    sourceRefs: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
    contentLicenseStatus: 'link-only',
  }],
};

test('Learning Forge path API requires an authenticated owner', async () => {
  const response = await onRequestGet({
    request: await makeRequest('/api/learning/paths', undefined, { authenticated: false }),
    env: { ...envBase, AEGIS_DB: new LearningPathApiD1() },
  });
  assert.equal(response.status, 401);
});

test('Learning Forge path API registers and lists immutable owner-scoped paths', async () => {
  const db = new LearningPathApiD1();
  const created = await onRequestPost({
    request: await makeRequest('/api/learning/paths', learningPath),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(created.status, 201);
  const body = await created.json();
  assert.equal(body.learningPath.path.id, learningPath.id);
  assert.match(body.learningPath.digest, /^[a-f0-9]{64}$/);

  const listed = await onRequestGet({
    request: await makeRequest('/api/learning/paths'),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(listed.status, 200);
  assert.equal((await listed.json()).total, 1);
});

test('Learning Forge path API rejects cross-origin writes, unknown fields and repeated query parameters', async () => {
  const db = new LearningPathApiD1();
  const crossOrigin = await onRequestPost({
    request: await makeRequest('/api/learning/paths', learningPath, { origin: 'https://attacker.example' }),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(crossOrigin.status, 403);
  const invalid = await onRequestPost({
    request: await makeRequest('/api/learning/paths', { ...learningPath, ownerId: 'attacker' }),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(invalid.status, 400);
  const repeated = await onRequestGet({
    request: await makeRequest('/api/learning/paths?limit=1&limit=2'),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(repeated.status, 400);
  assert.equal(db.rows.size, 0);
});
