import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLearningReviewSchedule } from '../functions/lib/learning-spaced-repetition.mjs';

const path = {
  id: 'javascript-foundations', version: '1.0.0',
  nodes: [
    { id: 'basics', title: 'Basics', outcomes: ['Understand values'], prerequisites: [],
      difficulty: 'beginner', sourceRefs: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
      contentLicenseStatus: 'link-only' },
    { id: 'functions', title: 'Functions', outcomes: ['Write functions'], prerequisites: ['basics'],
      difficulty: 'beginner', sourceRefs: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Functions'],
      contentLicenseStatus: 'link-only' },
  ],
};
const attempt = (id, day, passed) => ({
  attemptId: id, assessmentId: 'basics-check', assessmentVersion: '1.0.0',
  pathId: path.id, pathVersion: path.version, nodeId: 'basics',
  earnedPoints: passed ? 5 : 2, possiblePoints: 5, scorePercent: passed ? 100 : 40,
  passed, masteryVerified: false, occurredAt: `2026-11-${day}T10:00:00.000Z`,
});

test('schedules a short review after a failed attempt without certifying mastery', () => {
  const [item] = buildLearningReviewSchedule(path, [attempt('attempt-1', '10', false)]);
  assert.equal(item.intervalDays, 1);
  assert.equal(item.dueAt, '2026-11-11T10:00:00.000Z');
  assert.equal(item.masteryVerified, false);
  assert.equal(item.notificationScheduled, false);
});

test('widens review intervals after repeated passes on distinct days', () => {
  const schedule = buildLearningReviewSchedule(path, [
    attempt('attempt-1', '10', true),
    attempt('attempt-2', '12', true),
    attempt('attempt-3', '14', true),
  ]);
  assert.equal(schedule[0].consecutiveSuccessfulReviewDays, 3);
  assert.equal(schedule[0].intervalDays, 7);
  assert.equal(schedule[0].dueAt, '2026-11-21T10:00:00.000Z');
});

test('a failure resets the successful review sequence', () => {
  const schedule = buildLearningReviewSchedule(path, [
    attempt('attempt-1', '10', true),
    attempt('attempt-2', '12', true),
    attempt('attempt-3', '14', false),
  ]);
  assert.equal(schedule[0].consecutiveSuccessfulReviewDays, 0);
  assert.equal(schedule[0].intervalDays, 1);
});

test('same-day attempts do not inflate the spaced-repetition sequence', () => {
  const schedule = buildLearningReviewSchedule(path, [
    attempt('attempt-1', '10', true),
    { ...attempt('attempt-2', '10', true), occurredAt: '2026-11-10T16:00:00.000Z' },
  ]);
  assert.equal(schedule[0].consecutiveSuccessfulReviewDays, 1);
  assert.equal(schedule[0].intervalDays, 1);
});

test('ignores attempts from other path versions and rejects malformed evidence', () => {
  const old = { ...attempt('attempt-old', '10', false), pathVersion: '2.0.0' };
  assert.deepEqual(buildLearningReviewSchedule(path, [old]), []);
  assert.throws(() => buildLearningReviewSchedule(path, [{ ...attempt('attempt-bad', '10', true), scorePercent: 101 }]), /attempt/i);
});

test('returns stable node ordering and never schedules notifications', () => {
  const schedule = buildLearningReviewSchedule(path, [
    { ...attempt('attempt-2', '12', true), nodeId: 'functions' },
    attempt('attempt-1', '10', true),
  ]);
  assert.deepEqual(schedule.map(item => item.nodeId), ['basics', 'functions']);
  assert.ok(schedule.every(item => item.notificationScheduled === false));
});
