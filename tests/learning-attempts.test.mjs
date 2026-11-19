import test from 'node:test';
import assert from 'node:assert/strict';
import { registerLearningAssessment } from '../functions/lib/learning-assessment-store.mjs';
import { registerLearningPath } from '../functions/lib/learning-forge.mjs';
import { loadLearningMasteryEvidence, buildLearningMasteryCandidateFromStore } from '../functions/lib/learning-mastery-evidence-store.mjs';
import {
  submitLearningAttempt,
  listLearningAttempts,
} from '../functions/lib/learning-attempts.mjs';

const pathDefinition = {
  id: 'javascript-foundations', version: '1.0.0', title: 'JavaScript foundations',
  description: 'A short path', nodes: [{
    id: 'javascript-basics', title: 'Basics', outcomes: ['Understand values'],
    prerequisites: [], difficulty: 'beginner',
    sourceRefs: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
    contentLicenseStatus: 'link-only',
  }],
};
const assessment = {
  id: 'javascript-basics-check', version: '1.0.0', pathId: pathDefinition.id,
  pathVersion: pathDefinition.version, nodeId: 'javascript-basics',
  title: 'Basics check', passPercent: 80,
  questions: [
    { id: 'q1', prompt: 'Which keyword declares a block-scoped variable?',
      options: ['var', 'let', 'goto', 'define'], points: 2, correctOption: 'b' },
    { id: 'q2', prompt: 'Which value is boolean true?',
      options: ['0', 'false', 'true', 'null'], points: 1, correctOption: 'c' },
  ],
};

