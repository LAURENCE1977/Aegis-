import { verifyAgentExperimentRecordDigest } from './agent-experiment-record.mjs';

const PRINCIPAL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,79}$/;
const RECORD_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/;
const MAX_RECORD_BYTES = 256 * 1024;
const MAX_PAGE_SIZE = 100;

function validatePrincipalId(value) {
  if (typeof value !== 'string' || !PRINCIPAL_PATTERN.test(value)) {
    throw new TypeError('Authenticated principal identifier is invalid.');
  }
  return value;
}

function validateRecordId(value) {
  if (typeof value !== 'string' || !RECORD_ID_PATTERN.test(value)) {
    throw new TypeError('Experiment record identifier is invalid.');
  }
  return value;
}

function requireDatabase(db) {
  if (!db || typeof db.prepare !== 'function') {
    throw new TypeError('A D1-compatible database binding is required.');
  }
  return db;
}

function parseStoredRecord(row, principalId) {
  if (!row) return null;
  let record;
  try {
    record = JSON.parse(row.record_json);
  } catch {
    throw new Error('Stored experiment record is not valid JSON.');
  }
  if (row.principal_id !== principalId ||
      record?.ownerId !== principalId ||
      record?.id !== row.record_id ||
      record?.recordDigest !== row.record_digest ||
      !(awaitableDigestShape(record?.recordDigest))) {
    throw new Error('Stored experiment record ownership or metadata is inconsistent.');
  }
  return record;
}

function awaitableDigestShape(value) {
  return typeof value === 'string' && /^sha256:[a-f0-9]{64}$/.test(value);
}

async function verifyStoredRecord(row, principalId) {
  const record = parseStoredRecord(row, principalId);
  if (!record || !(await verifyAgentExperimentRecordDigest(record))) {
    throw new Error('Stored experiment record failed integrity verification.');
  }
  return record;
}

function eventTimestamp(record) {
  return record.createdAt;
}

/**
 * Append a previously built record under a server-authenticated principal.
 *
 * IMPORTANT: principalId must come from a verified server-side identity
 * context. Never pass a request body, query parameter, or record.ownerId as
 * the authority for this argument. This module intentionally exposes no HTTP
 * route; the current runtime bearer token authenticates a service, not a user.
 */
export async function appendExperimentRecord(db, principalId, record) {
  requireDatabase(db);
  validatePrincipalId(principalId);
  if (!record || record.ownerId !== principalId || !RECORD_ID_PATTERN.test(record.id || '')) {
    throw new TypeError('Experiment record owner must match the authenticated principal.');
  }
  if (record.schemaVersion !== 'aegis.experiment-record.v1' ||
      !(await verifyAgentExperimentRecordDigest(record))) {
    throw new TypeError('A valid, integrity-checked experiment record is required.');
  }

  const serialized = JSON.stringify(record);
  if (new TextEncoder().encode(serialized).byteLength > MAX_RECORD_BYTES) {
    throw new TypeError('Experiment record exceeds the 256 KiB storage limit.');
  }

  const inserted = await db.prepare(
    'INSERT INTO experiment_records (principal_id, record_id, schema_version, record_digest, record_json, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(principal_id, record_id) DO NOTHING'
  ).bind(
    principalId,
    record.id,
    record.schemaVersion,
    record.recordDigest,
    serialized,
    eventTimestamp(record),
  ).run();

  const stored = await db.prepare(
    'SELECT principal_id, record_id, record_digest, record_json FROM experiment_records WHERE principal_id = ? AND record_id = ?'
  ).bind(principalId, record.id).first();

  if (!stored) throw new Error('Experiment record could not be persisted.');
  if (stored.record_digest !== record.recordDigest || stored.record_json !== serialized) {
    throw new Error('Experiment record identifier already exists with different immutable content.');
  }

  // Idempotent recovery: if a previous attempt inserted the row but failed
  // before its audit event, this insert repairs the missing event.
  await db.prepare(
    "INSERT INTO experiment_record_events (event_id, principal_id, record_id, actor_principal_id, event_type, record_digest, created_at) VALUES (?, ?, ?, ?, 'created', ?, ?) ON CONFLICT(event_id) DO NOTHING"
  ).bind(
    'created:' + principalId + ':' + record.id,
    principalId,
    record.id,
    principalId,
    record.recordDigest,
    eventTimestamp(record),
  ).run();

  return {
    created: Number(inserted?.meta?.changes || 0) > 0,
    record,
  };
}

/** Read only within the supplied authenticated principal's namespace. */
export async function getExperimentRecord(db, principalId, recordId) {
  requireDatabase(db);
  validatePrincipalId(principalId);
  validateRecordId(recordId);

  const row = await db.prepare(
    "SELECT r.principal_id, r.record_id, r.record_digest, r.record_json FROM experiment_records r WHERE r.principal_id = ? AND r.record_id = ? AND NOT EXISTS (SELECT 1 FROM experiment_record_events e WHERE e.principal_id = r.principal_id AND e.record_id = r.record_id AND e.event_type = 'tombstoned')"
  ).bind(principalId, recordId).first();

  return verifyStoredRecord(row, principalId);
}

/** List records in one principal namespace; never accepts a caller-selected owner. */
export async function listExperimentRecords(db, principalId, limit = 25) {
  requireDatabase(db);
  validatePrincipalId(principalId);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    throw new TypeError('Experiment record page size must be between 1 and 100.');
  }

  const result = await db.prepare(
    "SELECT r.principal_id, r.record_id, r.record_digest, r.record_json FROM experiment_records r WHERE r.principal_id = ? AND NOT EXISTS (SELECT 1 FROM experiment_record_events e WHERE e.principal_id = r.principal_id AND e.record_id = r.record_id AND e.event_type = 'tombstoned') ORDER BY r.created_at DESC, r.record_id DESC LIMIT ?"
  ).bind(principalId, limit).all();

  const records = [];
  for (const row of result.results || []) {
    records.push(await verifyStoredRecord(row, principalId));
  }
  return records;
}

/**
 * Logical deletion hides a record from normal reads and appends a tombstone.
 * It does NOT erase the stored payload; physical retention/purge needs a
 * separately authorised and tested policy.
 */
export async function tombstoneExperimentRecord(db, principalId, recordId, deletedAt = new Date().toISOString()) {
  requireDatabase(db);
  validatePrincipalId(principalId);
  validateRecordId(recordId);
  const date = new Date(deletedAt);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== deletedAt) {
    throw new TypeError('Deletion timestamp must be a canonical UTC timestamp.');
  }

  const row = await db.prepare(
    'SELECT principal_id, record_id, record_digest FROM experiment_records WHERE principal_id = ? AND record_id = ?'
  ).bind(principalId, recordId).first();
  if (!row) return false;

  await db.prepare(
    "INSERT INTO experiment_record_events (event_id, principal_id, record_id, actor_principal_id, event_type, record_digest, created_at) VALUES (?, ?, ?, ?, 'tombstoned', ?, ?) ON CONFLICT(event_id) DO NOTHING"
  ).bind(
    'tombstoned:' + principalId + ':' + recordId,
    principalId,
    recordId,
    principalId,
    row.record_digest,
    deletedAt,
  ).run();
  return true;
}
