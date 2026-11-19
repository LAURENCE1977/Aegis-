import test from 'node:test';
import assert from 'node:assert/strict';
import { recommendLearningNextActions } from '../functions/lib/learning-recommendations.mjs';

const learningPath = {
  id: 'javascript-foundations', version: '1.0.0',
  nodes: [
    { id: 'basics', title: 'JavaScript basics', outcomes: ['Understand values'],
      prerequisites: [], difficulty: 'beginner',
      sourceRefs: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'], contentLicenseStatus: 'link-only' },
    { id: 'functions', title: 'Functions', outcomes: ['Write functions'],
      prerequisites: ['basics'], difficulty: 'beginner',
      sourceRefs: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Functions'], contentLicenseStatus: 'link-only' },
    { id: 'testing', title: 'Testing', outcomes: ['Test functions'],
      prerequisites: ['functions'], difficulty: 'intermediate',
      sourceRefs: ['https://nodejs.org/api/test.html'], contentLicenseStatus: 'link-only' },
  ],
};
const completedBasics = [{
  ownerId: 'owner', pathId: learningPath.id, pathVersion: learningPath.version, nodeId: 'basics',
  status: 'self_reported_complete', masteryVerified: false,
  createdAt: '2026-11-17T10:00:00.000Z', updatedAt: '2026-11-17T10:00:00.000Z',
}];

test('recommends only the next prerequisite-eligible node and explains the reason', () => {
  const actions = recommendLearningNextActions(learningPath, [], [], Date.parse('2026-11-17T12:00:00.000Z'));
  assert.equal(actions.length, 1);
  assert.equal(actions[0].nodeId, 'basics');
  assert.equal(actions[0].action, 'start');
  assert.equal(actions[0].masteryVerified, false);
  assert.ok(actions[0].reason.length > 0);
});

test('never recommends a node whose prerequisites are not self-reported complete', () => {
  const actions = recommendLearningNextActions(learningPath, completedBasics, []);
  assert.deepEqual(actions.map(item => item.nodeId), ['functions']);
  assert.equal(actions.some(item => item.nodeId === 'testing'), false);
});

test('prioritises review after a failed assessment without changing learner progress', () => {
  const progress = [...completedBasics, {
    ownerId: 'owner', pathId: learningPath.id, pathVersion: learningPath.version,
    nodeId: 'functions', status: 'in_progress', masteryVerified: false,
    createdAt: '2026-11-17T10:30:00.000Z', updatedAt: '2026-11-17T10:30:00.000Z',
  }];
  const attempts = [{
    attemptId: 'attempt-1', assessmentId: 'functions-check', assessmentVersion: '1.0.0',
    pathId: learningPath.id, pathVersion: learningPath.version, nodeId: 'functions',
    earnedPoints: 2, possiblePoints: 5, scorePercent: 40, passed: false, masteryVerified: false,
    occurredAt: '2026-11-17T11:00:00.000Z',
  }];
  const actions = recommendLearningNextActions(learningPath, progress, attempts);
  assert.equal(actions[0].action, 'review');
  assert.equal(actions[0].nodeId, 'functions');
  assert.equal(actions[0].masteryVerified, false);
});

test('a passed assessment recommends reinforcement, never certified mastery', () => {
  const progress = [...completedBasics, {
    ownerId: 'owner', pathId: learningPath.id, pathVersion: learningPath.version,
    nodeId: 'functions', status: 'in_progress', masteryVerified: false,
    createdAt: '2026-11-17T10:30:00.000Z', updatedAt: '2026-11-17T10:30:00.000Z',
  }];
  const attempts = [{
    attemptId: 'attempt-2', assessmentId: 'functions-check', assessmentVersion: '1.0.0',
    pathId: learningPath.id, pathVersion: learningPath.version, nodeId: 'functions',
    earnedPoints: 3, possiblePoints: 3, scorePercent: 100, passed: true, masteryVerified: false,
    occurredAt: '2026-11-17T11:00:00.000Z',
  }];
  const actions = recommendLearningNextActions(learningPath, progress, attempts);
  assert.equal(actions[0].action, 'reinforce');
  assert.equal(actions[0].masteryVerified, false);
  assert.equal(actions.some(item => item.nodeId === 'testing'), false);
});

test('ignores attempts from other path versions and sorts deterministically', () => {
  const progress = [...completedBasics, {
    ownerId: 'owner', pathId: learningPath.id, pathVersion: learningPath.version,
    nodeId: 'functions', status: 'in_progress', masteryVerified: false,
    createdAt: '2026-11-17T10:30:00.000Z', updatedAt: '2026-11-17T10:30:00.000Z',
  }];
  const attempts = [{
    attemptId: 'old-attempt', assessmentId: 'functions-check', assessmentVersion: '1.0.0',
    pathId: learningPath.id, pathVersion: '2.0.0', nodeId: 'functions',
    earnedPoints: 0, possiblePoints: 3, scorePercent: 0, passed: false, masteryVerified: false,
    occurredAt: '2026-11-17T11:00:00.000Z',
  }];
  const actions = recommendLearningNextActions(learningPath, progress, attempts);
  assert.equal(actions[0].action, 'continue');
  assert.deepEqual(actions.map(item => item.nodeId), ['functions']);
});

test('rejects malformed progress and attempts rather than guessing', () => {
  assert.throws(() => recommendLearningNextActions(learningPath, [{
    ...completedBasics[0], status: 'mastered',
  }]), /progress/i);
  assert.throws(() => recommendLearningNextActions(learningPath, [], [{
    attemptId: 'attempt-3', assessmentId: 'functions-check', assessmentVersion: '1.0.0',
    pathId: learningPath.id, pathVersion: learningPath.version, nodeId: 'functions',
    scorePercent: 101, passed: true, masteryVerified: true,
    occurredAt: '2026-11-17T11:00:00.000Z',
  }]), /attempt/i);
});
