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
  if (record.supersedesId !== undefined && record.supersedesId !== null) requireId(record.supersedesId, 'superseded memory identifier');
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


function tokenizeMemoryText(value) {
  return String(value || '').toLocaleLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function rankMemoryRecords(records, terms, limit) {
  if (!records.length || !terms.length) return [];
  const documents = records.map((record) => {
    const frequencies = new Map();
    let length = 0;
    const addTokens = (tokens, weight) => {
      length += tokens.length * weight;
      for (const token of tokens) {
        frequencies.set(token, (frequencies.get(token) || 0) + weight);
      }
    };
    addTokens(tokenizeMemoryText(record.content), 1);
    addTokens(tokenizeMemoryText(record.kind), 1.5);
    addTokens(tokenizeMemoryText((record.tags || []).join(' ')), 2);
    return { record, frequencies, length };
  });
  const averageLength = documents.reduce((sum, item) => sum + item.length, 0) / documents.length || 1;
  const documentFrequency = new Map(terms.map((term) => [
    term,
    documents.reduce((count, item) => count + (item.frequencies.has(term) ? 1 : 0), 0),
  ]));
  const k1 = 1.2;
  const b = 0.75;
  return documents.map((item) => {
    let score = 0;
    for (const term of terms) {
      const frequency = item.frequencies.get(term) || 0;
      if (!frequency) continue;
      const df = documentFrequency.get(term) || 0;
      const inverseFrequency = Math.log(1 + (documents.length - df + 0.5) / (df + 0.5));
      const normalization = frequency + k1 * (1 - b + b * item.length / averageLength);
      score += inverseFrequency * (frequency * (k1 + 1)) / normalization;
    }
    return { record: item.record, score };
  })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score ||
      b.record.confidence - a.record.confidence ||
      b.record.updatedAt.localeCompare(a.record.updatedAt) ||
      a.record.id.localeCompare(b.record.id))
    .slice(0, limit)
    .map((item) => clone(item.record));
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
      if (!validScope(ownerId, projectId) || !Number.isFinite(now)) return [];
      if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new TypeError('Invalid memory result limit');
      return [...byId.values()]
        .filter((record) => inScope(record, ownerId, projectId) && isRetrievable(record, now))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id))
        .slice(0, limit)
        .map(clone);
    },
    search({ ownerId, projectId = null, query, now = Date.now(), limit = 20 } = {}) {
      if (!validScope(ownerId, projectId) || typeof query !== 'string' ||
          !query.trim() || query.length > 200 || !Number.isFinite(now)) return [];
      if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new TypeError('Invalid memory result limit');
      const terms = [...new Set(tokenizeMemoryText(query))];
      if (!terms.length) return [];
      const candidates = [...byId.values()]
        .filter((record) => inScope(record, ownerId, projectId) &&
          isRetrievable(record, now) && record.sensitivity !== 'restricted');
      return rankMemoryRecords(candidates, terms, limit);
    },
  });
}


function mapMemoryRow(row) {
  if (!row) return null;
  let tags;
  try { tags = JSON.parse(row.tags_json); } catch { throw new TypeError('Stored memory tags are corrupt'); }
  const record = {
    id: row.id,
    ownerId: row.owner_id,
    projectId: row.project_id,
    supersedesId: row.supersedes_id ?? null,
    kind: row.kind,
    content: row.content,
    source: {
      type: row.source_type,
      url: row.source_url,
      attribution: row.source_attribution,
      observedAt: row.source_observed_at,
      trust: "untrusted",
    },
    confidence: row.confidence,
    sensitivity: row.sensitivity,
    status: row.status,
    tags,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at,
  };
  validateMemoryRecord(record, Number.MAX_SAFE_INTEGER);
  return record;
}

function assertMemoryDatabase(db) {
  if (!db || typeof db.prepare !== 'function') {
    throw new TypeError('Memory database is required');
  }
}

function assertMemoryScope(ownerId, projectId) {
  requireId(ownerId, 'owner identifier');
  if (projectId !== null) requireId(projectId, 'project identifier');
}

function normalizeSearchTerms(query) {
  if (typeof query !== 'string' || !query.trim() || query.length > 200) return [];
  return [...new Set(tokenizeMemoryText(query))];
}

