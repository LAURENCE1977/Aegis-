import { validateEvaluationSuite } from './eval-forge.mjs';

const OWNER_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const MAX_PAGE_SIZE = 100;

function requireDatabase(db) {
  if (!db || typeof db.prepare !== 'function') throw new TypeError('Eval Forge database is required');
}

function requireOwner(ownerId) {
  if (typeof ownerId !== 'string' || !OWNER_PATTERN.test(ownerId)) {
    throw new TypeError('Invalid Eval Forge owner identifier');
  }
}

function canonicalJson(value) {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(key =>
      JSON.stringify(key) + ':' + canonicalJson(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

async function sha256Hex(value) {
  if (!globalThis.crypto?.subtle) throw new Error('Web Crypto SHA-256 is unavailable');
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function mapSuiteRow(row) {
  if (!row || typeof row.owner_id !== 'string' || typeof row.suite_id !== 'string' ||
      typeof row.version !== 'string' || typeof row.suite_digest !== 'string' ||
      typeof row.suite_json !== 'string' || typeof row.created_at !== 'string') {
    throw new TypeError('Stored Eval Forge suite metadata is invalid');
  }
  let suite;
  try { suite = JSON.parse(row.suite_json); }
  catch { throw new TypeError('Stored Eval Forge suite JSON is corrupt'); }
  validateEvaluationSuite(suite);
  if (suite.id !== row.suite_id || suite.version !== row.version) {
    throw new TypeError('Stored Eval Forge suite identity does not match its record');
  }
  return Object.freeze({
    ownerId: row.owner_id,
    suite,
    digest: row.suite_digest,
    createdAt: row.created_at,
  });
}

export class EvaluationSuiteConflictError extends Error {
  constructor() {
    super('Evaluation suite version already exists with different content');
    this.name = 'EvaluationSuiteConflictError';
    this.status = 409;
  }
}

export async function registerEvaluationSuite(db, ownerId, suite, now = Date.now()) {
  requireDatabase(db);
  requireOwner(ownerId);
  validateEvaluationSuite(suite);
  if (!Number.isFinite(now)) throw new TypeError('Invalid Eval Forge clock');

  const json = canonicalJson(suite);
  const digest = await sha256Hex(json);
  const timestamp = new Date(now).toISOString();
  const id = 'eval-suite-' + crypto.randomUUID().toLowerCase().replaceAll('-', '');

  await db.prepare(`
    INSERT INTO eval_suites (
      id, owner_id, suite_id, version, suite_digest, suite_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(owner_id, suite_id, version) DO NOTHING
  `).bind(id, ownerId, suite.id, suite.version, digest, json, timestamp).run();

  const row = await db.prepare(`
    SELECT * FROM eval_suites
    WHERE owner_id = ? AND suite_id = ? AND version = ?
    LIMIT 1
  `).bind(ownerId, suite.id, suite.version).first();
  if (!row) throw new Error('Evaluation suite could not be persisted');
  const stored = mapSuiteRow(row);
  if (stored.digest !== digest) throw new EvaluationSuiteConflictError();
  return { ...stored, created: row.id === id };
}

export async function listEvaluationSuites(db, ownerId, limit = 50) {
  requireDatabase(db);
  requireOwner(ownerId);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    throw new TypeError('Eval Forge limit must be between 1 and 100');
  }
  const result = await db.prepare(`
    SELECT * FROM eval_suites
    WHERE owner_id = ?
    ORDER BY created_at DESC, suite_id ASC, version DESC
    LIMIT ?
  `).bind(ownerId, limit).all();
  return (result?.results ?? []).map(mapSuiteRow);
}
