import { validateLearningGraph } from './guardian-intelligence.mjs';

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VERSION_PATTERN = /^(0|[1-9][0-9]*)[.](0|[1-9][0-9]*)[.](0|[1-9][0-9]*)$/;
const MAX_ATTEMPTS = 500;
const DAY_MS = 24 * 60 * 60 * 1000;
const INTERVALS = [1, 3, 7, 14, 30];

function validateAttempt(attempt, path) {
  const keys = [
    'attemptId', 'assessmentId', 'assessmentVersion', 'pathId', 'pathVersion',
    'nodeId', 'earnedPoints', 'possiblePoints', 'scorePercent', 'passed',
    'masteryVerified', 'occurredAt',
  ];
  if (!attempt || typeof attempt !== 'object' || Array.isArray(attempt) ||
      Object.keys(attempt).some(key => !keys.includes(key)) ||
      !keys.every(key => Object.hasOwn(attempt, key))) {
    throw new TypeError('Invalid Learning Review attempt fields');
  }
  for (const field of ['attemptId', 'assessmentId', 'pathId', 'nodeId']) {
    if (typeof attempt[field] !== 'string' || !ID_PATTERN.test(attempt[field])) {
      throw new TypeError('Invalid Learning Review attempt ' + field);
    }
  }
  for (const field of ['assessmentVersion', 'pathVersion']) {
    if (typeof attempt[field] !== 'string' || !VERSION_PATTERN.test(attempt[field])) {
      throw new TypeError('Invalid Learning Review attempt ' + field);
    }
  }
  if (!Number.isInteger(attempt.earnedPoints) || attempt.earnedPoints < 0 ||
      !Number.isInteger(attempt.possiblePoints) || attempt.possiblePoints < 1 ||
      attempt.earnedPoints > attempt.possiblePoints ||
      !Number.isInteger(attempt.scorePercent) || attempt.scorePercent < 0 ||
      attempt.scorePercent > 100 ||
      attempt.scorePercent !== Math.round((attempt.earnedPoints / attempt.possiblePoints) * 100) ||
      typeof attempt.passed !== 'boolean' || attempt.masteryVerified !== false) {
    throw new TypeError('Invalid Learning Review attempt result');
  }
  if (typeof attempt.occurredAt !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(attempt.occurredAt) ||
      !Number.isFinite(Date.parse(attempt.occurredAt)) ||
      new Date(Date.parse(attempt.occurredAt)).toISOString() !== attempt.occurredAt) {
    throw new TypeError('Invalid Learning Review attempt timestamp');
  }
  if (attempt.pathId !== path.id || attempt.pathVersion !== path.version) return null;
  if (!path.nodes.some(node => node.id === attempt.nodeId)) {
    throw new TypeError('Learning Review attempt references an unknown node');
  }
  return Date.parse(attempt.occurredAt);
}

/**
 * Builds review suggestions from trusted, owner-scoped attempt projections.
 * It does not schedule notifications, change progress or certify mastery.
 */
export function buildLearningReviewSchedule(path, attempts = [], now = Date.now()) {
  if (!path || typeof path !== 'object' || Array.isArray(path) ||
      typeof path.id !== 'string' || !ID_PATTERN.test(path.id) ||
      typeof path.version !== 'string' || !VERSION_PATTERN.test(path.version)) {
    throw new TypeError('Invalid Learning Review path');
  }
  validateLearningGraph(path.nodes);
  if (!Number.isFinite(now)) throw new TypeError('Invalid Learning Review clock');
  if (!Array.isArray(attempts) || attempts.length > MAX_ATTEMPTS) {
    throw new TypeError('Learning Review attempts must contain at most 500 records');
  }

  const seen = new Set();
  const daily = new Map();
  for (const attempt of attempts) {
    const occurredAt = validateAttempt(attempt, path);
    if (seen.has(attempt.attemptId)) throw new TypeError('Duplicate Learning Review attempt identifier');
    seen.add(attempt.attemptId);
    if (occurredAt === null) continue;

    let nodeDays = daily.get(attempt.nodeId);
    if (!nodeDays) {
      nodeDays = new Map();
      daily.set(attempt.nodeId, nodeDays);
    }
    const day = attempt.occurredAt.slice(0, 10);
    const current = nodeDays.get(day);
    if (!current || occurredAt > current.occurredAt) {
      nodeDays.set(day, { attempt, occurredAt });
    }
  }

  const schedule = [];
  for (const node of path.nodes) {
    const nodeDays = daily.get(node.id);
    if (!nodeDays?.size) continue;
    const history = [...nodeDays.values()].sort((a, b) => b.occurredAt - a.occurredAt);
    let streak = 0;
    for (const entry of history) {
      if (!entry.attempt.passed) break;
      streak += 1;
    }
    const intervalDays = streak === 0 ? INTERVALS[0] : INTERVALS[Math.min(streak - 1, INTERVALS.length - 1)];
    const latest = history[0];
    const dueAt = new Date(latest.occurredAt + intervalDays * DAY_MS).toISOString();
    schedule.push(Object.freeze({
      pathId: path.id,
      pathVersion: path.version,
      nodeId: node.id,
      lastAttemptAt: latest.attempt.occurredAt,
      consecutiveSuccessfulReviewDays: streak,
      intervalDays,
      dueAt,
      overdue: Date.parse(dueAt) <= now,
      action: 'review',
      reason: latest.attempt.passed
        ? 'A short review is due to strengthen retention; this is not a mastery decision.'
        : 'A recent check was unsuccessful; revisit this topic soon.',
      masteryVerified: false,
      notificationScheduled: false,
    }));
  }
  return Object.freeze(schedule);
}
