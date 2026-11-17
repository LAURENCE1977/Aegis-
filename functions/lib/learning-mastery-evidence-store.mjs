import { getLearningPath } from './learning-forge.mjs';
import { listLearningAttempts } from './learning-attempts.mjs';
import { buildLearningMasteryCandidate } from './learning-mastery-evidence.mjs';

const OWNER_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VERSION_PATTERN = /^(0|[1-9][0-9]*)[.](0|[1-9][0-9]*)[.](0|[1-9][0-9]*)$/;
const MAX_ASSESSMENTS = 100;
const MAX_EVIDENCE = 100;

function requireDatabase(db) {
  if (!db || typeof db.prepare !== 'function') throw new TypeError('Learning Mastery evidence database is required');
}
function validateIdentity(ownerId, pathId, pathVersion, nodeId) {
  if (typeof ownerId !== 'string' || !OWNER_PATTERN.test(ownerId) ||
      typeof pathId !== 'string' || !ID_PATTERN.test(pathId) ||
      typeof pathVersion !== 'string' || !VERSION_PATTERN.test(pathVersion) ||
      typeof nodeId !== 'string' || !ID_PATTERN.test(nodeId)) {
    throw new TypeError('Invalid Learning Mastery evidence identity');
  }
}
function validateClock(now) {
  if (!Number.isFinite(now)) throw new TypeError('Invalid Learning Mastery evidence clock');
}
function validateAttemptTime(attempt, now) {
  if (typeof attempt.occurredAt !== 'string' ||
      !/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$/.test(attempt.occurredAt) ||
      !Number.isFinite(Date.parse(attempt.occurredAt)) ||
      new Date(Date.parse(attempt.occurredAt)).toISOString() !== attempt.occurredAt) {
    throw new TypeError('Stored Learning Attempt timestamp is invalid');
  }
  if (Date.parse(attempt.occurredAt) > now) {
    throw new TypeError('Stored Learning Attempt cannot be future dated');
  }
}

export class LearningMasteryPathNotFoundError extends Error {
  constructor() {
    super('Exact registered Learning Path version or node not found');
    this.name = 'LearningMasteryPathNotFoundError';
    this.status = 404;
  }
}

/**
 * Loads assessment evidence only from the authenticated owner's immutable,
 * digest-verified Learning Forge path, assessment and server-scored attempt
 * stores. Applied-task and human-review evidence are deliberately unavailable
 * until their own authoritative, independently authenticated stores exist.
 */
export async function loadLearningMasteryEvidence(db, ownerId, pathId, pathVersion, nodeId, now = Date.now()) {
  requireDatabase(db);
  validateIdentity(ownerId, pathId, pathVersion, nodeId);
  validateClock(now);

  const registered = await getLearningPath(db, ownerId, pathId, pathVersion);
  if (!registered || !registered.path.nodes.some(node => node.id === nodeId)) {
    throw new LearningMasteryPathNotFoundError();
  }

  const assessmentResult = await db.prepare(`
    SELECT assessment_id, version
    FROM learning_assessments
    WHERE owner_id = ? AND path_id = ? AND path_version = ? AND node_id = ?
    ORDER BY assessment_id ASC, version ASC
    LIMIT ?
  `).bind(ownerId, pathId, pathVersion, nodeId, MAX_ASSESSMENTS + 1).all();
  const assessmentRows = assessmentResult?.results ?? [];
  if (assessmentRows.length > MAX_ASSESSMENTS) {
    throw new TypeError('Learning Mastery evidence exceeds the registered assessment limit');
  }

  const evidence = [];
  for (const assessment of assessmentRows) {
    if (typeof assessment.assessment_id !== 'string' || !ID_PATTERN.test(assessment.assessment_id) ||
        typeof assessment.version !== 'string' || !VERSION_PATTERN.test(assessment.version)) {
      throw new TypeError('Stored Learning Assessment identity is invalid');
    }
    const countRow = await db.prepare(`
      SELECT COUNT(*) AS total
      FROM learning_assessment_attempts
      WHERE owner_id = ? AND assessment_id = ? AND assessment_version = ?
    `).bind(ownerId, assessment.assessment_id, assessment.version).first();
    const count = countRow?.total;
    if (!Number.isInteger(count) || count < 0 || evidence.length + count > MAX_EVIDENCE) {
      throw new TypeError('Learning Mastery evidence exceeds the bounded attempt limit');
    }
    const attempts = await listLearningAttempts(
      db, ownerId, assessment.assessment_id, assessment.version, Math.max(1, count),
    );
    if (attempts.length !== count) {
      throw new TypeError('Learning Mastery evidence attempt count does not match its authoritative store');
    }
    for (const attempt of attempts) {
      validateAttemptTime(attempt, now);
      if (attempt.pathId !== pathId || attempt.pathVersion !== pathVersion || attempt.nodeId !== nodeId) {
        throw new TypeError('Stored Learning Attempt does not match the exact mastery evidence target');
      }
      evidence.push(Object.freeze({
        id: 'assessment-' + attempt.attemptId,
        kind: 'assessment_pass',
        assessmentId: attempt.assessmentId,
        assessmentVersion: attempt.assessmentVersion,
        attemptId: attempt.attemptId,
        pathId: attempt.pathId,
        pathVersion: attempt.pathVersion,
        nodeId: attempt.nodeId,
        passed: attempt.passed,
        masteryVerified: false,
        occurredAt: attempt.occurredAt,
      }));
    }
  }

  return Object.freeze({
    path: registered.path,
    evidence: Object.freeze(evidence),
    unavailableEvidenceKinds: Object.freeze(['applied_task', 'human_review']),
    sourceCounts: Object.freeze({
      registeredAssessments: assessmentRows.length,
      serverScoredAttempts: evidence.length,
    }),
  });
}

export async function buildLearningMasteryCandidateFromStore(
  db, ownerId, pathId, pathVersion, nodeId, now = Date.now(),
) {
  const loaded = await loadLearningMasteryEvidence(db, ownerId, pathId, pathVersion, nodeId, now);
  return buildLearningMasteryCandidate(loaded.path, nodeId, loaded.evidence, now);
}
