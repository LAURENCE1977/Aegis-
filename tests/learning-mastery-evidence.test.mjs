import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLearningMasteryCandidate } from '../functions/lib/learning-mastery-evidence.mjs';

const path = {
  id: 'javascript-foundations', version: '1.0.0',
  nodes: [{
    id: 'basics', title: 'JavaScript basics', outcomes: ['Understand values'],
    prerequisites: [], difficulty: 'beginner',
    sourceRefs: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
    contentLicenseStatus: 'link-only',
  }],
};
const evidence = [
  {
    id: 'assessment-evidence-1', kind: 'assessment_pass', assessmentId: 'basics-check',
    assessmentVersion: '1.0.0', attemptId: 'attempt-one', pathId: path.id,
    pathVersion: path.version, nodeId: 'basics', passed: true, masteryVerified: false,
    occurredAt: '2026-11-10T10:00:00.000Z',
  },
  {
    id: 'assessment-evidence-2', kind: 'assessment_pass', assessmentId: 'basics-check',
    assessmentVersion: '1.0.0', attemptId: 'attempt-two', pathId: path.id,
    pathVersion: path.version, nodeId: 'basics', passed: true, masteryVerified: false,
    occurredAt: '2026-11-12T10:00:00.000Z',
  },
  {
    id: 'applied-task-1', kind: 'applied_task', artifactDigest: 'a'.repeat(64),
    pathId: path.id, pathVersion: path.version, nodeId: 'basics',
    occurredAt: '2026-11-13T10:00:00.000Z',
  },
  {
    id: 'human-review-1', kind: 'human_review', reviewerId: 'reviewer-1',
    decision: 'approved', evidenceRefs: ['assessment-evidence-1', 'assessment-evidence-2', 'applied-task-1'],
    pathId: path.id, pathVersion: path.version, nodeId: 'basics',
    occurredAt: '2026-11-14T10:00:00.000Z',
  },
];

test('builds a non-certifying candidate from repeated assessment, applied work and independent human review', () => {
  const candidate = buildLearningMasteryCandidate(path, 'basics', evidence, Date.parse('2026-11-15T00:00:00.000Z'));
  assert.equal(candidate.status, 'candidate_for_human_confirmation');
  assert.equal(candidate.masteryVerified, false);
  assert.deepEqual(candidate.evidenceIds, ['assessment-evidence-1', 'assessment-evidence-2', 'applied-task-1', 'human-review-1']);
  assert.equal(candidate.policyVersion, '1.0.0');
});

test('does not create a candidate from a single passed assessment', () => {
  assert.equal(buildLearningMasteryCandidate(path, 'basics', evidence.slice(0, 1)).status, 'insufficient_evidence');
});

test('requires assessment attempts on separate UTC dates', () => {
  const sameDay = evidence.map(item => item.id === 'assessment-evidence-2'
    ? { ...item, occurredAt: '2026-11-10T15:00:00.000Z' } : item);
  assert.equal(buildLearningMasteryCandidate(path, 'basics', sameDay).status, 'insufficient_evidence');
});

test('requires human review to occur strictly after every evidence item it approves', () => {
  const prematureReview = evidence.map(item => item.kind === 'human_review'
    ? { ...item, occurredAt: '2026-11-12T09:00:00.000Z' } : item);
  const candidate = buildLearningMasteryCandidate(
    path, 'basics', prematureReview, Date.parse('2026-11-15T00:00:00.000Z'),
  );
  assert.equal(candidate.status, 'insufficient_evidence');
  assert.ok(candidate.missing.includes('human_review_after_all_evidence'));
});

test('requires an applied task and a human review referencing every evidence item', () => {
  assert.equal(buildLearningMasteryCandidate(path, 'basics', evidence.slice(0, 2)).status, 'insufficient_evidence');
  const incompleteReview = evidence.map(item => item.kind === 'human_review'
    ? { ...item, evidenceRefs: ['assessment-evidence-1'] } : item);
  assert.equal(buildLearningMasteryCandidate(path, 'basics', incompleteReview).status, 'insufficient_evidence');
});

test('rejects failed, cross-version, future-dated, duplicated or malformed evidence', () => {
  const failed = evidence.map(item => item.id === 'assessment-evidence-2' ? { ...item, passed: false } : item);
  assert.equal(buildLearningMasteryCandidate(path, 'basics', failed).status, 'insufficient_evidence');
  const wrongVersion = evidence.map(item => ({ ...item, pathVersion: '2.0.0' }));
  assert.throws(() => buildLearningMasteryCandidate(path, 'basics', wrongVersion), /path version/i);
  const future = evidence.map(item => item.id === 'human-review-1'
    ? { ...item, occurredAt: '2026-11-16T00:00:00.000Z' } : item);
  assert.throws(() => buildLearningMasteryCandidate(path, 'basics', future, Date.parse('2026-11-15T00:00:00.000Z')), /future/i);
  assert.throws(() => buildLearningMasteryCandidate(path, 'basics', [...evidence, evidence[0]]), /duplicate/i);
});

test('never accepts caller-supplied mastery certification or AI-only review', () => {
  const claimed = evidence.map(item => item.kind === 'human_review'
    ? { ...item, masteryVerified: true } : item);
  assert.throws(() => buildLearningMasteryCandidate(path, 'basics', claimed), /fields/i);
  const aiReview = evidence.map(item => item.kind === 'human_review'
    ? { ...item, reviewerType: 'ai' } : item);
  assert.throws(() => buildLearningMasteryCandidate(path, 'basics', aiReview), /fields/i);
});
