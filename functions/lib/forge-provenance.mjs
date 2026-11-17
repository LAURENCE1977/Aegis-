const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CAPABILITY_PATTERN = /^[a-z][a-z0-9-]{0,31}\.[a-z][a-z0-9-]{0,47}$/;
const SHA_PATTERN = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i;
const INSPECTION_DEPTHS = new Set(['metadata-only', 'readme-only', 'source-level', 'full']);
const LICENCE_REVIEWS = new Set(['verified', 'review-required', 'unknown']);
const COMPONENT_KINDS = new Set(['code', 'dependency', 'model', 'dataset', 'asset', 'font', 'hardware', 'build-tool']);
const DECISIONS = new Set(['unassessed', 'reuse', 'adapt', 'rebuild', 'combine', 'reject']);
const STATUSES = new Set(['discovered', 'inspected', 'assessed', 'approved', 'rejected', 'archived']);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, keys, label) {
  if (!isRecord(value) || Object.keys(value).length !== keys.length ||
      Object.keys(value).some((key) => !keys.includes(key))) {
    throw new TypeError('Invalid ' + label + ' fields');
  }
}

function requireText(value, label, max = 300) {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim() ||
      value.length > max || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new TypeError('Invalid ' + label);
  }
}

function requireHttpsUrl(value, label, { repository = false } = {}) {
  requireText(value, label, 2048);
  let url;
  try { url = new URL(value); } catch { throw new TypeError('Invalid ' + label); }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password ||
      url.search || url.hash || (repository && url.pathname.split('/').filter(Boolean).length < 2)) {
    throw new TypeError('Invalid ' + label);
  }
}

function validateLicence(licence, label) {
  exactKeys(licence, ['identifier', 'licenceFileUrl', 'review'], label);
  requireText(licence.identifier, label + ' identifier', 100);
  requireHttpsUrl(licence.licenceFileUrl, label + ' file URL');
  if (!LICENCE_REVIEWS.has(licence.review)) throw new TypeError('Invalid ' + label + ' review');
}

function validateComponent(component) {
  exactKeys(component, ['kind', 'name', 'identifier', 'licenceFileUrl', 'review'], 'provenance component');
  if (!COMPONENT_KINDS.has(component.kind)) throw new TypeError('Invalid provenance component kind');
  requireText(component.name, 'provenance component name', 160);
  requireText(component.identifier, 'component licence identifier', 100);
  requireHttpsUrl(component.licenceFileUrl, 'component licence file URL');
  if (!LICENCE_REVIEWS.has(component.review)) throw new TypeError('Invalid component licence review');
}

