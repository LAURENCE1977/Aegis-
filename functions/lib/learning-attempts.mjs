import { scoreLearningAttempt, validateLearningAssessment } from './learning-mastery.mjs';

const OWNER_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VERSION_PATTERN = /^(0|[1-9][0-9]*)[.](0|[1-9][0-9]*)[.](0|[1-9][0-9]*)$/;
const MAX_PAGE_SIZE = 100;

function requireDatabase(db) {
  if (!db || typeof db.prepare !== 'function') throw new TypeError('Learning Attempt database is required');
}
function requireOwner(ownerId) {
  if (typeof ownerId !== 'string' || !OWNER_PATTERN.test(ownerId)) throw new TypeError('Invalid Learning Attempt owner identifier');
}
function requireAssessmentIdentity(assessmentId, version) {
  if (typeof assessmentId !== 'string' || !ID_PATTERN.test(assessmentId)) throw new TypeError('Invalid Learning Assessment identifier');
  if (typeof version !== 'string' || !VERSION_PATTERN.test(version)) throw new TypeError('Invalid Learning Assessment version');
}
function canonicalJson(value) {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonicalJson(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}
async function sha256Hex(value) {
  if (!globalThis.crypto?.subtle) throw new Error('Web Crypto SHA-256 is unavailable');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export class LearningAttemptNotFoundError extends Error {
  constructor() {
    super('Registered Learning Assessment version not found');
    this.name = 'LearningAttemptNotFoundError';
    this.status = 404;
  }
}
export class LearningAttemptRateLimitError extends Error {
  constructor() {
    super('Learning Assessment attempt rate limit exceeded; wait before trying again');
    this.name = 'LearningAttemptRateLimitError';
    this.status = 429;
  }
}

function mapAssessment(row) {
  if (!row || typeof row.assessment_json !== 'string' ||
      typeof row.assessment_digest !== 'string' || !/^[a-f0-9]{64}$/.test(row.assessment_digest)) {
    throw new TypeError('Stored Learning Assessment metadata is invalid');
  }
  let assessment;
  try { assessment = JSON.parse(row.assessment_json); }
  catch { throw new TypeError('Stored Learning Assessment JSON is corrupt'); }
  validateLearningAssessment(assessment);
  if (assessment.id !== row.assessment_id || assessment.version !== row.version ||
      assessment.pathId !== row.path_id || assessment.pathVersion !== row.path_version ||
      assessment.nodeId !== row.node_id) {
    throw new TypeError('Stored Learning Assessment identity does not match its record');
  }
  return assessment;
}

function mapAttempt(row) {
  if (!row || typeof row.id !== 'string' || typeof row.owner_id !== 'string' ||
      typeof row.assessment_id !== 'string' || typeof row.assessment_version !== 'string' ||
      typeof row.occurred_at !== 'string' || typeof row.result_json !== 'string') {
    throw new TypeError('Stored Learning Attempt metadata is invalid');
  }
  let result;
  try { result = JSON.parse(row.result_json); }
  catch { throw new TypeError('Stored Learning Attempt result is corrupt'); }
  if (!result || result.attemptId !== row.id || result.assessmentId !== row.assessment_id ||
      result.assessmentVersion !== row.assessment_version ||
      !Number.isInteger(result.scorePercent) || result.scorePercent < 0 || result.scorePercent > 100 ||
      typeof result.passed !== 'boolean' || result.masteryVerified !== false) {
    throw new TypeError('Stored Learning Attempt result does not match its record');
  }
  return Object.freeze({
    attemptId: row.id,
    assessmentId: row.assessment_id,
    assessmentVersion: row.assessment_version,
    pathId: result.pathId,
    pathVersion: result.pathVersion,
    nodeId: result.nodeId,
    earnedPoints: result.earnedPoints,
    possiblePoints: result.possiblePoints,
    scorePercent: result.scorePercent,
    passed: result.passed,
    masteryVerified: false,
    occurredAt: row.occurred_at,
  });
}

export async function submitLearningAttempt(db, ownerId, assessmentId, version, answers, now = Date.now()) {
  requireDatabase(db);
  requireOwner(ownerId);
  requireAssessmentIdentity(assessmentId, version);
  if (!Number.isFinite(now)) throw new TypeError('Invalid Learning Attempt clock');

  const row = await db.prepare(`
    SELECT * FROM learning_assessments
    WHERE owner_id = ? AND assessment_id = ? AND version = ? LIMIT 1
  `).bind(ownerId, assessmentId, version).first();
  if (!row) throw new LearningAttemptNotFoundError();
  const assessment = mapAssessment(row);
  if (await sha256Hex(canonicalJson(assessment)) !== row.assessment_digest) {
    throw new TypeError('Stored Learning Assessment digest does not match its content');
  }

  const scored = scoreLearningAttempt(assessment, answers);
  const attemptDigest = await sha256Hex(canonicalJson(answers));
  const occurredAt = new Date(now).toISOString();
  const attemptId = 'learning-attempt-' + crypto.randomUUID().toLowerCase().replaceAll('-', '');
  const result = { attemptId, ...scored };
  const resultJson = canonicalJson(result);

  let write;
  try {
    write = await db.prepare(`
      INSERT INTO learning_assessment_attempts (
        id, owner_id, assessment_id, assessment_version, path_id, path_version,
        node_id, assessment_digest, attempt_digest, result_json,
        score_percent, passed, mastery_verified, occurred_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `).bind(attemptId, ownerId, assessment.id, assessment.version, assessment.pathId,
      assessment.pathVersion, assessment.nodeId, row.assessment_digest, attemptDigest,
      resultJson, scored.scorePercent, scored.passed ? 1 : 0, occurredAt).run();
  } catch (error) {
    if (/attempt rate limit|attempt cooldown/i.test(String(error?.message || error))) {
      throw new LearningAttemptRateLimitError();
    }
    throw error;
  }
  if (write?.meta?.changes !== 1) throw new Error('Learning Attempt could not be persisted');

  const saved = await db.prepare(`
    SELECT * FROM learning_assessment_attempts
    WHERE owner_id = ? AND id = ? LIMIT 1
  `).bind(ownerId, attemptId).first();
  if (!saved) throw new Error('Learning Attempt could not be read after persistence');
  return mapAttempt(saved);
}

export async function listLearningAttempts(db, ownerId, assessmentId, version, limit = 50) {
  requireDatabase(db);
  requireOwner(ownerId);
  requireAssessmentIdentity(assessmentId, version);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    throw new TypeError('Learning Attempt limit must be between 1 and 100');
  }
  const result = await db.prepare(`
    SELECT * FROM learning_assessment_attempts
    WHERE owner_id = ? AND assessment_id = ? AND assessment_version = ?
    ORDER BY occurred_at DESC, id DESC
    LIMIT ?
  `).bind(ownerId, assessmentId, version, limit).all();
  return (result?.results ?? []).map(mapAttempt);
}
