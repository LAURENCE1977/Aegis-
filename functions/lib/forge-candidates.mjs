import { validateCandidateRecord } from './forge-records.mjs';

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function requireOwner(ownerId) {
  if (typeof ownerId !== 'string' || !ID_PATTERN.test(ownerId)) {
    throw new TypeError('Invalid Forge owner identifier');
  }
}

function parseJson(value, label) {
  try { return JSON.parse(value); }
  catch { throw new TypeError('Stored Forge ' + label + ' is corrupt'); }
}

function mapCandidateRow(row) {
  if (!row) return null;
  const candidate = {
    id: row.id,
    ownerId: row.owner_id,
    sourceType: row.source_type,
    sourceUrl: row.source_url,
    version: row.version,
    licence: {
      identifier: row.licence_identifier,
      review: row.licence_review,
    },
    decision: row.decision,
    status: row.status,
    capabilities: parseJson(row.capabilities_json, 'capabilities'),
    dependencies: parseJson(row.dependencies_json, 'dependencies'),
    evidence: parseJson(row.evidence_json, 'evidence'),
    metadata: parseJson(row.metadata_json, 'metadata'),
    fullName: parseJson(row.metadata_json, 'metadata').fullName ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  validateCandidateRecord(candidate);
  return candidate;
}

function validateRepositoryMetadata(repository) {
  if (!repository || typeof repository !== 'object' || Array.isArray(repository) ||
      repository.sourceType !== 'repository' ||
      typeof repository.fullName !== 'string' || !repository.fullName.trim() || repository.fullName.length > 200 ||
      typeof repository.sourceUrl !== 'string' ||
      typeof repository.defaultBranch !== 'string' || !repository.defaultBranch.trim() || repository.defaultBranch.length > 200 ||
      typeof repository.treeSha !== 'string' || !/^[a-f0-9]{40,64}$/i.test(repository.treeSha) ||
      typeof repository.archived !== 'boolean' || typeof repository.fork !== 'boolean' ||
      (repository.description !== null && repository.description !== undefined &&
        (typeof repository.description !== 'string' || repository.description.length > 1000)) ||
      (repository.primaryLanguage !== null && repository.primaryLanguage !== undefined &&
        (typeof repository.primaryLanguage !== 'string' || repository.primaryLanguage.length > 100)) ||
      (repository.licenseSpdx !== null && repository.licenseSpdx !== undefined &&
        (typeof repository.licenseSpdx !== 'string' || repository.licenseSpdx.length > 100)) ||
      (repository.licenseName !== null && repository.licenseName !== undefined &&
        (typeof repository.licenseName !== 'string' || repository.licenseName.length > 200)) ||
      (repository.stars !== null && repository.stars !== undefined &&
        (!Number.isSafeInteger(repository.stars) || repository.stars < 0))) {
    throw new TypeError('Invalid inspected repository metadata');
  }
}

function assertDatabase(db) {
  if (!db || typeof db.prepare !== 'function') throw new TypeError('Forge database is required');
}

export async function createForgeCandidate(db, ownerId, repository, now = Date.now()) {
  assertDatabase(db);
  requireOwner(ownerId);
  validateRepositoryMetadata(repository);
  if (!Number.isFinite(now)) throw new TypeError('Invalid Forge candidate clock');

  const timestamp = new Date(now).toISOString();
  const sourceUrl = repository.sourceUrl;
  const version = repository.treeSha;
  const candidate = {
    id: crypto.randomUUID().toLowerCase(),
    ownerId,
    sourceType: 'repository',
    sourceUrl,
    version,
    licence: {
      identifier: repository.licenseSpdx || 'NOASSERTION',
      // GitHub's repository metadata is a hint, not a completed legal review.
      review: 'review-required',
    },
    decision: 'unassessed',
    status: 'inspected',
    capabilities: [],
    dependencies: [],
    evidence: [{
      url: sourceUrl,
      note: 'Pinned default-branch Git tree ' + version + ' inspected. Verify the actual licence before reuse or adaptation.',
    }],
    metadata: {
      fullName: repository.fullName,
      description: repository.description ?? null,
      defaultBranch: repository.defaultBranch,
      treeSha: version,
      archived: repository.archived,
      fork: repository.fork,
      stars: repository.stars ?? null,
      primaryLanguage: repository.primaryLanguage ?? null,
      licenseSpdx: repository.licenseSpdx ?? null,
      licenseName: repository.licenseName ?? null,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  validateCandidateRecord(candidate);

  await db.prepare(`
    INSERT INTO forge_candidates (
      id, owner_id, source_type, source_url, version,
      licence_identifier, licence_review, decision, status,
      capabilities_json, dependencies_json, evidence_json, metadata_json,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(owner_id, source_url, version) DO NOTHING
  `).bind(
    candidate.id, ownerId, candidate.sourceType, candidate.sourceUrl, candidate.version,
    candidate.licence.identifier, candidate.licence.review, candidate.decision, candidate.status,
    JSON.stringify(candidate.capabilities), JSON.stringify(candidate.dependencies),
    JSON.stringify(candidate.evidence), JSON.stringify(candidate.metadata),
    candidate.createdAt, candidate.updatedAt,
  ).run();

  const row = await db.prepare(`
    SELECT * FROM forge_candidates
    WHERE owner_id = ? AND source_url = ? AND version = ?
    LIMIT 1
  `).bind(ownerId, sourceUrl, version).first();
  if (!row) throw new Error('Forge candidate could not be persisted');
  const saved = mapCandidateRow(row);
  return { candidate: saved, created: saved.id === candidate.id };
}

export async function listForgeCandidates(db, ownerId, limit = 50) {
  assertDatabase(db);
  requireOwner(ownerId);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new TypeError('Forge candidate limit must be between 1 and 100');
  }
  const result = await db.prepare(`
    SELECT * FROM forge_candidates
    WHERE owner_id = ?
    ORDER BY updated_at DESC, id ASC
    LIMIT ?
  `).bind(ownerId, limit).all();
  return (result?.results ?? []).map(mapCandidateRow);
}


const LICENCE_REVIEWS = new Set(['verified', 'review-required', 'not-applicable']);
const CANDIDATE_DECISIONS = new Set(['unassessed', 'reuse', 'adapt', 'rebuild', 'combine', 'reject']);
const CANDIDATE_STATUSES = new Set(['discovered', 'inspected', 'assessed', 'approved', 'rejected', 'archived']);

export async function updateForgeCandidateReview(db, ownerId, id, review, now = Date.now()) {
  assertDatabase(db);
  requireOwner(ownerId);
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) throw new TypeError('Invalid Forge candidate identifier');
  if (!review || typeof review !== 'object' || Array.isArray(review) ||
      Object.keys(review).length !== 3 ||
      !LICENCE_REVIEWS.has(review.licenceReview) ||
      !CANDIDATE_DECISIONS.has(review.decision) ||
      !CANDIDATE_STATUSES.has(review.status)) {
    throw new TypeError('Invalid Forge candidate review');
  }
  if (['reuse', 'adapt', 'combine'].includes(review.decision) && review.licenceReview !== 'verified') {
    throw new TypeError('A verified licence review is required before reuse, adaptation or combination');
  }
  if (review.status === 'approved' &&
      (review.decision === 'unassessed' || review.decision === 'reject' || review.licenceReview !== 'verified')) {
    throw new TypeError('An approved candidate requires a reviewed licence and a positive engineering decision');
  }
  if ((review.decision === 'reject') !== (review.status === 'rejected')) {
    throw new TypeError('A rejected decision and rejected status must be recorded together');
  }
  if (!Number.isFinite(now)) throw new TypeError('Invalid Forge review clock');

  const updateResult = await db.prepare(`
    UPDATE forge_candidates
    SET licence_review = ?, decision = ?, status = ?, updated_at = ?
    WHERE id = ? AND owner_id = ? AND status NOT IN ('archived', 'rejected')
  `).bind(
    review.licenceReview, review.decision, review.status,
    new Date(now).toISOString(), id, ownerId,
  ).run();
  if ((updateResult?.meta?.changes ?? 0) !== 1) return null;
  const updatedRow = await db.prepare(`
    SELECT * FROM forge_candidates WHERE id = ? AND owner_id = ? LIMIT 1
  `).bind(id, ownerId).first();
  return mapCandidateRow(updatedRow);
}


const CANDIDATE_EVENT_TYPES = new Set(['created', 'review_changed', 'status_changed']);

export async function listForgeCandidateEvents(db, ownerId, id, limit = 50) {
  assertDatabase(db);
  requireOwner(ownerId);
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) {
    throw new TypeError('Invalid Forge candidate identifier');
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new TypeError('Forge candidate event limit must be between 1 and 100');
  }
  const result = await db.prepare(`
    SELECT * FROM forge_candidate_events
    WHERE candidate_id = ? AND owner_id = ?
    ORDER BY occurred_at DESC, id DESC
    LIMIT ?
  `).bind(id, ownerId, limit).all();
  return (result?.results ?? []).map(row => {
    if (!row || typeof row.id !== 'string' ||
        !CANDIDATE_EVENT_TYPES.has(row.event_type) ||
        typeof row.to_status !== 'string' ||
        typeof row.to_decision !== 'string' ||
        typeof row.occurred_at !== 'string') {
      throw new TypeError('Stored Forge candidate event is invalid');
    }
    return {
      id: row.id,
      candidateId: row.candidate_id,
      ownerId: row.owner_id,
      type: row.event_type,
      fromStatus: row.from_status ?? null,
      toStatus: row.to_status,
      fromDecision: row.from_decision ?? null,
      toDecision: row.to_decision,
      occurredAt: row.occurred_at,
    };
  });
}


export async function listForgeCandidateEvents(db, ownerId, candidateId, limit = 50) {
  assertDatabase(db);
  requireOwner(ownerId);
  if (typeof candidateId !== 'string' || !ID_PATTERN.test(candidateId)) {
    throw new TypeError('Invalid Forge candidate identifier');
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new TypeError('Forge candidate event limit must be between 1 and 100');
  }
  const result = await db.prepare(`
    SELECT id, candidate_id, owner_id, event_type, from_status, to_status,
      from_decision, to_decision, occurred_at
    FROM forge_candidate_events
    WHERE candidate_id = ? AND owner_id = ?
    ORDER BY occurred_at DESC, id ASC
    LIMIT ?
  `).bind(candidateId, ownerId, limit).all();
  return (result?.results ?? []).map(row => ({
    id: row.id,
    candidateId: row.candidate_id,
    ownerId: row.owner_id,
    type: row.event_type,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    fromDecision: row.from_decision,
    toDecision: row.to_decision,
    occurredAt: row.occurred_at,
  }));
}
