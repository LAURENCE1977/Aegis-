const OWNER_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VERSION_PATTERN = /^(0|[1-9][0-9]*)[.](0|[1-9][0-9]*)[.](0|[1-9][0-9]*)$/;
const PROGRESS_STATES = new Set(['in_progress', 'self_reported_complete']);
const MAX_PAGE_SIZE = 100;

function requireDatabase(db) {
  if (!db || typeof db.prepare !== 'function') throw new TypeError('Learning Forge database is required');
}
function requireOwner(ownerId) {
  if (typeof ownerId !== 'string' || !OWNER_PATTERN.test(ownerId)) throw new TypeError('Invalid Learning Forge owner identifier');
}
function requirePathIdentity(pathId, version, nodeId) {
  if (typeof pathId !== 'string' || !ID_PATTERN.test(pathId)) throw new TypeError('Invalid Learning Path identifier');
  if (typeof version !== 'string' || !VERSION_PATTERN.test(version)) throw new TypeError('Invalid Learning Path version');
  if (nodeId !== undefined && (typeof nodeId !== 'string' || !ID_PATTERN.test(nodeId))) {
    throw new TypeError('Invalid Learning node identifier');
  }
}
function mapProgressRow(row) {
  if (!row || typeof row.owner_id !== 'string' || typeof row.path_id !== 'string' ||
      typeof row.path_version !== 'string' || typeof row.node_id !== 'string' ||
      !PROGRESS_STATES.has(row.status) || typeof row.created_at !== 'string' ||
      typeof row.updated_at !== 'string') {
    throw new TypeError('Stored Learning Progress record is invalid');
  }
  return Object.freeze({
    ownerId: row.owner_id,
    pathId: row.path_id,
    pathVersion: row.path_version,
    nodeId: row.node_id,
    status: row.status,
    masteryVerified: false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export class LearningProgressConflictError extends Error {
  constructor() {
    super('Learning progress changed since it was loaded; refresh and retry');
    this.name = 'LearningProgressConflictError';
    this.status = 409;
  }
}

async function loadPath(db, ownerId, pathId, version) {
  const row = await db.prepare(`
    SELECT * FROM learning_paths
    WHERE owner_id = ? AND path_id = ? AND version = ?
    LIMIT 1
  `).bind(ownerId, pathId, version).first();
  if (!row) {
    const error = new Error('Learning Path not found');
    error.status = 404;
    throw error;
  }
  let path;
  try { path = JSON.parse(row.graph_json); }
  catch { throw new TypeError('Stored Learning Path graph is corrupt'); }
  if (!Array.isArray(path.nodes)) throw new TypeError('Stored Learning Path graph is invalid');
  return path;
}

async function prerequisitesComplete(db, ownerId, pathId, version, prerequisites) {
  if (prerequisites.length === 0) return true;
  const result = await db.prepare(`
    SELECT node_id, status FROM learning_progress
    WHERE owner_id = ? AND path_id = ? AND path_version = ?
  `).bind(ownerId, pathId, version).all();
  const states = new Map((result?.results ?? []).map(row => [row.node_id, row.status]));
  return prerequisites.every(id => states.get(id) === 'self_reported_complete');
}

export async function updateLearningProgress(
  db, ownerId, pathId, version, nodeId, status, expectedUpdatedAt, now = Date.now(),
) {
  requireDatabase(db);
  requireOwner(ownerId);
  requirePathIdentity(pathId, version, nodeId);
  if (!PROGRESS_STATES.has(status)) throw new TypeError('Invalid Learning Progress status');
  if (expectedUpdatedAt !== null && (typeof expectedUpdatedAt !== 'string' ||
      !Number.isFinite(Date.parse(expectedUpdatedAt)) ||
      new Date(Date.parse(expectedUpdatedAt)).toISOString() !== expectedUpdatedAt)) {
    throw new TypeError('Expected Learning Progress timestamp must be canonical UTC or null');
  }
  if (!Number.isFinite(now)) throw new TypeError('Invalid Learning Forge clock');

  const path = await loadPath(db, ownerId, pathId, version);
  const node = path.nodes.find(item => item.id === nodeId);
  if (!node) throw new TypeError('Learning node not found in registered path');
  const currentRow = await db.prepare(`
    SELECT * FROM learning_progress
    WHERE owner_id = ? AND path_id = ? AND path_version = ? AND node_id = ?
    LIMIT 1
  `).bind(ownerId, pathId, version, nodeId).first();

  if (!currentRow) {
    if (expectedUpdatedAt !== null) throw new LearningProgressConflictError();
    if (!(await prerequisitesComplete(db, ownerId, pathId, version, node.prerequisites))) {
      throw new TypeError('Learning prerequisites must be self-reported complete before this node can start');
    }
    const timestamp = new Date(now).toISOString();
    const result = await db.prepare(`
      INSERT INTO learning_progress (
        owner_id, path_id, path_version, node_id, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(owner_id, path_id, path_version, node_id) DO NOTHING
    `).bind(ownerId, pathId, version, nodeId, status, timestamp, timestamp).run();
    if (result?.meta?.changes !== 1) throw new LearningProgressConflictError();
  } else {
    const current = mapProgressRow(currentRow);
    if (current.updatedAt !== expectedUpdatedAt) throw new LearningProgressConflictError();
    if (current.status === status) return current;
    const allowed = current.status === 'in_progress' && status === 'self_reported_complete' ||
      current.status === 'self_reported_complete' && status === 'in_progress';
    if (!allowed) throw new TypeError('Invalid Learning Progress transition');
    if (status === 'self_reported_complete' &&
        !(await prerequisitesComplete(db, ownerId, pathId, version, node.prerequisites))) {
      throw new TypeError('Learning prerequisites must be self-reported complete before this node can complete');
    }
    const timestamp = new Date(now).toISOString();
    if (timestamp <= current.updatedAt) throw new TypeError('Learning Progress timestamp must advance');
    const result = await db.prepare(`
      UPDATE learning_progress
      SET status = ?, updated_at = ?
      WHERE owner_id = ? AND path_id = ? AND path_version = ? AND node_id = ? AND updated_at = ?
    `).bind(status, timestamp, ownerId, pathId, version, nodeId, expectedUpdatedAt).run();
    if (result?.meta?.changes !== 1) throw new LearningProgressConflictError();
  }

  const updatedRow = await db.prepare(`
    SELECT * FROM learning_progress
    WHERE owner_id = ? AND path_id = ? AND path_version = ? AND node_id = ?
    LIMIT 1
  `).bind(ownerId, pathId, version, nodeId).first();
  if (!updatedRow) throw new Error('Learning Progress disappeared after update');
  return mapProgressRow(updatedRow);
}

export async function listLearningProgress(db, ownerId, pathId, version, limit = 100) {
  requireDatabase(db);
  requireOwner(ownerId);
  requirePathIdentity(pathId, version);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    throw new TypeError('Learning Progress limit must be between 1 and 100');
  }
  await loadPath(db, ownerId, pathId, version);
  const result = await db.prepare(`
    SELECT * FROM learning_progress
    WHERE owner_id = ? AND path_id = ? AND path_version = ?
    ORDER BY updated_at DESC, node_id ASC
    LIMIT ?
  `).bind(ownerId, pathId, version, limit).all();
  return (result?.results ?? []).map(mapProgressRow);
}
