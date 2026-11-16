import { validateKnowledgeRecord } from './forge-records.mjs';

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const KNOWLEDGE_TYPES = new Set(['research', 'practice', 'standard', 'benchmark', 'pattern', 'technique']);
const EVIDENCE_LEVELS = new Set(['high', 'medium', 'low', 'experimental']);
const KNOWLEDGE_STATUSES = new Set(['draft', 'reviewed', 'accepted', 'superseded']);
const REVIEW_TARGETS = new Set(['reviewed', 'accepted', 'superseded']);
const MAX_QUERY_LENGTH = 120;

export class ForgeKnowledgeConflictError extends Error {
  constructor(message = 'Knowledge record changed; reload before reviewing it again.') {
    super(message);
    this.name = 'ForgeKnowledgeConflictError';
  }
}

function requireDatabase(db) {
  if (!db || typeof db.prepare !== 'function') throw new TypeError('Forge knowledge database is required');
}

function requireOwner(ownerId) {
  if (typeof ownerId !== 'string' || !ID_PATTERN.test(ownerId)) throw new TypeError('Invalid knowledge owner');
}

function parseJson(value, fallback) {
  try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
}

function mapKnowledgeRow(row) {
  if (!row) return null;
  const record = {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    domain: row.domain,
    knowledgeType: row.knowledge_type,
    summary: row.summary,
    evidenceLevel: row.evidence_level,
    status: row.status,
    sources: parseJson(row.sources_json, []),
    limitations: parseJson(row.limitations_json, []),
    applicableCapabilities: parseJson(row.applicable_capabilities_json, []),
    reviewNote: row.review_note || null,
    reviewerId: row.reviewer_id || null,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    reviewedAt: row.reviewed_at || null,
    acceptedAt: row.accepted_at || null,
    supersededAt: row.superseded_at || null,
  };
  validateKnowledgeRecord(record);
  if (!Number.isInteger(record.version) || record.version < 1 ||
      !Number.isFinite(Date.parse(record.createdAt)) ||
      !Number.isFinite(Date.parse(record.updatedAt))) {
    throw new TypeError('Invalid Knowledge Library record metadata');
  }
  return record;
}

function validateCreateInput(input) {
  const allowed = [
    'title', 'domain', 'knowledgeType', 'summary', 'evidenceLevel',
    'sources', 'limitations', 'applicableCapabilities',
  ];
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).some((key) => !allowed.includes(key))) {
    throw new TypeError('Knowledge submission contains unexpected fields');
  }
  const record = {
    id: 'knowledge-' + crypto.randomUUID().toLowerCase().replaceAll('-', ''),
    ...input,
    status: 'draft',
  };
  validateKnowledgeRecord(record);
  return record;
}

export async function createForgeKnowledgeRecord(db, ownerId, input, now = Date.now()) {
  requireDatabase(db);
  requireOwner(ownerId);
  if (!Number.isFinite(now)) throw new TypeError('Invalid knowledge creation time');
  const record = validateCreateInput(input);
  const createdAt = new Date(now).toISOString();
  const result = await db.prepare(
    'INSERT INTO forge_knowledge_records (id, owner_id, title, domain, knowledge_type, summary, evidence_level, status, sources_json, limitations_json, applicable_capabilities_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    record.id, ownerId, record.title, record.domain, record.knowledgeType,
    record.summary, record.evidenceLevel, 'draft', JSON.stringify(record.sources),
    JSON.stringify(record.limitations), JSON.stringify(record.applicableCapabilities),
    createdAt, createdAt,
  ).run();
  if (!result.meta?.changes) throw new ForgeKnowledgeConflictError('Knowledge record could not be created');
  return getForgeKnowledgeRecord(db, ownerId, record.id);
}

export async function getForgeKnowledgeRecord(db, ownerId, id) {
  requireDatabase(db);
  requireOwner(ownerId);
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) throw new TypeError('Invalid knowledge record identifier');
  const row = await db.prepare(
    'SELECT * FROM forge_knowledge_records WHERE id = ? AND owner_id = ?'
  ).bind(id, ownerId).first();
  return mapKnowledgeRow(row);
}

