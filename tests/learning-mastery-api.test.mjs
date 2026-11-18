import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createSessionToken } from '../functions/lib/auth.mjs';
import { onRequestGet } from '../functions/api/learning/mastery.js';

const secret = 'learning-mastery-api-test-session-secret-long-enough';
const envBase = { AEGIS_PASSWORD: 'test-password-long-enough', AEGIS_SESSION_SECRET: secret };
const path = {
  id: 'javascript-foundations',
  version: '1.0.0',
  title: 'JavaScript Foundations',
  description: 'A small test path.',
  nodes: [{
    id: 'javascript-basics',
    title: 'JavaScript basics',
    outcomes: ['Explain variables'],
    prerequisites: [],
    difficulty: 'beginner',
    sourceRefs: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
    contentLicenseStatus: 'link-only',
  }],
};

function canonicalJson(value) {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonicalJson(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

class MasteryD1 {
  constructor() {
    this.pathRow = {
      owner_id: 'owner',
      path_id: path.id,
      version: path.version,
      graph_digest: createHash('sha256').update(canonicalJson(path)).digest('hex'),
      graph_json: canonicalJson(path),
      created_at: '2026-11-18T00:00:00.000Z',
    };
  }
  prepare(sql) {
    const db = this;
    return {
      values: [],
      bind(...values) { this.values = values; return this; },
      async first() {
        if (sql.includes('FROM learning_paths')) return db.pathRow;
        if (sql.includes('COUNT(*) AS total')) return { total: 0 };
        return null;
      },
      async all() { return { results: [] }; },
    };
  }
}

async function makeRequest(query, { authenticated = true } = {}) {
  const headers = {};
  if (authenticated) headers.Cookie = '__Host-aegis_session=' + await createSessionToken(secret);
  return new Request('https://aegis.example/api/learning/mastery' + query, { headers });
}

test('Learning Mastery diagnostic requires authentication', async () => {
  const response = await onRequestGet({
    request: await makeRequest('?pathId=javascript-foundations&pathVersion=1.0.0&nodeId=javascript-basics', { authenticated: false }),
    env: { ...envBase, AEGIS_DB: new MasteryD1() },
  });
  assert.equal(response.status, 401);
});

test('Learning Mastery diagnostic rejects missing, repeated and unsupported query parameters', async () => {
  const db = new MasteryD1();
  for (const query of [
    '',
    '?pathId=javascript-foundations&pathVersion=1.0.0',
    '?pathId=javascript-foundations&pathId=javascript-foundations&pathVersion=1.0.0&nodeId=javascript-basics',
    '?pathId=javascript-foundations&pathVersion=1.0.0&nodeId=javascript-basics&ownerId=attacker',
  ]) {
    const response = await onRequestGet({
      request: await makeRequest(query),
      env: { ...envBase, AEGIS_DB: db },
    });
    assert.equal(response.status, 400, query);
  }
});

test('Learning Mastery diagnostic fails closed when storage is unavailable', async () => {
  const response = await onRequestGet({
    request: await makeRequest('?pathId=javascript-foundations&pathVersion=1.0.0&nodeId=javascript-basics'),
    env: envBase,
  });
  assert.equal(response.status, 503);
});

test('Learning Mastery diagnostic returns evidence gaps without claiming verified mastery', async () => {
  const response = await onRequestGet({
    request: await makeRequest('?pathId=javascript-foundations&pathVersion=1.0.0&nodeId=javascript-basics'),
    env: { ...envBase, AEGIS_DB: new MasteryD1() },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  const body = await response.json();
  assert.equal(body.candidate.status, 'insufficient_evidence');
  assert.equal(body.candidate.masteryVerified, false);
  assert.ok(body.candidate.missing.includes('two_distinct_passed_attempts'));
  assert.ok(body.unavailableEvidenceKinds.includes('applied_task'));
  assert.ok(body.unavailableEvidenceKinds.includes('human_review'));
});
