import { validateLearningGraph } from './guardian-intelligence.mjs';

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VERSION_PATTERN = /^(0|[1-9][0-9]*)[.](0|[1-9][0-9]*)[.](0|[1-9][0-9]*)$/;
const PROGRESS_STATES = new Set(['in_progress', 'self_reported_complete']);
const MAX_ITEMS = 500;
const MAX_RECOMMENDATIONS = 10;

function exactObject(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some(key => !keys.includes(key)) ||
      !keys.every(key => Object.hasOwn(value, key))) {
    throw new TypeError('Invalid Learning Recommendation ' + label + ' fields');
  }
}
function validIdentity(value, label) {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    throw new TypeError('Invalid Learning Recommendation ' + label);
  }
}
function validVersion(value, label) {
  if (typeof value !== 'string' || !VERSION_PATTERN.test(value)) {
    throw new TypeError('Invalid Learning Recommendation ' + label);
  }
}
function validTimestamp(value, label) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)) ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) {
    throw new TypeError('Invalid Learning Recommendation ' + label);
  }
}

function validateProgressRecords(progress, path) {
  if (!Array.isArray(progress) || progress.length > MAX_ITEMS) {
    throw new TypeError('Invalid Learning Recommendation progress collection');
  }
  const byNode = new Map();
  for (const record of progress) {
    exactObject(record, [
      'ownerId', 'pathId', 'pathVersion', 'nodeId', 'status',
      'masteryVerified', 'createdAt', 'updatedAt',
    ], 'progress');
    if (typeof record.ownerId !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(record.ownerId)) {
      throw new TypeError('Invalid Learning Recommendation progress owner');
    }
    validIdentity(record.pathId, 'progress path identifier');
    validVersion(record.pathVersion, 'progress path version');
    validTimestamp(record.createdAt, 'progress creation timestamp');
    validTimestamp(record.updatedAt, 'progress update timestamp');
    if (Date.parse(record.updatedAt) < Date.parse(record.createdAt)) {
      throw new TypeError('Learning Recommendation progress timestamps are out of order');
    }
    validIdentity(record.nodeId, 'progress node identifier');
    if (record.pathId !== path.id || record.pathVersion !== path.version ||
        !path.nodes.some(node => node.id === record.nodeId)) {
      throw new TypeError('Learning Recommendation progress is outside the exact path version');
    }
    if (!PROGRESS_STATES.has(record.status) || record.masteryVerified !== false) {
      throw new TypeError('Invalid Learning Recommendation progress state');
    }
    if (byNode.has(record.nodeId)) throw new TypeError('Duplicate Learning Recommendation progress node');
    byNode.set(record.nodeId, record);
  }
  return byNode;
}

function validateAttempts(attempts, path) {
  if (!Array.isArray(attempts) || attempts.length > MAX_ITEMS) {
    throw new TypeError('Invalid Learning Recommendation attempt collection');
  }
  const latestByNode = new Map();
  for (const attempt of attempts) {
    exactObject(attempt, [
      'attemptId', 'assessmentId', 'assessmentVersion', 'pathId', 'pathVersion',
      'nodeId', 'earnedPoints', 'possiblePoints', 'scorePercent', 'passed',
      'masteryVerified', 'occurredAt',
    ], 'attempt');
    validIdentity(attempt.attemptId, 'attempt identifier');
    validIdentity(attempt.assessmentId, 'assessment identifier');
    validVersion(attempt.assessmentVersion, 'assessment version');
    validIdentity(attempt.pathId, 'attempt path identifier');
    validVersion(attempt.pathVersion, 'attempt path version');
    validIdentity(attempt.nodeId, 'attempt node identifier');
    validTimestamp(attempt.occurredAt, 'attempt timestamp');
    if (!Number.isInteger(attempt.earnedPoints) || attempt.earnedPoints < 0 ||
        !Number.isInteger(attempt.possiblePoints) || attempt.possiblePoints < 1 ||
        attempt.earnedPoints > attempt.possiblePoints ||
        !Number.isInteger(attempt.scorePercent) || attempt.scorePercent < 0 ||
        attempt.scorePercent > 100 ||
        attempt.scorePercent !== Math.round((attempt.earnedPoints / attempt.possiblePoints) * 100) ||
        typeof attempt.passed !== 'boolean' || attempt.masteryVerified !== false) {
      throw new TypeError('Invalid Learning Recommendation attempt record');
    }
    if (attempt.pathId !== path.id || attempt.pathVersion !== path.version) continue;
    if (!path.nodes.some(node => node.id === attempt.nodeId)) {
      throw new TypeError('Learning Recommendation attempt references an unknown node');
    }
    const current = latestByNode.get(attempt.nodeId);
    if (!current || Date.parse(attempt.occurredAt) > Date.parse(current.occurredAt)) {
      latestByNode.set(attempt.nodeId, attempt);
    }
  }
  return latestByNode;
}

export function recommendLearningNextActions(path, progress = [], attempts = [], now = Date.now()) {
  if (!path || typeof path !== 'object' || Array.isArray(path)) {
    throw new TypeError('Invalid Learning Recommendation path');
  }
  validIdentity(path.id, 'path identifier');
  validVersion(path.version, 'path version');
  validateLearningGraph(path.nodes);
  if (!Number.isFinite(now)) throw new TypeError('Invalid Learning Recommendation clock');

  const progressByNode = validateProgressRecords(progress, path);
  const attemptsByNode = validateAttempts(attempts, path);
  const actions = [];

  for (const node of path.nodes) {
    const state = progressByNode.get(node.id);
    const latest = attemptsByNode.get(node.id);
    let action;
    let priority;
    let reason;

    if (latest && !latest.passed) {
      action = 'review';
      priority = 100;
      reason = 'Your latest check identified something to revisit before moving forward.';
    } else if (state?.status === 'in_progress' && latest?.passed) {
      action = 'reinforce';
      priority = 90;
      reason = 'You passed the check; reinforce the idea before treating it as secure.';
    } else if (state?.status === 'in_progress') {
      action = 'continue';
      priority = 80;
      reason = 'Continue the learning activity you already started.';
    } else if (state?.status === 'self_reported_complete') {
      continue;
    } else if (latest?.passed) {
      action = 'reinforce';
      priority = 70;
      reason = 'You passed the check; a short reinforcement activity can help retain the idea.';
    } else if (node.prerequisites.every(id =>
      progressByNode.get(id)?.status === 'self_reported_complete')) {
      action = 'start';
      priority = 60;
      reason = 'The listed prerequisites are self-reported complete, so this node is ready to begin.';
    } else {
      continue;
    }

    actions.push(Object.freeze({
      pathId: path.id,
      pathVersion: path.version,
      nodeId: node.id,
      title: node.title,
      action,
      priority,
      reason,
      sourceRefs: [...node.sourceRefs],
      masteryVerified: false,
      recommendedAt: new Date(now).toISOString(),
    }));
  }

  return actions
    .sort((a, b) => b.priority - a.priority || a.nodeId.localeCompare(b.nodeId))
    .slice(0, MAX_RECOMMENDATIONS);
}
