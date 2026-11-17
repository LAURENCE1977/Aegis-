import test from 'node:test';
import assert from 'node:assert/strict';
import {
  registerLearningAssessment,
  listLearningAssessments,
} from '../functions/lib/learning-assessment-store.mjs';

class LearningAssessmentD1 {
  constructor() {
    this.paths = new Map();
    this.assessments = new Map();
    this.events = [];
  }
  prepare(sql) {
    const db = this;
    return {
      values: [],
      bind(...values) { this.values = values; return this; },
      async run() {
        if (sql.includes('INSERT INTO learning_assessments')) {
          const [id, owner, assessmentId, version, pathId, pathVersion, nodeId, digest, json, createdAt] = this.values;
          const key = [owner, assessmentId, version].join('|');
          if (db.assessments.has(key)) return { meta: { changes: 0 } };
          const row = { id, owner_id: owner, assessment_id: assessmentId, version,
            path_id: pathId, path_version: pathVersion, node_id: nodeId,
            assessment_digest: digest, assessment_json: json, created_at: createdAt };
          db.assessments.set(key, row);
          db.events.push({ owner_id: owner, assessment_id: assessmentId, version, event_type: 'registered' });
          return { meta: { changes: 1 } };
        }
        return { meta: { changes: 0 } };
      },
      async first() {
        if (sql.includes('FROM learning_paths')) {
          const [owner, pathId, version] = this.values;
          return db.paths.get([owner, pathId, version].join('|')) ?? null;
        }
        if (sql.includes('FROM learning_assessments')) {
          const [owner, assessmentId, version] = this.values;
          return db.assessments.get([owner, assessmentId, version].join('|')) ?? null;
        }
        return null;
      },
      async all() {
        const [owner, limit] = this.values;
        return { results: [...db.assessments.values()]
          .filter(row => row.owner_id === owner)
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .slice(0, limit) };
      },
    };
  }
}

const path = {
  id: 'javascript-foundations', version: '1.0.0', title: 'JavaScript foundations',
  description: 'A short path', nodes: [{ id: 'javascript-basics', title: 'Basics', prerequisites: [], sources: [] }],
};
const assessment = {
  id: 'javascript-basics-check', version: '1.0.0', pathId: path.id,
  pathVersion: path.version, nodeId: 'javascript-basics', title: 'Basics check', passPercent: 80,
  questions: [{ id: 'q1', prompt: 'Which keyword declares a block-scoped variable?',
    options: ['var', 'let', 'goto', 'define'], points: 1, correctOption: 'b' }],
};
function database() {
  const db = new LearningAssessmentD1();
  db.paths.set(['owner', path.id, path.version].join('|'), {
    owner_id: 'owner', path_id: path.id, version: path.version,
    graph_json: JSON.stringify(path),
  });
  return db;
}

test('registers an assessment only against an exact registered path version and node', async () => {
  const db = database();
  const result = await registerLearningAssessment(db, 'owner', assessment, Date.parse('2026-11-17T12:00:00Z'));
  assert.equal(result.created, true);
  assert.equal(result.assessment.id, assessment.id);
  assert.match(result.digest, /^[a-f0-9]{64}$/);
  assert.equal(db.events.length, 1);
});

test('rejects missing path versions and nodes rather than silently binding to latest', async () => {
  const db = database();
  await assert.rejects(registerLearningAssessment(db, 'owner', { ...assessment, pathVersion: '2.0.0' }), /registered path/i);
  await assert.rejects(registerLearningAssessment(db, 'owner', { ...assessment, nodeId: 'unknown-node' }), /node/i);
  assert.equal(db.assessments.size, 0);
});

test('registration is idempotent and conflicting content cannot replace an immutable version', async () => {
  const db = database();
  const first = await registerLearningAssessment(db, 'owner', assessment);
  const second = await registerLearningAssessment(db, 'owner', { ...assessment, questions: assessment.questions.map(q => ({ ...q })) });
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(second.digest, first.digest);
  const changed = { ...assessment, passPercent: 90 };
  await assert.rejects(registerLearningAssessment(db, 'owner', changed), /already exists with different content/i);
  assert.equal(db.events.length, 1);
});

test('learner catalogue never returns answer keys or pass thresholds', async () => {
  const db = database();
  await registerLearningAssessment(db, 'owner', assessment);
  const records = await listLearningAssessments(db, 'owner', 10);
  assert.equal(records.length, 1);
  assert.equal(records[0].assessment.questions[0].prompt, assessment.questions[0].prompt);
  assert.equal('correctOption' in records[0].assessment.questions[0], false);
  assert.equal('passPercent' in records[0].assessment, false);
  assert.equal(JSON.stringify(records).includes('correctOption'), false);
});

test('assessment records are owner-scoped and page size is bounded', async () => {
  const db = database();
  await registerLearningAssessment(db, 'owner', assessment);
  db.paths.set(['other-owner', path.id, path.version].join('|'), {
    owner_id: 'other-owner', path_id: path.id, version: path.version,
    graph_json: JSON.stringify(path),
  });
  await registerLearningAssessment(db, 'other-owner', assessment);
  assert.equal((await listLearningAssessments(db, 'owner', 10)).length, 1);
  await assert.rejects(listLearningAssessments(db, 'owner', 101), /limit/i);
});


test('catalogue rejects stored assessment content whose digest no longer matches', async () => {
  const db = database();
  await registerLearningAssessment(db, 'owner', assessment);
  const row = [...db.assessments.values()][0];
  row.assessment_json = JSON.stringify({ ...assessment, title: 'Tampered after registration' });
  await assert.rejects(listLearningAssessments(db, 'owner', 10), /digest/i);
});

test('catalogue rejects a malformed stored digest rather than presenting corrupted content', async () => {
  const db = database();
  await registerLearningAssessment(db, 'owner', assessment);
  const row = [...db.assessments.values()][0];
  row.assessment_digest = 'not-a-sha256';
  await assert.rejects(listLearningAssessments(db, 'owner', 10), /digest/i);
});
