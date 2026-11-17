import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLearningAssessment, scoreLearningAttempt } from '../functions/lib/learning-mastery.mjs';

const assessment = {
  id: 'javascript-basics-check',
  version: '1.0.0',
  pathId: 'javascript-foundations',
  pathVersion: '1.0.0',
  nodeId: 'javascript-basics',
  passPercent: 80,
  questions: [
    { id: 'q1', points: 1, correctOption: 'b' },
    { id: 'q2', points: 1, correctOption: 'a' },
    { id: 'q3', points: 2, correctOption: 'c' },
  ],
};

test('Learning mastery validates bounded, version-bound immutable assessment definitions', () => {
  assert.equal(validateLearningAssessment(assessment), true);
  assert.throws(() => validateLearningAssessment({ ...assessment, questions: [] }), /question/i);
  assert.throws(() => validateLearningAssessment({ ...assessment, pathVersion: '../latest' }), /version/i);
  assert.throws(() => validateLearningAssessment({ ...assessment, passPercent: 101 }), /pass/i);
});

test('Learning mastery scores exact answers and requires the assessment threshold', () => {
  const passed = scoreLearningAttempt(assessment, { q1: 'b', q2: 'a', q3: 'c' });
  assert.equal(passed.scorePercent, 100);
  assert.equal(passed.passed, true);
  const failed = scoreLearningAttempt(assessment, { q1: 'a', q2: 'a', q3: 'b' });
  assert.equal(failed.scorePercent, 50);
  assert.equal(failed.passed, false);
});

test('Learning mastery rejects missing, extra and malformed answers', () => {
  assert.throws(() => scoreLearningAttempt(assessment, { q1: 'b' }), /answer/i);
  assert.throws(() => scoreLearningAttempt(assessment, { q1: 'b', q2: 'a', q3: 'c', extra: 'a' }), /answer/i);
  assert.throws(() => scoreLearningAttempt(assessment, { q1: 'z', q2: 'a', q3: 'c' }), /answer/i);
});

test('Learning mastery never treats a learner self-report as a verified assessment result', () => {
  assert.throws(() => scoreLearningAttempt(assessment, { q1: 'b', q2: 'a', q3: 'c', masteryVerified: true }), /answer/i);
});