export function validateSourceProvenanceRecord(record) {
  exactKeys(record, [
    'id', 'canonicalUrl', 'revision', 'inspectedAt', 'inspectionDepth',
    'licence', 'components', 'capabilities', 'decision', 'status', 'evidence',
  ], 'source provenance record');

  if (typeof record.id !== 'string' || record.id.length > 80 || !ID_PATTERN.test(record.id)) {
    throw new TypeError('Invalid provenance record identifier');
  }
  requireHttpsUrl(record.canonicalUrl, 'canonical source URL', { repository: true });
  if (!SHA_PATTERN.test(record.revision)) {
    throw new TypeError('A pinned immutable 40- or 64-character source revision is required');
  }
  if (typeof record.inspectedAt !== 'string' || !Number.isFinite(Date.parse(record.inspectedAt)) ||
      new Date(record.inspectedAt).toISOString() !== record.inspectedAt) {
    throw new TypeError('Invalid provenance inspection timestamp');
  }
  if (!INSPECTION_DEPTHS.has(record.inspectionDepth)) throw new TypeError('Invalid provenance inspection depth');

  validateLicence(record.licence, 'source licence');
  if (!Array.isArray(record.components) || record.components.length > 100) {
    throw new TypeError('Invalid provenance component inventory');
  }
  record.components.forEach(validateComponent);

  if (!Array.isArray(record.capabilities) || record.capabilities.length > 100 ||
      record.capabilities.some((item) => typeof item !== 'string' || !CAPABILITY_PATTERN.test(item)) ||
      new Set(record.capabilities).size !== record.capabilities.length) {
    throw new TypeError('Invalid provenance capabilities');
  }
  if (!DECISIONS.has(record.decision)) throw new TypeError('Invalid provenance decision');
  if (!STATUSES.has(record.status)) throw new TypeError('Invalid provenance status');

  if (!Array.isArray(record.evidence) || record.evidence.length > 100) {
    throw new TypeError('Invalid provenance evidence');
  }
  for (const item of record.evidence) {
    exactKeys(item, ['url', 'note'], 'provenance evidence');
    requireHttpsUrl(item.url, 'provenance evidence URL');
    requireText(item.note, 'provenance evidence note', 500);
  }

  const allLicencesVerified = record.licence.review === 'verified' &&
    record.components.every((component) => component.review === 'verified');
  if (['reuse', 'adapt', 'combine'].includes(record.decision) && !allLicencesVerified) {
    throw new TypeError('Reuse, adaptation and combination require verified source and component licences');
  }
  if (record.status === 'approved' &&
      (!allLicencesVerified || !['source-level', 'full'].includes(record.inspectionDepth) ||
       !['reuse', 'adapt', 'combine', 'rebuild'].includes(record.decision))) {
    throw new TypeError('Approved provenance requires source-level inspection and verified component licences');
  }
  return true;
}


const OWNER_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function requireDatabase(db) {
  if (!db || typeof db.prepare !== 'function') throw new TypeError('Forge provenance database is required');
}

function requireProvenanceOwner(ownerId) {
  if (typeof ownerId !== 'string' || !OWNER_PATTERN.test(ownerId)) {
    throw new TypeError('Invalid Forge provenance owner');
  }
}

function mapProvenanceRow(row) {
  if (!row) return null;
  let record;
  try { record = JSON.parse(row.record_json); }
  catch { throw new TypeError('Stored Forge provenance record is corrupt'); }
  validateSourceProvenanceRecord(record);
  return { ...record, ownerId: row.owner_id, createdAt: row.created_at, updatedAt: row.updated_at };
}

export class ForgeProvenanceConflictError extends Error {
  constructor() {
    super('Forge provenance record could not be persisted consistently.');
    this.name = 'ForgeProvenanceConflictError';
  }
}

export async function createForgeProvenanceRecord(db, ownerId, input, now = Date.now()) {
  requireDatabase(db);
  requireProvenanceOwner(ownerId);
  if (!Number.isFinite(now)) throw new TypeError('Invalid Forge provenance clock');
  validateSourceProvenanceRecord(input);

  const timestamp = new Date(now).toISOString();
  const id = crypto.randomUUID().toLowerCase();
  const recordJson = JSON.stringify(input);
  await db.prepare(`
    INSERT INTO forge_source_provenance (
      id, owner_id, canonical_url, revision, record_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(owner_id, canonical_url, revision) DO NOTHING
  `).bind(id, ownerId, input.canonicalUrl, input.revision, recordJson, timestamp, timestamp).run();

  const row = await db.prepare(`
    SELECT * FROM forge_source_provenance
    WHERE owner_id = ? AND canonical_url = ? AND revision = ?
    LIMIT 1
  `).bind(ownerId, input.canonicalUrl, input.revision).first();
  if (!row) throw new ForgeProvenanceConflictError();
  const record = mapProvenanceRow(row);
  return { record, created: row.id === id };
}

export async function listForgeProvenanceRecords(db, ownerId, limit = 50) {
  requireDatabase(db);
  requireProvenanceOwner(ownerId);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new TypeError('Forge provenance limit must be between 1 and 100');
  }
  const result = await db.prepare(`
    SELECT * FROM forge_source_provenance
    WHERE owner_id = ?
    ORDER BY updated_at DESC, id ASC
    LIMIT ?
  `).bind(ownerId, limit).all();
  return (result?.results ?? []).map(mapProvenanceRow);
}
