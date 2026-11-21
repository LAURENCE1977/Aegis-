const PRINCIPAL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,79}$/;
const EVENT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,99}$/;
const RECORD_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/;
const PROPOSAL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,511}$/;
const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;
const DECISIONS = new Set([
  'accepted_for_further_review',
  'rejected',
  'needs_more_evidence',
  'withdrawn',
]);

function validatePrincipal(value) {
  if (typeof value !== 'string' || !PRINCIPAL_PATTERN.test(value)) {
    throw new TypeError('Authenticated principal identifier is invalid.');
  }
  return value;
}

function validateTimestamp(value) {
  if (typeof value !== 'string') throw new TypeError('Review timestamp must be canonical UTC.');
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) {
    throw new TypeError('Review timestamp must be canonical UTC.');
  }
  return value;
}

function mapEvent(row, principalId) {
  if (!row || row.principal_id !== principalId) {
    throw new Error('Stored proposal review ownership is inconsistent.');
  }
  return {
    eventId: row.event_id,
    ownerId: row.principal_id,
    proposalId: row.proposal_id,
    decision: row.decision,
    note: row.note,
    evidence: {
      firstRecordId: row.first_record_id,
      lastRecordId: row.last_record_id,
      workloadDigest: row.workload_digest,
    },
    createdAt: row.created_at,
    approvalGranted: false,
    execution: 'not_authorised',
  };
}

/**
 * Append a human review observation. Decisions are deliberately not Sentinel
 * approvals and never authorise or execute a consequential change.
 */
export async function appendExperimentProposalReview(db, principalId, input) {
  if (!db || typeof db.prepare !== 'function') {
    throw new TypeError('A D1-compatible database binding is required.');
  }
  validatePrincipal(principalId);
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.hasOwn(input, 'ownerId')) {
    throw new TypeError('Review input must not contain a caller-selected owner.');
  }
  const {
    eventId, proposalId, decision, note, firstRecordId, lastRecordId,
    workloadDigest, createdAt,
  } = input;
  if (typeof eventId !== 'string' || !EVENT_ID_PATTERN.test(eventId)) {
    throw new TypeError('Review event identifier is invalid.');
  }
  if (typeof proposalId !== 'string' || !PROPOSAL_ID_PATTERN.test(proposalId)) {
    throw new TypeError('Proposal identifier is invalid.');
  }
  if (!DECISIONS.has(decision)) throw new TypeError('Review decision is not supported.');
  if (typeof note !== 'string' || !note.trim() || note.trim().length > 1000 ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(note)) {
    throw new TypeError('Review note must contain 1–1000 safe characters.');
  }
  if (typeof firstRecordId !== 'string' || !RECORD_ID_PATTERN.test(firstRecordId) ||
      typeof lastRecordId !== 'string' || !RECORD_ID_PATTERN.test(lastRecordId)) {
    throw new TypeError('Review evidence record lineage is invalid.');
  }
  if (typeof workloadDigest !== 'string' || !DIGEST_PATTERN.test(workloadDigest)) {
    throw new TypeError('Review workload digest is invalid.');
  }
  validateTimestamp(createdAt);

  await db.prepare(
    'INSERT INTO experiment_proposal_review_events (event_id, principal_id, proposal_id, decision, note, first_record_id, last_record_id, workload_digest, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(principal_id, event_id) DO NOTHING'
  ).bind(
    eventId, principalId, proposalId, decision, note.trim(), firstRecordId,
    lastRecordId, workloadDigest, createdAt,
  ).run();

  const stored = await db.prepare(
    'SELECT event_id, principal_id, proposal_id, decision, note, first_record_id, last_record_id, workload_digest, created_at FROM experiment_proposal_review_events WHERE principal_id = ? AND event_id = ?'
  ).bind(principalId, eventId).first();
  if (!stored) throw new Error('Proposal review event could not be persisted.');
  const expected = [
    proposalId, decision, note.trim(), firstRecordId, lastRecordId, workloadDigest, createdAt,
  ];
  const actual = [
    stored.proposal_id, stored.decision, stored.note, stored.first_record_id,
    stored.last_record_id, stored.workload_digest, stored.created_at,
  ];
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error('Review event identifier already exists with different immutable content.');
  }
  return { created: true, review: mapEvent(stored, principalId) };
}

/** Read only the authenticated principal's append-only review history. */
export async function listExperimentProposalReviews(db, principalId, proposalId = null, options = {}) {
  if (!db || typeof db.prepare !== 'function') {
    throw new TypeError('A D1-compatible database binding is required.');
  }
  validatePrincipal(principalId);
  if (proposalId !== null &&
      (typeof proposalId !== 'string' || !PROPOSAL_ID_PATTERN.test(proposalId))) {
    throw new TypeError('Proposal identifier is invalid.');
  }
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('Review list options are invalid.');
  }
  const limit = options.limit === undefined ? 50 : options.limit;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new TypeError('Review list limit must be between 1 and 100.');
  }
  const statement = proposalId === null
    ? db.prepare(
      'SELECT event_id, principal_id, proposal_id, decision, note, first_record_id, last_record_id, workload_digest, created_at FROM experiment_proposal_review_events WHERE principal_id = ? ORDER BY created_at DESC, event_id DESC LIMIT ?'
    ).bind(principalId, limit)
    : db.prepare(
      'SELECT event_id, principal_id, proposal_id, decision, note, first_record_id, last_record_id, workload_digest, created_at FROM experiment_proposal_review_events WHERE principal_id = ? AND proposal_id = ? ORDER BY created_at DESC, event_id DESC LIMIT ?'
    ).bind(principalId, proposalId, limit);
  const result = await statement.all();
  return (result.results || []).map((row) => mapEvent(row, principalId));
}
