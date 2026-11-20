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
      !(isDigest(record?.recordDigest))) {
    throw new Error('Stored experiment record ownership or metadata is inconsistent.');
  }
  return record;
}

function isDigest(value) {
  return typeof value === 'string' && /^sha256:[a-f0-9]{64}$/.test(value);
}

async function verifyStoredRecord(row, principalId) {
  const record = parseStoredRecord(row, principalId);
  if (!record) return null;
  if (!(await verifyAgentExperimentRecordDigest(record))) {
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
    new Date().toISOString(),
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

/** List one principal's history with stable keyset pagination. */
export async function listExperimentRecords(db, principalId, options = {}) {
  requireDatabase(db);
  validatePrincipalId(principalId);
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('Experiment record list options must be an object.');
  }
  const limit = options.limit === undefined ? 25 : options.limit;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    throw new TypeError('Experiment record page size must be between 1 and 100.');
  }

  const cursor = options.cursor === undefined ? null : options.cursor;
  if (cursor !== null) {
    if (!cursor || typeof cursor !== 'object' || Array.isArray(cursor)) {
      throw new TypeError('Experiment record cursor is invalid.');
    }
    const date = new Date(cursor.createdAt);
    if (typeof cursor.createdAt !== 'string' ||
        !Number.isFinite(date.getTime()) ||
        date.toISOString() !== cursor.createdAt) {
      throw new TypeError('Experiment record cursor timestamp must be canonical UTC.');
    }
    validateRecordId(cursor.recordId);
  }

  const statement = cursor
    ? db.prepare(
      "SELECT r.principal_id, r.record_id, r.record_digest, r.record_json, r.created_at FROM experiment_records r WHERE r.principal_id = ? AND (r.created_at < ? OR (r.created_at = ? AND r.record_id < ?)) AND NOT EXISTS (SELECT 1 FROM experiment_record_events e WHERE e.principal_id = r.principal_id AND e.record_id = r.record_id AND e.event_type = 'tombstoned') ORDER BY r.created_at DESC, r.record_id DESC LIMIT ?"
    ).bind(principalId, cursor.createdAt, cursor.createdAt, cursor.recordId, limit + 1)
    : db.prepare(
      "SELECT r.principal_id, r.record_id, r.record_digest, r.record_json, r.created_at FROM experiment_records r WHERE r.principal_id = ? AND NOT EXISTS (SELECT 1 FROM experiment_record_events e WHERE e.principal_id = r.principal_id AND e.record_id = r.record_id AND e.event_type = 'tombstoned') ORDER BY r.created_at DESC, r.record_id DESC LIMIT ?"
    ).bind(principalId, limit + 1);

  const result = await statement.all();
  const rows = result.results || [];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const records = [];
  for (const row of page) {
    records.push(await verifyStoredRecord(row, principalId));
  }
  const last = page[page.length - 1];
  return {
    records,
    nextCursor: hasMore && last
      ? { createdAt: last.created_at, recordId: last.record_id }
      : null,
  };
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
