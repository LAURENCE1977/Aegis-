import test from 'node:test';
import assert from 'node:assert/strict';
import { registerLearningPath, listLearningPaths } from '../functions/lib/learning-forge.mjs';

class LearningPathD1 {
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

const path = () => ({
  id: 'javascript-foundations',
  version: '1.0.0',
  title: 'JavaScript Foundations',
  description: 'A beginner path for practical JavaScript.',
  nodes: [
    {
      id: 'javascript-basics', title: 'JavaScript basics',
      outcomes: ['Explain variables', 'Write a pure function'],
      prerequisites: [], difficulty: 'beginner',
      sourceRefs: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      contentLicenseStatus: 'link-only',
    },
    {
      id: 'javascript-functions', title: 'Functions',
      outcomes: ['Define functions', 'Use parameters'],
      prerequisites: ['javascript-basics'], difficulty: 'beginner',
      sourceRefs: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Functions'],
      contentLicenseStatus: 'link-only',
    },
  ],
});

test('registers immutable owner-scoped learning path versions with graph digest and audit event', async () => {
  const db = new LearningPathD1();
  const result = await registerLearningPath(db, 'owner', path(), Date.parse('2026-11-17T12:00:00.000Z'));
  assert.equal(result.created, true);
  assert.equal(result.path.id, 'javascript-foundations');
  assert.equal(result.path.nodes.length, 2);
  assert.match(result.digest, /^[a-f0-9]{64}$/);
  assert.equal(db.events.length, 1);
});

test('learning path registration is idempotent independent of object key order', async () => {
  const db = new LearningPathD1();
  const first = await registerLearningPath(db, 'owner', path());
  const input = path();
  input.title = 'JavaScript Foundations';
  input.nodes = input.nodes.map(node => Object.fromEntries(Object.entries(node).reverse()));
  const second = await registerLearningPath(db, 'owner', input);
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(first.digest, second.digest);
  assert.equal(db.rows.size, 1);
  assert.equal(db.events.length, 1);
});

test('rejects conflicting content for an existing learning path version', async () => {
  const db = new LearningPathD1();
  await registerLearningPath(db, 'owner', path());
  const changed = path();
  changed.description = 'Changed after registration';
  await assert.rejects(registerLearningPath(db, 'owner', changed), /already exists with different content/i);
});

test('rejects invalid graphs, unsafe owner identifiers and invalid clocks before persistence', async () => {
  const db = new LearningPathD1();
  await assert.rejects(registerLearningPath(db, '../owner', path()), /owner/i);
  const cyclic = path();
  cyclic.nodes[0].prerequisites = ['javascript-functions'];
  await assert.rejects(registerLearningPath(db, 'owner', cyclic), /cycle/i);
  await assert.rejects(registerLearningPath(db, 'owner', path(), Number.NaN), /clock/i);
  assert.equal(db.rows.size, 0);
});

test('lists only the authenticated owner paths with a bounded page size', async () => {
  const db = new LearningPathD1();
  await registerLearningPath(db, 'owner', path());
  await registerLearningPath(db, 'another-owner', { ...path(), title: 'Other owner path' });
  const listed = await listLearningPaths(db, 'owner', 10);
  assert.equal(listed.length, 1);
  assert.equal(listed[0].ownerId, 'owner');
  await assert.rejects(listLearningPaths(db, 'owner', 101), /limit/i);
});


test('learning path catalogue rejects stored graph content whose digest no longer matches', async () => {
  const db = new LearningPathD1();
  await registerLearningPath(db, 'owner', path());
  const row = [...db.rows.values()][0];
  row.graph_json = JSON.stringify({ ...path(), description: 'Tampered after registration' });
  await assert.rejects(listLearningPaths(db, 'owner', 10), /digest/i);
});

test('learning path catalogue rejects malformed stored graph digests', async () => {
  const db = new LearningPathD1();
  await registerLearningPath(db, 'owner', path());
  const row = [...db.rows.values()][0];
  row.graph_digest = 'not-a-sha256';
  await assert.rejects(listLearningPaths(db, 'owner', 10), /digest/i);
});