/**
 * D1-backed memory repository. Callers must supply ownerId derived from the
 * authenticated server-side session; never accept it from request JSON.
 */

function mapMemoryEventRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    memoryId: row.memory_id,
    ownerId: row.owner_id,
    projectId: row.project_id,
    type: row.event_type,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    occurredAt: row.occurred_at,
  };
}

export function createMemoryRepository(db) {
  assertMemoryDatabase(db);

  return Object.freeze({
    async create(record) {
      validateMemoryRecord(record);
      const persisted = clone(record);
      persisted.source = { ...persisted.source, trust: 'untrusted' };
      await db.prepare(`
        INSERT INTO aegis_memories (
          id, owner_id, project_id, kind, content, source_type, source_url,
          source_attribution, source_observed_at, confidence, sensitivity,
          status, tags_json, created_at, updated_at, expires_at, supersedes_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        record.id, record.ownerId, record.projectId, record.kind, record.content,
        record.source.type, record.source.url, record.source.attribution,
        record.source.observedAt, record.confidence, record.sensitivity,
        record.status, JSON.stringify(record.tags), record.createdAt,
        record.updatedAt, record.expiresAt, record.supersedesId ?? null,
      ).run();
      return persisted;
    },

    async get(id, { ownerId, projectId = null } = {}) {
      assertMemoryScope(ownerId, projectId);
      requireId(id, 'identifier');
      const row = await db.prepare(`
        SELECT * FROM aegis_memories
        WHERE id = ? AND owner_id = ? AND project_id IS ?
        LIMIT 1
      `).bind(id, ownerId, projectId).first();
      return mapMemoryRow(row);
    },

    async list({ ownerId, projectId = null, now = Date.now(), limit = 20, includeCandidates = false } = {}) {
      assertMemoryScope(ownerId, projectId);
      if (!Number.isFinite(now)) throw new TypeError('Invalid memory clock');
      if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
        throw new TypeError('Invalid memory result limit');
      }
      const result = await db.prepare(`
        SELECT * FROM aegis_memories
        WHERE owner_id = ? AND project_id IS ?
          AND status IN (${includeCandidates ? "'accepted', 'candidate'" : "'accepted'"})
          AND (expires_at IS NULL OR expires_at > ?)
        ORDER BY updated_at DESC, id ASC
        LIMIT ?
      `).bind(ownerId, projectId, new Date(now).toISOString(), limit).all();
      return (result?.results ?? []).map(mapMemoryRow);
    },

    async search({ ownerId, projectId = null, query, now = Date.now(), limit = 20 } = {}) {
      assertMemoryScope(ownerId, projectId);
      if (!Number.isFinite(now)) throw new TypeError('Invalid memory clock');
      if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
        throw new TypeError('Invalid memory result limit');
      }
      const terms = normalizeSearchTerms(query);
      if (!terms.length) return [];
      const predicates = terms.map(() => "LOWER(content || ' ' || kind || ' ' || tags_json) LIKE ?");
      const candidateLimit = 200;
      const bindings = [
        ownerId, projectId, new Date(now).toISOString(),
        ...terms.map((term) => '%' + term + '%'),
        candidateLimit,
      ];
      const result = await db.prepare(`
        SELECT * FROM aegis_memories
        WHERE owner_id = ? AND project_id IS ?
          AND status = 'accepted'
          AND sensitivity <> 'restricted'
          AND (expires_at IS NULL OR expires_at > ?)
          AND (${predicates.join(' OR ')})
        ORDER BY confidence DESC, updated_at DESC, id ASC
        LIMIT ?
      `).bind(...bindings).all();
      const candidates = (result?.results ?? []).map(mapMemoryRow);
      return rankMemoryRecords(candidates, terms, limit);
    },


    async exportAll({ ownerId, projectId, memoryLimit = 500, eventLimit = 2000 } = {}) {
      requireId(ownerId, 'owner identifier');
      if (projectId !== undefined && projectId !== null) requireId(projectId, 'project identifier');
      if (!Number.isInteger(memoryLimit) || memoryLimit < 1 || memoryLimit > 1000 ||
          !Number.isInteger(eventLimit) || eventLimit < 1 || eventLimit > 5000) {
        throw new TypeError('Invalid memory export limits');
      }
      const allScopes = projectId === undefined ? 1 : 0;
      const scopeId = projectId ?? null;
      const [memoryResult, eventResult] = await Promise.all([
        db.prepare(`
          SELECT * FROM aegis_memories
          WHERE owner_id = ? AND (? = 1 OR project_id IS ?)
          ORDER BY created_at ASC, id ASC
          LIMIT ?
        `).bind(ownerId, allScopes, scopeId, memoryLimit + 1).all(),
        db.prepare(`
          SELECT * FROM aegis_memory_events
          WHERE owner_id = ? AND (? = 1 OR project_id IS ?)
          ORDER BY occurred_at ASC, id ASC
          LIMIT ?
        `).bind(ownerId, allScopes, scopeId, eventLimit + 1).all(),
      ]);
      const memoryRows = memoryResult?.results ?? [];
      const eventRows = eventResult?.results ?? [];
      return {
        memories: memoryRows.slice(0, memoryLimit).map(mapMemoryRow),
        events: eventRows.slice(0, eventLimit).map(mapMemoryEventRow),
        truncated: memoryRows.length > memoryLimit || eventRows.length > eventLimit,
      };
    },

    async listProjectEvents({ ownerId, projectId, limit = 100 } = {}) {
      assertMemoryScope(ownerId, projectId);
      if (projectId === null) throw new TypeError('A Project Space identifier is required');
      if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
        throw new TypeError('Invalid project memory event limit');
      }
      const result = await db.prepare(`
        SELECT * FROM aegis_memory_events
        WHERE owner_id = ? AND project_id = ?
        ORDER BY occurred_at ASC, id ASC
        LIMIT ?
      `).bind(ownerId, projectId, limit).all();
      return (result?.results ?? []).map(mapMemoryEventRow);
    },

    async listEvents(id, { ownerId, projectId = null, limit = 50 } = {}) {
      assertMemoryScope(ownerId, projectId);
      requireId(id, 'identifier');
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        throw new TypeError('Invalid memory event limit');
      }
      const result = await db.prepare(`
        SELECT * FROM aegis_memory_events
        WHERE memory_id = ? AND owner_id = ? AND project_id IS ?
        ORDER BY occurred_at ASC, id ASC
        LIMIT ?
      `).bind(id, ownerId, projectId, limit).all();
      return (result?.results ?? []).map(mapMemoryEventRow);
    },

    async purge(id, { ownerId, projectId = null } = {}) {
      assertMemoryScope(ownerId, projectId);
      requireId(id, 'identifier');
      if (typeof db.batch !== 'function') {
        throw new TypeError('Transactional D1 batch support is required for memory purge');
      }
      const results = await db.batch([
        db.prepare(`
          UPDATE aegis_memories
          SET supersedes_id = NULL
          WHERE supersedes_id = ? AND owner_id = ? AND project_id IS ?
        `).bind(id, ownerId, projectId),
        db.prepare(`
          DELETE FROM aegis_memories
          WHERE id = ? AND owner_id = ? AND project_id IS ?
        `).bind(id, ownerId, projectId),
      ]);
      return (results?.[1]?.meta?.changes ?? 0) === 1;
    },

    async setStatus(id, { ownerId, projectId = null, status, now = Date.now() } = {}) {
      assertMemoryScope(ownerId, projectId);
      requireId(id, 'identifier');
      if (!['accepted', 'superseded', 'retracted'].includes(status)) {
        throw new TypeError('Invalid memory lifecycle status');
      }
      if (!Number.isFinite(now)) throw new TypeError('Invalid memory clock');
      const timestamp = new Date(now).toISOString();
      const result = await db.prepare(`
        UPDATE aegis_memories
        SET status = ?, updated_at = ?
        WHERE id = ? AND owner_id = ? AND project_id IS ?
          AND status IN ('candidate', 'accepted')
      `).bind(status, timestamp, id, ownerId, projectId).run();
      return (result?.meta?.changes ?? 0) === 1;
    },
  });
}
