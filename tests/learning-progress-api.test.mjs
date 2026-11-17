import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken } from '../functions/lib/auth.mjs';
import {
  onRequestGet,
  onRequestPatch,
} from '../functions/api/learning/paths/[id]/progress.js';

const secret = 'learning-progress-api-test-session-secret-long-enough';
const envBase = { AEGIS_PASSWORD: 'test-password-long-enough', AEGIS_SESSION_SECRET: secret };

class LearningProgressApiD1 {
  constructor() {
    this.path = {
      id: 'learning-path-1', owner_id: 'owner', path_id: 'javascript-foundations',
      version: '1.0.0', graph_digest: 'a'.repeat(64),
      graph_json: JSON.stringify({
        id: 'javascript-foundations', version: '1.0.0', title: 'JavaScript Foundations',
        description: 'A path', nodes: [{
          id: 'javascript-basics', title: 'Basics', outcomes: ['Explain variables'],
          prerequisites: [], difficulty: 'beginner',
          sourceRefs: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
          contentLicenseStatus: 'link-only',
        }],
      }),
      created_at: '2026-11-17T12:00:00.000Z',
    };
    this.rows = new Map();
    this.events = [];
  }
  prepare(sql) {
    const db = this;
    return {
      values: [],
      bind(...values) { this.values = values; return this; },
      async run() {
        const v = this.values;
        if (sql.includes('INSERT INTO learning_progress')) {
          const [owner, pathId, version, nodeId, status, createdAt, updatedAt] = v;
          const key = [owner,pathId,version,nodeId].join('|');
          if (db.rows.has(key)) return { meta: { changes: 0 } };
          db.rows.set(key, { owner_id: owner, path_id: pathId, path_version: version, node_id: nodeId, status, created_at: createdAt, updated_at: updatedAt });
          db.events.push({ to_status: status });
          return { meta: { changes: 1 } };
        }
        return { meta: { changes: 0 } };
      },
      async first() {
        const v = this.values;
        if (sql.includes('FROM learning_paths')) {
          return db.path.owner_id === v[0] && db.path.path_id === v[1] && db.path.version === v[2] ? db.path : null;
        }
        if (sql.includes('FROM learning_progress')) return db.rows.get(v.join('|')) ?? null;
        return null;
      },
      async all() {
        const [owner, pathId, version] = this.values;
        return { results: [...db.rows.values()].filter(row => row.owner_id === owner && row.path_id === pathId && row.path_version === version) };
      },
    };
  }
}

async function makeRequest(path, body, options = {}) {
  const headers = { Origin: options.origin ?? 'https://aegis.example', 'Content-Type': 'application/json' };
  if (options.authenticated !== false) headers.Cookie = '__Host-aegis_session=' + await createSessionToken(secret);
  return new Request('https://aegis.example' + path, {
    method: body === undefined ? 'GET' : 'PATCH',
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

test('Learning Progress API requires authentication before accessing path data', async () => {
  const db = new LearningProgressApiD1();
  const response = await onRequestGet({
    request: await makeRequest('/api/learning/paths/javascript-foundations/progress?version=1.0.0', undefined, { authenticated: false }),
    env: { ...envBase, AEGIS_DB: db },
    params: { id: 'javascript-foundations' },
  });
  assert.equal(response.status, 401);
});

test('Learning Progress API writes self-reported progress and never claims verified mastery', async () => {
  const db = new LearningProgressApiD1();
  const response = await onRequestPatch({
    request: await makeRequest('/api/learning/paths/javascript-foundations/progress', {
      version: '1.0.0', nodeId: 'javascript-basics', status: 'self_reported_complete', expectedUpdatedAt: null,
    }),
    env: { ...envBase, AEGIS_DB: db },
    params: { id: 'javascript-foundations' },
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.progress.status, 'self_reported_complete');
  assert.equal(body.masteryVerified, false);
});

test('Learning Progress API rejects cross-origin writes and caller-supplied identity', async () => {
  const db = new LearningProgressApiD1();
  const crossOrigin = await onRequestPatch({
    request: await makeRequest('/api/learning/paths/javascript-foundations/progress', {
      version: '1.0.0', nodeId: 'javascript-basics', status: 'in_progress', expectedUpdatedAt: null,
    }, { origin: 'https://attacker.example' }),
    env: { ...envBase, AEGIS_DB: db },
    params: { id: 'javascript-foundations' },
  });
  assert.equal(crossOrigin.status, 403);
  const invalid = await onRequestPatch({
    request: await makeRequest('/api/learning/paths/javascript-foundations/progress', {
      version: '1.0.0', nodeId: 'javascript-basics', status: 'in_progress', expectedUpdatedAt: null, ownerId: 'attacker',
    }),
    env: { ...envBase, AEGIS_DB: db },
    params: { id: 'javascript-foundations' },
  });
  assert.equal(invalid.status, 400);
  assert.equal(db.rows.size, 0);
});
