import { getLearningPath } from './learning-forge.mjs';
import { listLearningAttempts } from './learning-attempts.mjs';
import { buildLearningMasteryCandidate } from './learning-mastery-evidence.mjs';
import { hashLearningArtifact, validateLearningArtifactUpload } from './learning-applied-evidence.mjs';

const OWNER_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VERSION_PATTERN = /^(0|[1-9][0-9]*)[.](0|[1-9][0-9]*)[.](0|[1-9][0-9]*)$/;
const MAX_ASSESSMENTS = 100;
const MAX_ATTEMPT_EVIDENCE = 75;
const MAX_APPLIED_EVIDENCE = 25;
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
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(attempt.occurredAt) ||
      !Number.isFinite(Date.parse(attempt.occurredAt)) ||
      new Date(Date.parse(attempt.occurredAt)).toISOString() !== attempt.occurredAt) {
    throw new TypeError('Stored Learning Attempt timestamp is invalid');
  }
  if (Date.parse(attempt.occurredAt) > now) {
    throw new TypeError('Stored Learning Attempt cannot be future dated');
  }
}


export class LearningAppliedEvidenceLimitError extends Error {
  constructor() {
    super('Learning applied-task evidence limit reached');
    this.name = 'LearningAppliedEvidenceLimitError';
    this.status = 429;
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
    if (!Number.isInteger(count) || count < 0 || evidence.length + count > MAX_ATTEMPT_EVIDENCE) {
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

  const appliedResult = await db.prepare(`
    SELECT id, artifact_digest, byte_length, media_type, submitted_at
    FROM learning_applied_task_evidence
    WHERE owner_id = ? AND path_id = ? AND path_version = ? AND node_id = ?
    ORDER BY submitted_at ASC, id ASC
    LIMIT ?
  `).bind(ownerId, pathId, pathVersion, nodeId, MAX_APPLIED_EVIDENCE + 1).all();
  const appliedRows = appliedResult?.results ?? [];
  if (appliedRows.length > MAX_APPLIED_EVIDENCE || evidence.length + appliedRows.length > MAX_EVIDENCE) {
    throw new TypeError('Learning Mastery evidence exceeds the bounded applied-task receipt limit');
  }
  for (const row of appliedRows) {
    if (typeof row.id !== 'string' || !/^evidence-[a-f0-9]{32}$/.test(row.id) ||
        typeof row.artifact_digest !== 'string' || !/^[a-f0-9]{64}$/.test(row.artifact_digest) ||
        !Number.isInteger(row.byte_length) || row.byte_length < 1 || row.byte_length > 2 * 1024 * 1024 ||
        !['application/octet-stream', 'application/pdf', 'image/jpeg', 'image/png', 'text/plain'].includes(row.media_type)) {
      throw new TypeError('Stored Learning applied-task evidence receipt is invalid');
    }
    const occurredAt = {
      occurredAt: row.submitted_at,
    };
    validateAttemptTime(occurredAt, now);
    evidence.push(Object.freeze({
      id: 'applied-task-' + row.id,
      kind: 'applied_task',
      artifactDigest: row.artifact_digest,
      pathId,
      pathVersion,
      nodeId,
      occurredAt: row.submitted_at,
    }));
  }

  return Object.freeze({
    path: registered.path,
    evidence: Object.freeze(evidence),
    unavailableEvidenceKinds: Object.freeze(['human_review']),
    sourceCounts: Object.freeze({
      registeredAssessments: assessmentRows.length,
      serverScoredAttempts: evidence.filter(item => item.kind === 'assessment_pass').length,
      appliedTaskReceipts: appliedRows.length,
    }),
  });
}

export async function buildLearningMasteryCandidateFromStore(
  db, ownerId, pathId, pathVersion, nodeId, now = Date.now(),
) {
  const loaded = await loadLearningMasteryEvidence(db, ownerId, pathId, pathVersion, nodeId, now);
  return buildLearningMasteryCandidate(loaded.path, nodeId, loaded.evidence, now);
}


/**
 * Stores only a server-computed digest receipt. Artifact bytes are never written
 * to D1; the learner retains the original file and can withdraw its receipt.
 */
export async function recordLearningAppliedTaskEvidence(
  db, ownerId, pathId, pathVersion, nodeId, bytes, mediaType, now = Date.now(),
) {
  requireDatabase(db);
  validateIdentity(ownerId, pathId, pathVersion, nodeId);
  if (!Number.isFinite(now)) throw new TypeError('Invalid Learning applied-task evidence clock');
  const upload = validateLearningArtifactUpload(bytes, mediaType);
  const registered = await getLearningPath(db, ownerId, pathId, pathVersion);
  if (!registered || !registered.path.nodes.some(node => node.id === nodeId)) {
    throw new LearningMasteryPathNotFoundError();
  }
  const nodeCount = await db.prepare(`
    SELECT COUNT(*) AS total FROM learning_applied_task_evidence
    WHERE owner_id = ? AND path_id = ? AND path_version = ? AND node_id = ?
  `).bind(ownerId, pathId, pathVersion, nodeId).first();
  const ownerCount = await db.prepare(`
    SELECT COUNT(*) AS total FROM learning_applied_task_evidence
    WHERE owner_id = ?
  `).bind(ownerId).first();
  if (!Number.isInteger(nodeCount?.total) || !Number.isInteger(ownerCount?.total)) {
    throw new TypeError('Stored Learning applied-task evidence counts are invalid');
  }
  if (nodeCount.total >= MAX_APPLIED_EVIDENCE || ownerCount.total >= 500) {
    throw new LearningAppliedEvidenceLimitError();
  }

  const digest = await hashLearningArtifact(bytes);
  const id = 'evidence-' + crypto.randomUUID().toLowerCase().replaceAll('-', '');
  const submittedAt = new Date(now).toISOString();
  try {
    await db.prepare(`
      INSERT INTO learning_applied_task_evidence (
        id, owner_id, path_id, path_version, node_id,
        artifact_digest, byte_length, media_type, submitted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, ownerId, pathId, pathVersion, nodeId,
      digest, upload.byteLength, upload.mediaType, submittedAt,
    ).run();
  } catch (error) {
    // The D1 triggers close the race between the preflight count and insert.
    if (/evidence limit reached/i.test(String(error?.message))) {
      throw new LearningAppliedEvidenceLimitError();
    }
    throw error;
  }
  return Object.freeze({
    id,
    kind: 'applied_task',
    pathId,
    pathVersion,
    nodeId,
    artifactDigest: digest,
    byteLength: upload.byteLength,
    mediaType: upload.mediaType,
    occurredAt: submittedAt,
    contentRetained: false,
  });
}

export async function withdrawLearningAppliedTaskEvidence(
  db, ownerId, pathId, pathVersion, nodeId, evidenceId,
) {
  requireDatabase(db);
  validateIdentity(ownerId, pathId, pathVersion, nodeId);
  if (typeof evidenceId !== 'string' || !/^evidence-[a-f0-9]{32}$/.test(evidenceId)) {
    throw new TypeError('Invalid Learning applied-task evidence identifier');
  }
  const result = await db.prepare(`
    DELETE FROM learning_applied_task_evidence
    WHERE id = ? AND owner_id = ? AND path_id = ? AND path_version = ? AND node_id = ?
  `).bind(evidenceId, ownerId, pathId, pathVersion, nodeId).run();
  return result?.meta?.changes === 1;
}
