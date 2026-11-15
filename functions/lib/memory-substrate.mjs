const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const KINDS = new Set(['fact', 'preference', 'decision', 'event', 'procedure', 'artifact']);
const SOURCE_TYPES = new Set([
  'user-stated', 'conversation', 'project-event', 'document', 'system-observation', 'external-source',
]);
const SENSITIVITY = new Set(['public', 'internal', 'private', 'restricted']);
const STATUSES = new Set(['candidate', 'accepted', 'superseded', 'retracted']);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireText(value, label, max = 4000) {
  if (typeof value !== 'string' || !value.trim() || value.length > max ||
      /[\u0000-\u001f\u007f]/.test(value)) {
    throw new TypeError('Invalid memory ' + label);
  }
}

function requireId(value, label) {
  if (typeof value !== 'string' || value.length > 100 || !ID_PATTERN.test(value)) {
    throw new TypeError('Invalid memory ' + label);
  }
}

function validTimestamp(value) {
  if (typeof value !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() ===
    (value.includes('.') ? value : value.replace('Z', '.000Z'));
}

function requireTimestamp(value, label, now) {
  if (!validTimestamp(value) || Date.parse(value) > now) {
    throw new TypeError('Invalid or future memory ' + label);
  }
}

export function validateMemoryRecord(record, now = Date.now()) {
  if (!isRecord(record)) throw new TypeError('Memory record must be an object');
  if (!Number.isFinite(now)) throw new TypeError('Invalid memory validation time');
  requireId(record.id, 'identifier');
  requireId(record.ownerId, 'owner identifier');
  if (record.projectId !== null) requireId(record.projectId, 'project identifier');
  if (!KINDS.has(record.kind)) throw new TypeError('Invalid memory kind');
  requireText(record.content, 'content', 4000);
  if (!isRecord(record.source) || !SOURCE_TYPES.has(record.source.type)) {
    throw new TypeError('Memory provenance is required');
  }
  let sourceUrl;
  requireText(record.source.url, 'source URL', 2048);
  try { sourceUrl = new URL(record.source.url); } catch { throw new TypeError('Invalid memory source URL'); }
  if (sourceUrl.protocol !== 'https:' || !sourceUrl.hostname || sourceUrl.username || sourceUrl.password) {
    throw new TypeError('Invalid memory source URL');
  }
  requireText(record.source.attribution, 'source attribution', 300);
  requireTimestamp(record.source.observedAt, 'source observation time', now);
  if (!Number.isFinite(record.confidence) || record.confidence < 0 || record.confidence > 1) {
    throw new TypeError('Invalid memory confidence');
  }
  if (!SENSITIVITY.has(record.sensitivity)) throw new TypeError('Invalid memory sensitivity');
  if (!STATUSES.has(record.status)) throw new TypeError('Invalid memory status');
  if (!Array.isArray(record.tags) || record.tags.length > 30 ||
      record.tags.some((tag) => typeof tag !== 'string' || !ID_PATTERN.test(tag)) ||
      new Set(record.tags).size !== record.tags.length) {
    throw new TypeError('Invalid memory tags');
  }
  requireTimestamp(record.createdAt, 'creation time', now);
  requireTimestamp(record.updatedAt, 'update time', now);
  if (Date.parse(record.updatedAt) < Date.parse(record.createdAt)) {
    throw new TypeError('Memory update time cannot precede creation time');
  }
  if (record.expiresAt !== null) {
    requireTimestamp(record.expiresAt, 'expiry time', Number.MAX_SAFE_INTEGER);
    if (Date.parse(record.expiresAt) <= Date.parse(record.createdAt)) {
      throw new TypeError('Memory expiry must follow creation time');
    }
  }
  return true;
}

function clone(value) {
  return structuredClone(value);
}

function inScope(record, ownerId, projectId) {
  return record.ownerId === ownerId && record.projectId === projectId;
}

function isRetrievable(record, now) {
  return record.status === 'accepted' &&
    (record.expiresAt === null || Date.parse(record.expiresAt) > now);
}

/**
 * Creates a deterministic, in-memory read model for memory records.
 * Persistence and authenticated owner derivation belong to the API/storage adapter.
 * Every read requires an exact owner and personal-or-project scope.
 */
export function createMemoryStore(records = []) {
  if (!Array.isArray(records) || records.length > 10000) {
    throw new TypeError('Invalid memory record collection');
  }
  const byId = new Map();
  for (const record of records) {
    validateMemoryRecord(record);
    if (byId.has(record.id)) throw new TypeError('Duplicate memory identifier');
    byId.set(record.id, clone(record));
  }

  function validScope(ownerId, projectId) {
    return typeof ownerId === 'string' && ID_PATTERN.test(ownerId) &&
      (projectId === null || (typeof projectId === 'string' && ID_PATTERN.test(projectId)));
  }

  return Object.freeze({
    get(id, { ownerId, projectId = null } = {}) {
      if (!validScope(ownerId, projectId) || typeof id !== 'string' || !ID_PATTERN.test(id)) return null;
      const record = byId.get(id);
      return record && inScope(record, ownerId, projectId) ? clone(record) : null;
    },
    list({ ownerId, projectId = null, now = Date.now(), limit = 20 } = {}) {
      if (!validScope(ownerId, projectId) || !Number.isFinite(now) ||
          !Number.isInteger(limit) || limit < 1 || limit > 50) return [];
      return [...byId.values()]
        .filter((record) => inScope(record, ownerId, projectId) && isRetrievable(record, now))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id))
        .slice(0, limit)
        .map(clone);
    },
    search({ ownerId, projectId = null, query, now = Date.now(), limit = 20 } = {}) {
      if (!validScope(ownerId, projectId) || typeof query !== 'string' ||
          !query.trim() || query.length > 200 || !Number.isFinite(now) ||
          !Number.isInteger(limit) || limit < 1 || limit > 50) return [];
      const terms = [...new Set(query.toLocaleLowerCase().match(/[a-z0-9-]+/g) ?? [])];
      if (!terms.length) return [];
      return [...byId.values()]
        .filter((record) => inScope(record, ownerId, projectId) && isRetrievable(record, now))
        .map((record) => {
          const haystack = [record.content, record.kind, ...record.tags].join(' ').toLocaleLowerCase();
          const score = terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
          return { record, score };
        })
        .filter((item) => item.score === terms.length)
        .sort((a, b) => b.score - a.score ||
          b.record.confidence - a.record.confidence ||
          b.record.updatedAt.localeCompare(a.record.updatedAt) ||
          a.record.id.localeCompare(b.record.id))
        .slice(0, limit)
        .map((item) => clone(item.record));
    },
  });
}
