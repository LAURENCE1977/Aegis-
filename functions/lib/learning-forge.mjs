import { validateLearningGraph } from './guardian-intelligence.mjs';

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VERSION_PATTERN = /^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)$/;
const OWNER_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const MAX_PAGE_SIZE = 100;

function requireDatabase(db) {
  if (!db || typeof db.prepare !== 'function') throw new TypeError('Learning Forge database is required');
}
function requireOwner(ownerId) {
  if (typeof ownerId !== 'string' || !OWNER_PATTERN.test(ownerId)) throw new TypeError('Invalid Learning Forge owner identifier');
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
function validateLearningPath(path) {
  if (!path || typeof path !== 'object' || Array.isArray(path) ||
      Object.keys(path).some(key => !['id', 'version', 'title', 'description', 'nodes'].includes(key)) ||
      !['id', 'version', 'title', 'description', 'nodes'].every(key => Object.hasOwn(path, key))) {
    throw new TypeError('Invalid Learning Path fields');
  }
  if (typeof path.id !== 'string' || path.id.length > 80 || !ID_PATTERN.test(path.id)) {
    throw new TypeError('Invalid Learning Path identifier');
  }
  if (typeof path.version !== 'string' || !VERSION_PATTERN.test(path.version)) {
    throw new TypeError('Invalid Learning Path version');
  }
  if (typeof path.title !== 'string' || !path.title.trim() || path.title.length > 200) {
    throw new TypeError('Invalid Learning Path title');
  }
  if (typeof path.description !== 'string' || path.description.length > 1000 ||
      /[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f]/.test(path.description)) {
    throw new TypeError('Invalid Learning Path description');
  }
  validateLearningGraph(path.nodes);
}
function mapPathRow(row) {
  if (!row || typeof row.owner_id !== 'string' || typeof row.path_id !== 'string' ||
      typeof row.version !== 'string' || typeof row.graph_digest !== 'string' ||
      typeof row.graph_json !== 'string' || typeof row.created_at !== 'string') {
    throw new TypeError('Stored Learning Path metadata is invalid');
  }
  let path;
  try { path = JSON.parse(row.graph_json); }
  catch { throw new TypeError('Stored Learning Path JSON is corrupt'); }
  validateLearningPath(path);
  if (path.id !== row.path_id || path.version !== row.version) {
    throw new TypeError('Stored Learning Path identity does not match its record');
  }
  return Object.freeze({ ownerId: row.owner_id, path, digest: row.graph_digest, createdAt: row.created_at });
}

export class LearningPathConflictError extends Error {
  constructor() {
    super('Learning Path version already exists with different content');
    this.name = 'LearningPathConflictError';
    this.status = 409;
  }
}

export async function registerLearningPath(db, ownerId, path, now = Date.now()) {
  requireDatabase(db);
  requireOwner(ownerId);
  validateLearningPath(path);
  if (!Number.isFinite(now)) throw new TypeError('Invalid Learning Forge clock');
  const json = canonicalJson(path);
  const digest = await sha256Hex(json);
  const timestamp = new Date(now).toISOString();
  const id = 'learning-path-' + crypto.randomUUID().toLowerCase().replaceAll('-', '');
  await db.prepare(`
    INSERT INTO learning_paths (
      id, owner_id, path_id, version, graph_digest, graph_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(owner_id, path_id, version) DO NOTHING
  `).bind(id, ownerId, path.id, path.version, digest, json, timestamp).run();
  const row = await db.prepare(`
    SELECT * FROM learning_paths
    WHERE owner_id = ? AND path_id = ? AND version = ?
    LIMIT 1
  `).bind(ownerId, path.id, path.version).first();
  if (!row) throw new Error('Learning Path could not be persisted');
  const stored = mapPathRow(row);
  if (stored.digest !== digest) throw new LearningPathConflictError();
  return { ...stored, created: row.id === id };
}

export async function listLearningPaths(db, ownerId, limit = 50) {
  requireDatabase(db);
  requireOwner(ownerId);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    throw new TypeError('Learning Forge limit must be between 1 and 100');
  }
  const result = await db.prepare(`
    SELECT * FROM learning_paths
    WHERE owner_id = ?
    ORDER BY created_at DESC, path_id ASC, version DESC
    LIMIT ?
  `).bind(ownerId, limit).all();
  return (result?.results ?? []).map(mapPathRow);
}
