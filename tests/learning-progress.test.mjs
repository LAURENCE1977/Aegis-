import test from 'node:test';
import assert from 'node:assert/strict';
import { registerLearningPath } from '../functions/lib/learning-forge.mjs';
import {
  updateLearningProgress,
  listLearningProgress,
} from '../functions/lib/learning-progress.mjs';

class LearningProgressD1 {
  constructor() { this.paths = new Map(); this.progress = new Map(); this.events = []; }
  prepare(sql) {
    const db = this;
    return {
      values: [],
      bind(...values) { this.values = values; return this; },
      async run() {
        const v = this.values;
        if (sql.includes('INSERT INTO learning_paths')) {
          const [id, owner, pathId, version, digest, json, createdAt] = v;
          db.paths.set(owner + '|' + pathId + '|' + version, {
            id, owner_id: owner, path_id: pathId, version,
            graph_digest: digest, graph_json: json, created_at: createdAt,
          });
          return { meta: { changes: 1 } };
        }
        if (sql.includes('INSERT INTO learning_progress')) {
          const [owner, pathId, version, nodeId, status, createdAt, updatedAt] = v;
          const key = [owner, pathId, version, nodeId].join('|');
          if (db.progress.has(key)) return { meta: { changes: 0 } };
          db.progress.set(key, { owner_id: owner, path_id: pathId, path_version: version, node_id: nodeId, status, created_at: createdAt, updated_at: updatedAt });
          db.events.push({ node_id: nodeId, from_status: 'not_started', to_status: status });
          return { meta: { changes: 1 } };
        }
        if (sql.includes('UPDATE learning_progress')) {
          const [status, updatedAt, owner, pathId, version, nodeId, expected] = v;
          const key = [owner, pathId, version, nodeId].join('|');
          const row = db.progress.get(key);
          if (!row || row.updated_at !== expected) return { meta: { changes: 0 } };
          const from = row.status;
          row.status = status;
          row.updated_at = updatedAt;
          db.events.push({ node_id: nodeId, from_status: from, to_status: status });
          return { meta: { changes: 1 } };
        }
        return { meta: { changes: 0 } };
      },
      async first() {
        const v = this.values;
        if (sql.includes('FROM learning_paths')) return db.paths.get(v[0] + '|' + v[1] + '|' + v[2]) ?? null;
        if (sql.includes('FROM learning_progress')) return db.progress.get([v[0],v[1],v[2],v[3]].join('|')) ?? null;
        return null;
      },
      async all() {
        const [owner, pathId, version] = this.values;
        return { results: [...db.progress.values()].filter(row => row.owner_id === owner && row.path_id === pathId && row.path_version === version) };
      },
    };
  }
}

const path = {
  id: 'javascript-foundations', version: '1.0.0',
  title: 'JavaScript Foundations', description: 'A beginner path.',
  nodes: [
    { id: 'javascript-basics', title: 'JavaScript basics', outcomes: ['Explain variables'], prerequisites: [], difficulty: 'beginner', sourceRefs: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'], contentLicenseStatus: 'link-only' },
    { id: 'javascript-functions', title: 'Functions', outcomes: ['Define functions'], prerequisites: ['javascript-basics'], difficulty: 'beginner', sourceRefs: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Functions'], contentLicenseStatus: 'link-only' },
  ],
};

async function setup() {
  const db = new LearningProgressD1();
  await registerLearningPath(db, 'owner', path, Date.parse('2026-11-17T12:00:00.000Z'));
  return db;
}

test('records owner-scoped progress and appends an event without claiming verified mastery', async () => {
  const db = await setup();
  const result = await updateLearningProgress(db, 'owner', path.id, path.version, 'javascript-basics', 'in_progress', null, Date.parse('2026-11-17T12:01:00.000Z'));
  assert.equal(result.status, 'in_progress');
  assert.equal(result.masteryVerified, false);
  assert.equal(db.events.length, 1);
});

test('blocks a learner from starting or completing a node before prerequisites are self-reported complete', async () => {
  const db = await setup();
  await assert.rejects(
    updateLearningProgress(db, 'owner', path.id, path.version, 'javascript-functions', 'in_progress', null, Date.parse('2026-11-17T12:01:00.000Z')),
    /prerequisite/i,
  );
  assert.equal(db.progress.size, 0);
});

test('requires exact optimistic concurrency and advances only allowed progress transitions', async () => {
  const db = await setup();
  const started = await updateLearningProgress(db, 'owner', path.id, path.version, 'javascript-basics', 'in_progress', null, Date.parse('2026-11-17T12:01:00.000Z'));
  await assert.rejects(
    updateLearningProgress(db, 'owner', path.id, path.version, 'javascript-basics', 'self_reported_complete', null, Date.parse('2026-11-17T12:02:00.000Z')),
    /changed|expected/i,
  );
  const completed = await updateLearningProgress(db, 'owner', path.id, path.version, 'javascript-basics', 'self_reported_complete', started.updatedAt, Date.parse('2026-11-17T12:02:00.000Z'));
  assert.equal(completed.status, 'self_reported_complete');
  assert.equal(completed.masteryVerified, false);
  await assert.rejects(
    updateLearningProgress(db, 'owner', path.id, path.version, 'javascript-basics', 'not_started', completed.updatedAt, Date.parse('2026-11-17T12:03:00.000Z')),
    /transition/i,
  );
});

test('unlocks downstream nodes only after prerequisite self-report and lists owner progress', async () => {
  const db = await setup();
  const started = await updateLearningProgress(db, 'owner', path.id, path.version, 'javascript-basics', 'in_progress', null, Date.parse('2026-11-17T12:01:00.000Z'));
  const completed = await updateLearningProgress(db, 'owner', path.id, path.version, 'javascript-basics', 'self_reported_complete', started.updatedAt, Date.parse('2026-11-17T12:02:00.000Z'));
  const next = await updateLearningProgress(db, 'owner', path.id, path.version, 'javascript-functions', 'in_progress', null, Date.parse('2026-11-17T12:03:00.000Z'));
  assert.equal(next.status, 'in_progress');
  const listed = await listLearningProgress(db, 'owner', path.id, path.version);
  assert.equal(listed.length, 2);
  assert.equal(listed.find(item => item.nodeId === 'javascript-basics').status, 'self_reported_complete');
  assert.equal(completed.masteryVerified, false);
});

test('rejects missing paths, unknown nodes and unbounded page sizes', async () => {
  const db = await setup();
  await assert.rejects(updateLearningProgress(db, 'owner', 'missing-path', '1.0.0', 'javascript-basics', 'in_progress', null), /not found/i);
  await assert.rejects(updateLearningProgress(db, 'owner', path.id, path.version, 'missing-node', 'in_progress', null), /node/i);
  await assert.rejects(listLearningProgress(db, 'owner', path.id, path.version, 101), /limit/i);
});
