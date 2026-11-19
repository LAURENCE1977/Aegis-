import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createSessionToken } from '../functions/lib/auth.mjs';
import { onRequestGet, onRequestPost } from '../functions/api/learning/paths/[id]/evidence.js';
import { onRequestDelete } from '../functions/api/learning/paths/[id]/evidence/[evidenceId].js';

const secret = 'learning-applied-evidence-api-test-secret-long-enough';
const envBase = { AEGIS_PASSWORD: 'test-password-long-enough', AEGIS_SESSION_SECRET: secret };
const path = {
  id: 'javascript-foundations', version: '1.0.0',
  title: 'JavaScript Foundations', description: 'Test path',
  nodes: [{
    id: 'javascript-basics', title: 'JavaScript basics',
    outcomes: ['Explain variables'], prerequisites: [], difficulty: 'beginner',
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
class EvidenceD1 {
  constructor({ nodeCount = 0, ownerCount = 0 } = {}) {
    this.nodeCount = nodeCount;
    this.ownerCount = ownerCount;
    this.pathRow = {
      owner_id: 'owner', path_id: path.id, version: path.version,
      graph_digest: createHash('sha256').update(canonicalJson(path)).digest('hex'),
      graph_json: canonicalJson(path), created_at: '2026-11-18T00:00:00.000Z',
    };
    this.inserted = null;
    this.deleted = null;
    this.receipts = [];
  }
  prepare(sql) {
    const db = this;
    return {
      values: [],
      bind(...values) { this.values = values; return this; },
      async first() {
        if (sql.includes('FROM learning_paths')) return db.pathRow;
        if (sql.includes('COUNT(*) AS total')) return { total: sql.includes('node_id = ?') ? db.nodeCount : db.ownerCount };
        return null;
      },
      async all() {
        if (sql.includes('FROM learning_applied_task_evidence')) {
          const [owner, pathId, pathVersion, nodeId, limit] = this.values;
          return { results: db.receipts.filter(row => row.owner_id === owner && row.path_id === pathId &&
            row.path_version === pathVersion && row.node_id === nodeId).slice(0, limit) };
        }
        return { results: [] };
      },
      async run() {
        if (sql.includes('INSERT INTO learning_applied_task_evidence')) db.inserted = this.values;
        if (sql.includes('DELETE FROM learning_applied_task_evidence')) db.deleted = this.values;
        return { meta: { changes: 1 } };
      },
    };
  }
}
async function request(url, { method = 'POST', body = new TextEncoder().encode('work sample'), contentType = 'application/pdf', authenticated = true, origin = 'https://aegis.example' } = {}) {
  const headers = { Origin: origin, 'Content-Type': contentType };
  if (authenticated) headers.Cookie = '__Host-aegis_session=' + await createSessionToken(secret);
  return new Request(url, { method, headers, body: method === 'DELETE' ? undefined : body });
}
const routeParams = { id: path.id };

test('applied-task evidence intake requires an authenticated same-origin owner', async () => {
  const db = new EvidenceD1();
  const response = await onRequestPost({
    request: await request('https://aegis.example/api/learning/paths/javascript-foundations/evidence?version=1.0.0&nodeId=javascript-basics', { authenticated: false }),
    env: { ...envBase, AEGIS_DB: db }, params: routeParams,
  });
  assert.equal(response.status, 401);
});

test('stores a server-computed digest receipt without retaining the uploaded artifact', async () => {
  const db = new EvidenceD1();
  const bytes = new TextEncoder().encode('learner work');
  const response = await onRequestPost({
    request: await request('https://aegis.example/api/learning/paths/javascript-foundations/evidence?version=1.0.0&nodeId=javascript-basics', { body: bytes }),
    env: { ...envBase, AEGIS_DB: db }, params: routeParams,
  });
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.evidence.artifactDigest, createHash('sha256').update(bytes).digest('hex'));
  assert.equal(body.evidence.byteLength, bytes.byteLength);
  assert.equal(body.contentRetained, false);
  assert.equal(body.mediaTypeVerified, false);
  assert.equal(body.masteryVerified, false);
  assert.equal(db.inserted[5], body.evidence.artifactDigest);
  assert.equal(db.inserted[6], bytes.byteLength);
  assert.equal(db.inserted[7], 'application/pdf');
  assert.equal(db.inserted.length, 9);
  assert.equal(JSON.stringify(db.inserted).includes('learner work'), false);
});

test('rejects unsupported media types and cross-origin submissions before persistence', async () => {
  const db = new EvidenceD1();
  const url = 'https://aegis.example/api/learning/paths/javascript-foundations/evidence?version=1.0.0&nodeId=javascript-basics';
  const unsupported = await onRequestPost({
    request: await request(url, { contentType: 'text/html' }),
    env: { ...envBase, AEGIS_DB: db }, params: routeParams,
  });
  assert.equal(unsupported.status, 400);
  const crossOrigin = await onRequestPost({
    request: await request(url, { origin: 'https://attacker.example' }),
    env: { ...envBase, AEGIS_DB: db }, params: routeParams,
  });
  assert.equal(crossOrigin.status, 403);
  assert.equal(db.inserted, null);
});

test('lists only exact owner/path/node evidence receipts without exposing artifact content', async () => {
  const db = new EvidenceD1();
  db.receipts.push({
    id: 'evidence-' + 'a'.repeat(32), owner_id: 'owner',
    path_id: path.id, path_version: path.version, node_id: 'javascript-basics',
    artifact_digest: 'b'.repeat(64), byte_length: 128,
    media_type: 'application/pdf', submitted_at: '2026-11-19T08:00:00.000Z',
  }, {
    id: 'evidence-' + 'c'.repeat(32), owner_id: 'another-owner',
    path_id: path.id, path_version: path.version, node_id: 'javascript-basics',
    artifact_digest: 'd'.repeat(64), byte_length: 128,
    media_type: 'application/pdf', submitted_at: '2026-11-19T08:01:00.000Z',
  });
  const response = await onRequestGet({
    request: await request('https://aegis.example/api/learning/paths/javascript-foundations/evidence?version=1.0.0&nodeId=javascript-basics', { method: 'GET' }),
    env: { ...envBase, AEGIS_DB: db }, params: routeParams,
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.evidence.length, 1);
  assert.equal(body.evidence[0].id, 'evidence-' + 'a'.repeat(32));
  assert.equal(body.evidence[0].artifactDigest, 'b'.repeat(64));
  assert.equal(body.contentRetained, false);
  assert.equal(body.masteryVerified, false);
});

test('enforces the 25-receipt per-node quota before creating a receipt', async () => {
  const db = new EvidenceD1({ nodeCount: 25 });
  const response = await onRequestPost({
    request: await request('https://aegis.example/api/learning/paths/javascript-foundations/evidence?version=1.0.0&nodeId=javascript-basics'),
    env: { ...envBase, AEGIS_DB: db }, params: routeParams,
  });
  assert.equal(response.status, 429);
  assert.equal(db.inserted, null);
});

test('withdrawal is owner-scoped and returns only a non-certifying receipt status', async () => {
  const db = new EvidenceD1();
  const evidenceId = 'evidence-' + 'a'.repeat(32);
  const response = await onRequestDelete({
    request: await request('https://aegis.example/api/learning/paths/javascript-foundations/evidence/' + evidenceId + '?version=1.0.0&nodeId=javascript-basics', { method: 'DELETE' }),
    env: { ...envBase, AEGIS_DB: db }, params: { ...routeParams, evidenceId },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { withdrawn: true, masteryVerified: false });
  assert.deepEqual(db.deleted, [evidenceId, 'owner', path.id, path.version, 'javascript-basics']);
});