export async function listForgeKnowledgeRecords(db, ownerId, options = {}) {
  requireDatabase(db);
  requireOwner(ownerId);
  if (!options || typeof options !== 'object' || Array.isArray(options) ||
      Object.keys(options).some((key) => !['query', 'domain', 'knowledgeType', 'status', 'limit'].includes(key))) {
    throw new TypeError('Invalid knowledge search options');
  }
  const query = options.query === undefined ? '' : options.query.trim();
  const domain = options.domain === undefined ? null : options.domain;
  const knowledgeType = options.knowledgeType === undefined ? null : options.knowledgeType;
  const status = options.status === undefined ? 'accepted' : options.status;
  const limit = options.limit === undefined ? 50 : options.limit;
  if (typeof query !== 'string' || query.length > MAX_QUERY_LENGTH ||
      /[\u0000-\u001f\u007f]/.test(query)) throw new TypeError('Invalid knowledge search query');
  if (domain !== null && (typeof domain !== 'string' || !ID_PATTERN.test(domain))) {
    throw new TypeError('Invalid knowledge domain filter');
  }
  if (knowledgeType !== null && !KNOWLEDGE_TYPES.has(knowledgeType)) {
    throw new TypeError('Invalid knowledge type filter');
  }
  if (!KNOWLEDGE_STATUSES.has(status) && status !== 'all') throw new TypeError('Invalid knowledge status filter');
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new TypeError('Invalid knowledge search limit');

  const rows = await db.prepare(
    "SELECT * FROM forge_knowledge_records WHERE owner_id = ? AND (? = 'all' OR status = ?) AND (? IS NULL OR domain = ?) AND (? IS NULL OR knowledge_type = ?) AND (? = '' OR instr(lower(title), lower(?)) > 0 OR instr(lower(summary), lower(?)) > 0 OR instr(lower(domain), lower(?)) > 0 OR instr(lower(sources_json), lower(?)) > 0 OR instr(lower(applicable_capabilities_json), lower(?)) > 0) ORDER BY updated_at DESC, id ASC LIMIT ?"
  ).bind(
    ownerId, status, status, domain, domain, knowledgeType, knowledgeType,
    query, query, query, query, query, limit,
  ).all();
  return (rows.results || []).map(mapKnowledgeRow);
}

export async function updateForgeKnowledgeReview(db, ownerId, id, input, now = Date.now()) {
  requireDatabase(db);
  requireOwner(ownerId);
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) throw new TypeError('Invalid knowledge record identifier');
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).some((key) => !['status', 'reviewNote', 'expectedUpdatedAt'].includes(key)) ||
      !REVIEW_TARGETS.has(input.status) ||
      typeof input.reviewNote !== 'string' || input.reviewNote.trim().length < 10 ||
      input.reviewNote.length > 1000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(input.reviewNote) ||
      typeof input.expectedUpdatedAt !== 'string' || !Number.isFinite(Date.parse(input.expectedUpdatedAt)) ||
      !Number.isFinite(now)) {
    throw new TypeError('Invalid knowledge review decision');
  }

  const current = await getForgeKnowledgeRecord(db, ownerId, id);
  if (!current) return null;
  if (current.updatedAt !== input.expectedUpdatedAt) throw new ForgeKnowledgeConflictError();

  const allowedTransition =
    (current.status === 'draft' && input.status === 'reviewed') ||
    (current.status === 'reviewed' && input.status === 'accepted' &&
      ['high', 'medium'].includes(current.evidenceLevel)) ||
    (current.status === 'accepted' && input.status === 'superseded');
  if (!allowedTransition) throw new TypeError('Knowledge status transition is not allowed');
  const updatedAt = new Date(Math.max(now, Date.parse(current.updatedAt) + 1)).toISOString();
  const result = await db.prepare(
    "UPDATE forge_knowledge_records SET status = ?, review_note = ?, reviewer_id = ?, updated_at = ?, version = version + 1, reviewed_at = CASE WHEN ? = 'reviewed' THEN ? ELSE reviewed_at END, accepted_at = CASE WHEN ? = 'accepted' THEN ? ELSE accepted_at END, superseded_at = CASE WHEN ? = 'superseded' THEN ? ELSE superseded_at END WHERE id = ? AND owner_id = ? AND updated_at = ? AND status = ?"
  ).bind(
    input.status, input.reviewNote.trim(), ownerId, updatedAt,
    input.status, updatedAt, input.status, updatedAt, input.status, updatedAt,
    id, ownerId, input.expectedUpdatedAt, current.status,
  ).run();
  if (!result.meta?.changes) throw new ForgeKnowledgeConflictError();
  return getForgeKnowledgeRecord(db, ownerId, id);
}

export async function listForgeKnowledgeEvents(db, ownerId, id, limit = 50) {
  requireDatabase(db);
  requireOwner(ownerId);
  if (typeof id !== 'string' || !ID_PATTERN.test(id) ||
      !Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new TypeError('Invalid knowledge event query');
  }
  if (!(await getForgeKnowledgeRecord(db, ownerId, id))) return null;
  const rows = await db.prepare(
    'SELECT * FROM forge_knowledge_events WHERE record_id = ? AND owner_id = ? ORDER BY occurred_at DESC, id DESC LIMIT ?'
  ).bind(id, ownerId, limit).all();
  return (rows.results || []).map((row) => ({
    id: row.id,
    recordId: row.record_id,
    ownerId: row.owner_id,
    eventType: row.event_type,
    fromStatus: row.from_status || null,
    toStatus: row.to_status,
    detail: parseJson(row.detail_json, {}),
    occurredAt: row.occurred_at,
  }));
}
