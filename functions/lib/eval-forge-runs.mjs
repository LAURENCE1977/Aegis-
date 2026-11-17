import { verifyEvaluationRunEvidence } from './eval-evidence.mjs';

const OWNER_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const RUN_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
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
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function mapRunRow(row) {
  if (!row || typeof row.owner_id !== 'string' || typeof row.run_id !== 'string' ||
      typeof row.suite_id !== 'string' || typeof row.suite_version !== 'string' ||
      typeof row.suite_digest !== 'string' || typeof row.result_digest !== 'string' ||
      typeof row.result_json !== 'string' || typeof row.recorded_at !== 'string') {
    throw new TypeError('Stored Eval Forge run metadata is invalid');
  }
  let run;
  try { run = JSON.parse(row.result_json); }
  catch { throw new TypeError('Stored Eval Forge run result is corrupt'); }
  if (run.id !== row.run_id || run.suiteId !== row.suite_id ||
      run.suiteVersion !== row.suite_version || run.candidateDigest !== row.candidate_digest ||
      run.evidenceVerified !== true) {
    throw new TypeError('Stored Eval Forge run result does not match its verified record');
  }
  return Object.freeze({
    ownerId: row.owner_id,
    run,
    resultDigest: row.result_digest,
    recordedAt: row.recorded_at,
  });
}

export class EvaluationRunConflictError extends Error {
  constructor() {
    super('Evaluation run identifier already exists with different result');
    this.name = 'EvaluationRunConflictError';
    this.status = 409;
  }
}

/**
 * Stores only a deterministic result whose candidate and per-case evidence
 * bytes have been verified against the registered immutable suite version.
 * This is byte-integrity verification, not authenticated runner attestation.
 */
export async function persistEvaluationRun(db, ownerId, suite, run, evidenceInput, now = Date.now()) {
  requireDatabase(db);
  requireOwner(ownerId);
  if (!Number.isFinite(now)) throw new TypeError('Invalid Eval Forge clock');

  const suiteRow = await db.prepare(`
    SELECT * FROM eval_suites
    WHERE owner_id = ? AND suite_id = ? AND version = ?
    LIMIT 1
  `).bind(ownerId, suite?.id, suite?.version).first();
  if (!suiteRow) throw new TypeError('Evaluation run requires a registered suite version');

  const canonicalSuite = canonicalJson(suite);
  const expectedSuiteDigest = await sha256Hex(canonicalSuite);
  if (suiteRow.suite_digest !== expectedSuiteDigest) {
    throw new TypeError('Evaluation suite content does not match the registered suite version');
  }

  const verified = await verifyEvaluationRunEvidence(suite, run, evidenceInput);
  const resultJson = canonicalJson(verified);
  const resultDigest = await sha256Hex(resultJson);
  const timestamp = new Date(now).toISOString();
  const id = 'eval-run-' + crypto.randomUUID().toLowerCase().replaceAll('-', '');

  await db.prepare(`
    INSERT INTO eval_runs (
      id, owner_id, run_id, suite_id, suite_version, suite_digest,
      candidate_id, candidate_version, candidate_digest, status, score_percent,
      result_digest, result_json, completed_at, recorded_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(owner_id, run_id) DO NOTHING
  `).bind(
    id, ownerId, verified.id, verified.suiteId, verified.suiteVersion,
    expectedSuiteDigest, verified.candidateId, verified.candidateVersion,
    verified.candidateDigest, verified.status, verified.scorePercent,
    resultDigest, resultJson, verified.completedAt, timestamp,
  ).run();

  const row = await db.prepare(`
    SELECT * FROM eval_runs WHERE owner_id = ? AND run_id = ? LIMIT 1
  `).bind(ownerId, verified.id).first();
  if (!row) throw new Error('Evaluation run could not be persisted');
  const stored = mapRunRow(row);
  if (stored.resultDigest !== resultDigest) throw new EvaluationRunConflictError();
  return { ...stored, created: row.id === id };
}

export async function listEvaluationRuns(db, ownerId, limit = 50) {
  requireDatabase(db);
  requireOwner(ownerId);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    throw new TypeError('Eval Forge limit must be between 1 and 100');
  }
  const result = await db.prepare(`
    SELECT * FROM eval_runs
    WHERE owner_id = ?
    ORDER BY recorded_at DESC, run_id ASC
    LIMIT ?
  `).bind(ownerId, limit).all();
  return (result?.results ?? []).map(mapRunRow);
}