class AttemptD1 {
  constructor() { this.paths = new Map(); this.assessments = new Map(); this.attempts = []; }
  prepare(sql) {
    const db = this;
    return {
      values: [],
      bind(...values) { this.values = values; return this; },
      async run() {
        if (sql.includes('INSERT INTO learning_paths')) {
          const [id, owner, pathId, version, digest, json, createdAt] = this.values;
          const key = [owner, pathId, version].join('|');
          if (db.paths.has(key)) return { meta: { changes: 0 } };
          db.paths.set(key, { id, owner_id: owner, path_id: pathId, version,
            graph_digest: digest, graph_json: json, created_at: createdAt });
          return { meta: { changes: 1 } };
        }
        if (sql.includes('INSERT INTO learning_assessments')) {
          const [id, owner, assessmentId, version, pathId, pathVersion, nodeId, digest, json, createdAt] = this.values;
          const key = [owner, assessmentId, version].join('|');
          if (db.assessments.has(key)) return { meta: { changes: 0 } };
          db.assessments.set(key, { id, owner_id: owner, assessment_id: assessmentId, version,
            path_id: pathId, path_version: pathVersion, node_id: nodeId,
            assessment_digest: digest, assessment_json: json, created_at: createdAt });
          return { meta: { changes: 1 } };
        }
        if (sql.includes('INSERT INTO learning_assessment_attempts')) {
          const [id, owner, assessmentId, version, pathId, pathVersion, nodeId,
            assessmentDigest, resultJson, scorePercent, passed, occurredAt] = this.values;
          const recent = db.attempts.filter(row => row.owner_id === owner &&
            row.assessment_id === assessmentId && row.assessment_version === version);
          if (recent.some(row => Date.parse(row.occurred_at) > Date.parse(occurredAt) - 30000) ||
              recent.filter(row => Date.parse(row.occurred_at) > Date.parse(occurredAt) - 900000).length >= 5) {
            throw new Error('Learning Assessment attempt rate limit exceeded');
          }
          db.attempts.push({ id, owner_id: owner, assessment_id: assessmentId,
            assessment_version: version, path_id: pathId, path_version: pathVersion,
            node_id: nodeId, assessment_digest: assessmentDigest,
            result_json: resultJson, score_percent: scorePercent, passed, mastery_verified: 0, occurred_at: occurredAt });
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
        if (sql.includes('COUNT(*) AS total')) {
          const [owner, assessmentId, version] = this.values;
          return { total: db.attempts.filter(row => row.owner_id === owner &&
            row.assessment_id === assessmentId && row.assessment_version === version).length };
        }
        if (sql.includes('FROM learning_assessment_attempts')) {
          const [owner, id] = this.values;
          return db.attempts.find(row => row.owner_id === owner && row.id === id) ?? null;
        }
        return null;
      },
      async all() {
        if (sql.includes('FROM learning_paths')) {
          const [owner, limit] = this.values;
          return { results: [...db.paths.values()].filter(row => row.owner_id === owner).slice(0, limit) };
        }
        if (sql.includes('FROM learning_assessments')) {
          const [owner, pathId, pathVersion, nodeId, limit] = this.values;
          return { results: [...db.assessments.values()].filter(row => row.owner_id === owner &&
            row.path_id === pathId && row.path_version === pathVersion && row.node_id === nodeId).slice(0, limit) };
        }
        if (sql.includes('FROM learning_applied_task_evidence')) return { results: [] };
        const [owner, assessmentId, version, limit] = this.values;
        return { results: db.attempts.filter(row => row.owner_id === owner &&
          row.assessment_id === assessmentId && row.assessment_version === version)
          .sort((a,b) => b.occurred_at.localeCompare(a.occurred_at)).slice(0,limit) };
      },
    };
  }
}

async function setup() {
  const db = new AttemptD1();
  await registerLearningPath(db, 'owner', pathDefinition, Date.parse('2026-11-17T09:00:00.000Z'));
  await registerLearningAssessment(db, 'owner', assessment, Date.parse('2026-11-17T09:01:00.000Z'));
  return db;
}

test('loads mastery evidence only from verified owner-scoped path, assessment and attempt stores', async () => {
  const db = await setup();
  const base = Date.parse('2026-11-17T12:00:00.000Z');
  await submitLearningAttempt(db, 'owner', assessment.id, assessment.version,
    { q1: 'b', q2: 'c' }, base);
  const loaded = await loadLearningMasteryEvidence(
    db, 'owner', pathDefinition.id, pathDefinition.version, 'javascript-basics', base + 1000,
  );
  assert.equal(loaded.path.id, pathDefinition.id);
  assert.equal(loaded.evidence.length, 1);
  assert.equal(loaded.evidence[0].kind, 'assessment_pass');
  assert.equal(loaded.evidence[0].passed, true);
  assert.equal(loaded.evidence[0].masteryVerified, false);
  assert.deepEqual(loaded.unavailableEvidenceKinds, ['human_review']);
});

test('store-backed mastery candidate cannot be completed by caller-injected task or reviewer claims', async () => {
  const db = await setup();
  const base = Date.parse('2026-11-17T12:00:00.000Z');
  await submitLearningAttempt(db, 'owner', assessment.id, assessment.version,
    { q1: 'b', q2: 'c' }, base);
  const candidate = await buildLearningMasteryCandidateFromStore(
    db, 'owner', pathDefinition.id, pathDefinition.version, 'javascript-basics', base + 1000,
  );
  assert.equal(candidate.status, 'insufficient_evidence');
  assert.equal(candidate.masteryVerified, false);
  assert.ok(candidate.missing.includes('applied_task_evidence'));
  assert.ok(candidate.missing.includes('independent_human_review_of_all_evidence'));
});

test('store-backed mastery evidence rejects another owner and tampered path or assessment records', async () => {
  const db = await setup();
  await assert.rejects(loadLearningMasteryEvidence(
    db, 'another-owner', pathDefinition.id, pathDefinition.version, 'javascript-basics',
  ), /not found/i);
  const key = ['owner', assessment.id, assessment.version].join('|');
  const row = db.assessments.get(key);
  db.assessments.set(key, { ...row, assessment_json: JSON.stringify({ ...assessment, title: 'tampered' }) });
  await assert.rejects(loadLearningMasteryEvidence(
    db, 'owner', pathDefinition.id, pathDefinition.version, 'javascript-basics',
  ), /digest/i);
});

test('submits a server-scored attempt against an immutable registered assessment', async () => {
  const db = await setup();
  const result = await submitLearningAttempt(db, 'owner', assessment.id, assessment.version,
    { q1: 'b', q2: 'c' }, Date.parse('2026-11-17T12:00:00.000Z'));
  assert.equal(result.scorePercent, 100);
  assert.equal(result.passed, true);
  assert.equal(result.masteryVerified, false);
  assert.match(result.attemptId, /^learning-attempt-/);
  assert.equal(db.attempts.length, 1);
});

test('attempt persistence stores neither raw learner answers nor reversible answer digests', async () => {
  const db = await setup();
  await submitLearningAttempt(db, 'owner', assessment.id, assessment.version,
    { q1: 'b', q2: 'a' }, Date.parse('2026-11-17T12:00:00.000Z'));
  const stored = JSON.stringify(db.attempts[0]);
  assert.equal(stored.includes('"q1":"b"'), false);
  assert.equal(stored.includes('"q2":"a"'), false);
  assert.equal('attempt_digest' in db.attempts[0], false);
});

test('rejects unregistered versions, missing answers and extra answer fields', async () => {
  const db = await setup();
  await assert.rejects(submitLearningAttempt(db, 'owner', assessment.id, '2.0.0',
    { q1: 'b', q2: 'c' }), /not found/i);
  await assert.rejects(submitLearningAttempt(db, 'owner', assessment.id, assessment.version,
    { q1: 'b' }), /exactly one answer/i);
  await assert.rejects(submitLearningAttempt(db, 'owner', assessment.id, assessment.version,
    { q1: 'b', q2: 'c', injected: 'a' }), /exactly one answer/i);
  assert.equal(db.attempts.length, 0);
});

test('enforces cooldown and rolling attempt limits per owner and assessment version', async () => {
  const db = await setup();
  const base = Date.parse('2026-11-17T12:00:00.000Z');
  await submitLearningAttempt(db, 'owner', assessment.id, assessment.version,
    { q1: 'b', q2: 'c' }, base);
  await assert.rejects(submitLearningAttempt(db, 'owner', assessment.id, assessment.version,
    { q1: 'b', q2: 'c' }, base + 10000), /rate limit/i);
  for (let i = 1; i < 5; i++) {
    await submitLearningAttempt(db, 'owner', assessment.id, assessment.version,
      { q1: 'b', q2: 'c' }, base + i * 31000);
  }
  await assert.rejects(submitLearningAttempt(db, 'owner', assessment.id, assessment.version,
    { q1: 'b', q2: 'c' }, base + 5 * 31000), /rate limit/i);
});

test('refuses to list attempts when their immutable assessment content no longer matches its digest', async () => {
  const db = await setup();
  const base = Date.parse('2026-11-17T12:00:00.000Z');
  await submitLearningAttempt(db, 'owner', assessment.id, assessment.version,
    { q1: 'b', q2: 'c' }, base);
  const key = ['owner', assessment.id, assessment.version].join('|');
  const stored = db.assessments.get(key);
  db.assessments.set(key, {
    ...stored,
    assessment_json: JSON.stringify({ ...assessment, title: 'tampered assessment' }),
  });
  await assert.rejects(
    listLearningAttempts(db, 'owner', assessment.id, assessment.version, 10),
    /digest/i,
  );
});

test('refuses attempt history whose recorded assessment digest differs from the registry', async () => {
  const db = await setup();
  const base = Date.parse('2026-11-17T12:00:00.000Z');
  await submitLearningAttempt(db, 'owner', assessment.id, assessment.version,
    { q1: 'b', q2: 'c' }, base);
  db.attempts[0].assessment_digest = 'f'.repeat(64);
  await assert.rejects(
    listLearningAttempts(db, 'owner', assessment.id, assessment.version, 10),
    /digest/i,
  );
});

test('lists private attempt history without answers or answer digests', async () => {
  const db = await setup();
  const base = Date.parse('2026-11-17T12:00:00.000Z');
  await submitLearningAttempt(db, 'owner', assessment.id, assessment.version,
    { q1: 'b', q2: 'c' }, base);
  const records = await listLearningAttempts(db, 'owner', assessment.id, assessment.version, 10);
  assert.equal(records.length, 1);
  assert.equal(records[0].scorePercent, 100);
  assert.equal(records[0].masteryVerified, false);
  assert.equal('attemptDigest' in records[0], false);
  assert.equal(JSON.stringify(records).includes('correctOption'), false);
  await assert.rejects(listLearningAttempts(db, 'owner', assessment.id, assessment.version, 101), /limit/i);
});
