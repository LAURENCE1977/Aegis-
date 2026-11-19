import { validateLearningAssessment, projectLearnerAssessment } from './learning-mastery.mjs';

const OWNER_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const MAX_PAGE_SIZE = 100;

function requireDatabase(db) {
  if (!db || typeof db.prepare !== 'function') throw new TypeError('Learning Assessment database is required');
}
function requireOwner(ownerId) {
  if (typeof ownerId !== 'string' || !OWNER_PATTERN.test(ownerId)) throw new TypeError('Invalid Learning Assessment owner identifier');
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
async function mapAssessmentRow(row) {
  if (!row || typeof row.owner_id !== 'string' || typeof row.assessment_id !== 'string' ||
      typeof row.version !== 'string' || typeof row.path_id !== 'string' ||
      typeof row.path_version !== 'string' || typeof row.node_id !== 'string' ||
      typeof row.assessment_digest !== 'string' || typeof row.assessment_json !== 'string' ||
      typeof row.created_at !== 'string') {
    throw new TypeError('Stored Learning Assessment metadata is invalid');
  }
  let assessment;
  try { assessment = JSON.parse(row.assessment_json); }
  catch { throw new TypeError('Stored Learning Assessment JSON is corrupt'); }
  validateLearningAssessment(assessment);
  if (!/^[a-f0-9]{64}$/.test(row.assessment_digest) ||
      await sha256Hex(canonicalJson(assessment)) !== row.assessment_digest) {
    throw new TypeError('Stored Learning Assessment digest does not match its content');
  }
  if (assessment.id !== row.assessment_id || assessment.version !== row.version ||
      assessment.pathId !== row.path_id || assessment.pathVersion !== row.path_version ||
      assessment.nodeId !== row.node_id) {
    throw new TypeError('Stored Learning Assessment identity does not match its record');
  }
  return { ownerId: row.owner_id, assessment, digest: row.assessment_digest, createdAt: row.created_at };
}

export class LearningAssessmentConflictError extends Error {
  constructor() {
    super('Learning Assessment version already exists with different content');
    this.name = 'LearningAssessmentConflictError';
    this.status = 409;
  }
}

export async function registerLearningAssessment(db, ownerId, assessment, now = Date.now()) {
  requireDatabase(db);
  requireOwner(ownerId);
  validateLearningAssessment(assessment);
  if (!Number.isFinite(now)) throw new TypeError('Invalid Learning Assessment clock');

  const pathRow = await db.prepare(`
    SELECT graph_json FROM learning_paths
    WHERE owner_id = ? AND path_id = ? AND version = ? LIMIT 1
  `).bind(ownerId, assessment.pathId, assessment.pathVersion).first();
  if (!pathRow || typeof pathRow.graph_json !== 'string') {
    throw new TypeError('Learning Assessment requires an exact registered path version');
  }
  let path;
  try { path = JSON.parse(pathRow.graph_json); }
  catch { throw new TypeError('Registered Learning Path JSON is corrupt'); }
  if (!Array.isArray(path.nodes) || !path.nodes.some(node => node?.id === assessment.nodeId)) {
    throw new TypeError('Learning Assessment node is not present in the registered path');
  }

  const json = canonicalJson(assessment);
  const digest = await sha256Hex(json);
  const timestamp = new Date(now).toISOString();
  const id = 'learning-assessment-' + crypto.randomUUID().toLowerCase().replaceAll('-', '');
  await db.prepare(`
    INSERT INTO learning_assessments (
      id, owner_id, assessment_id, version, path_id, path_version,
      node_id, assessment_digest, assessment_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(owner_id, assessment_id, version) DO NOTHING
  `).bind(id, ownerId, assessment.id, assessment.version, assessment.pathId,
    assessment.pathVersion, assessment.nodeId, digest, json, timestamp).run();

  const row = await db.prepare(`
    SELECT * FROM learning_assessments
    WHERE owner_id = ? AND assessment_id = ? AND version = ? LIMIT 1
  `).bind(ownerId, assessment.id, assessment.version).first();
  if (!row) throw new Error('Learning Assessment could not be persisted');
  const stored = await mapAssessmentRow(row);
  if (stored.digest !== digest) throw new LearningAssessmentConflictError();
  return { ...stored, created: row.id === id };
}

export async function listLearningAssessments(db, ownerId, limit = 50) {
  requireDatabase(db);
  requireOwner(ownerId);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    throw new TypeError('Learning Assessment limit must be between 1 and 100');
  }
  const result = await db.prepare(`
    SELECT * FROM learning_assessments
    WHERE owner_id = ?
    ORDER BY created_at DESC, assessment_id ASC, version DESC
    LIMIT ?
  `).bind(ownerId, limit).all();
  return Promise.all((result?.results ?? []).map(async row => {
    const stored = await mapAssessmentRow(row);
    return Object.freeze({
      ownerId: stored.ownerId,
      assessment: projectLearnerAssessment(stored.assessment),
      digest: stored.digest,
      createdAt: stored.createdAt,
    });
  }));
}
