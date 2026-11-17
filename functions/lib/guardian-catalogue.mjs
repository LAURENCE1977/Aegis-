import { validateResourceRecord } from './guardian-intelligence.mjs';

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function requireDatabase(db) {
  if (!db || typeof db.prepare !== 'function') throw new TypeError('Guardian Resource database is required');
}

function requireOwner(ownerId) {
  if (typeof ownerId !== 'string' || !ID_PATTERN.test(ownerId)) {
    throw new TypeError('Invalid Guardian Resource owner identifier');
  }
}

function parseRecord(value) {
  let record;
  try { record = JSON.parse(value); }
  catch { throw new TypeError('Stored Guardian Resource record is corrupt'); }
  validateResourceRecord(record);
  return record;
}

function mapResourceRow(row) {
  if (!row) return null;
  if (typeof row.id !== 'string' || typeof row.owner_id !== 'string' ||
      typeof row.review_status !== 'string' || typeof row.created_at !== 'string' ||
      typeof row.updated_at !== 'string') {
    throw new TypeError('Stored Guardian Resource metadata is invalid');
  }
  return {
    ...parseRecord(row.record_json),
    ownerId: row.owner_id,
    status: row.review_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createGuardianResource(db, ownerId, input, now = Date.now()) {
  requireDatabase(db);
  requireOwner(ownerId);
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).some((key) => ![
        'name', 'canonicalUrl', 'category', 'sourceRevision',
        'licence', 'pricing', 'hosting', 'limitations',
      ].includes(key))) {
    throw new TypeError('Guardian Resource submission contains unexpected fields');
  }
  if (!Number.isFinite(now)) throw new TypeError('Invalid Guardian Resource clock');
  const timestamp = new Date(now).toISOString();
  const record = {
    id: 'resource-' + crypto.randomUUID().toLowerCase().replaceAll('-', ''),
    ...input,
  };
  validateResourceRecord(record);

  await db.prepare(`
    INSERT INTO guardian_resources (
      id, owner_id, canonical_url, source_revision, record_json,
      review_status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'draft', ?, ?)
    ON CONFLICT(owner_id, canonical_url, source_revision) DO NOTHING
  `).bind(
    record.id, ownerId, record.canonicalUrl, record.sourceRevision,
    JSON.stringify(record), timestamp, timestamp,
  ).run();

  const row = await db.prepare(`
    SELECT * FROM guardian_resources
    WHERE owner_id = ? AND canonical_url = ? AND source_revision = ?
    LIMIT 1
  `).bind(ownerId, record.canonicalUrl, record.sourceRevision).first();
  if (!row) throw new Error('Guardian Resource could not be persisted');
  const resource = mapResourceRow(row);
  return { resource, created: resource.id === record.id };
}

export async function listGuardianResources(db, ownerId, limit = 50) {
  requireDatabase(db);
  requireOwner(ownerId);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new TypeError('Guardian Resource limit must be between 1 and 100');
  }
  const result = await db.prepare(`
    SELECT * FROM guardian_resources
    WHERE owner_id = ?
    ORDER BY updated_at DESC, id ASC
    LIMIT ?
  `).bind(ownerId, limit).all();
  return (result?.results ?? []).map(mapResourceRow);
}
