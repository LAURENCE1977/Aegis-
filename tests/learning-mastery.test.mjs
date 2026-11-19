import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLearningAssessment, projectLearnerAssessment, scoreLearningAttempt } from '../functions/lib/learning-mastery.mjs';

const assessment = {
  id: 'javascript-basics-check', version: '1.0.0', pathId: 'javascript-foundations',
  pathVersion: '1.0.0', nodeId: 'javascript-basics', title: 'JavaScript basics check', passPercent: 80,
  questions: [
    { id: 'q1', prompt: 'Which keyword declares a block-scoped variable?', options: ['var', 'let', 'goto', 'define'], points: 1, correctOption: 'b' },
    { id: 'q2', prompt: 'Which value represents absence?', options: ['null', 'true', '1', 'NaN'], points: 1, correctOption: 'a' },
    { id: 'q3', prompt: 'Which syntax creates an arrow function?', options: ['function =>', '->', '=>', 'lambda'], points: 2, correctOption: 'c' },
  ],
};

test('validates bounded assessment definitions tied to exact immutable path versions', () => {
  assert.equal(validateLearningAssessment(assessment), true);
  assert.throws(() => validateLearningAssessment({ ...assessment, questions: [] }), /question/i);
  assert.throws(() => validateLearningAssessment({ ...assessment, pathVersion: '../latest' }), /version/i);
  assert.throws(() => validateLearningAssessment({ ...assessment, passPercent: 101 }), /pass/i);
  assert.throws(() => validateLearningAssessment({ ...assessment, questions: [{ ...assessment.questions[0], options: ['only'] }] }), /option/i);
});

test('projects learner-safe assessment without exposing answer keys or pass threshold', () => {
  const learnerView = projectLearnerAssessment(assessment);
  assert.equal(learnerView.id, assessment.id);
  assert.equal(learnerView.questions[0].prompt, assessment.questions[0].prompt);
  assert.deepEqual(learnerView.questions[0].options, assessment.questions[0].options);
  assert.equal('correctOption' in learnerView.questions[0], false);
  assert.equal('passPercent' in learnerView, false);
  assert.equal(JSON.stringify(learnerView).includes('correctOption'), false);
});

test('scores exact answers with weighted scoring and enforces the declared threshold', () => {
  const passed = scoreLearningAttempt(assessment, { q1: 'b', q2: 'a', q3: 'c' });
  assert.equal(passed.scorePercent, 100);
  assert.equal(passed.passed, true);
  const failed = scoreLearningAttempt(assessment, { q1: 'b', q2: 'a', q3: 'b' });
  assert.equal(failed.scorePercent, 50);
  const lowerScore = scoreLearningAttempt(assessment, { q1: 'a', q2: 'a', q3: 'b' });
  assert.equal(lowerScore.scorePercent, 25);
  assert.equal(failed.passed, false);
  assert.equal(passed.masteryVerified, false);
});

test('rejects missing, extra, malformed answers and caller-supplied result claims', () => {
  assert.throws(() => scoreLearningAttempt(assessment, { q1: 'b' }), /answer/i);
  assert.throws(() => scoreLearningAttempt(assessment, { q1: 'b', q2: 'a', q3: 'c', extra: 'a' }), /answer/i);
  assert.throws(() => scoreLearningAttempt(assessment, { q1: 'z', q2: 'a', q3: 'c' }), /answer/i);
  assert.throws(() => scoreLearningAttempt(assessment, { q1: 'b', q2: 'a', q3: 'c', masteryVerified: true }), /answer/i);
});
