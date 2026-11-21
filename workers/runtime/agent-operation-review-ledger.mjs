import { canonicalizeInput, digestCanonicalInput } from '../../functions/lib/canonical-input.mjs';

const PRINCIPAL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,79}$/;
const EVENT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,99}$/;
const REQUEST_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,79}$/;
const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;
const DECISIONS = new Set([
  'accepted_for_sentinel_evaluation',
  'rejected',
  'needs_more_evidence',
  'withdrawn',
]);

function exactRecord(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    throw new TypeError(label + ' must be a plain object.');
  }
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== 'string' || !descriptor?.enumerable ||
        !Object.hasOwn(descriptor, 'value') || !allowed.includes(key)) {
      throw new TypeError(label + ' contains an unsupported field or accessor.');
    }
  }
}

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

function validateDigest(value, label) {
  if (typeof value !== 'string' || !DIGEST_PATTERN.test(value)) {
    throw new TypeError(label + ' digest is invalid.');
  }
  return value;
}

function validateText(value, label, maxLength) {
  if (typeof value !== 'string' || value.length < 1 || value.length > maxLength ||
      value.trim() !== value || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new TypeError(label + ' must contain 1–' + maxLength + ' safe characters.');
  }
  return value;
}

function requireDatabase(db) {
  if (!db || typeof db.prepare !== 'function') {
    throw new TypeError('A D1-compatible database binding is required.');
  }
  return db;
}

async function loadVerifiedRequest(db, principalId, requestId) {
  const row = await db.prepare(
    'SELECT principal_id, request_id, run_id, workflow_id, definition_digest, checkpoint_digest, action_digest, evidence_digest, request_digest, request_json, created_at FROM agent_operation_requests WHERE principal_id = ? AND request_id = ?'
  ).bind(principalId, requestId).first();
  if (!row || row.principal_id !== principalId || row.request_id !== requestId) {
    throw new Error('Agent operation request was not found for this authenticated principal.');
  }

  let request;
  try {
    request = JSON.parse(row.request_json);
  } catch {
    throw new Error('Stored agent operation request is not valid JSON.');
  }
  const { requestDigest, ...unsigned } = request || {};
  const actualDigest = await digestCanonicalInput(unsigned);
  if (request.schemaVersion !== 'aegis.agent-operation-request.v1' ||
      request.requestId !== requestId ||
      request.status !== 'awaiting_human_review' ||
      request.authority?.approvalGranted !== false ||
      request.authority?.execution !== 'not_authorised' ||
      request.authority?.sentinelApprovalRequired !== true ||
      actualDigest !== requestDigest ||
      row.run_id !== request.runId ||
      row.workflow_id !== request.workflowId ||
      row.definition_digest !== request.definitionDigest ||
      row.checkpoint_digest !== request.checkpointDigest ||
      row.action_digest !== request.actionDigest ||
      row.evidence_digest !== request.evidenceDigest ||
      row.request_digest !== requestDigest ||
      row.created_at !== request.createdAt) {
    throw new Error('Stored agent operation request failed integrity or authority verification.');
  }
  return request;
}

function mapEvent(row, principalId) {
  if (!row || row.principal_id !== principalId) {
    throw new Error('Stored operation review ownership is inconsistent.');
  }
  return Object.freeze({
    eventId: row.event_id,
    principalId: row.principal_id,
    requestId: row.request_id,
    requestDigest: row.request_digest,
    actionDigest: row.action_digest,
    evidenceDigest: row.evidence_digest,
    decision: row.decision,
    note: row.note,
    createdAt: row.created_at,
    authority: Object.freeze({
      sentinelApprovalRequired: true,
      approvalGranted: false,
      execution: 'not_authorised',
      capabilitiesGranted: false,
      selfApproval: false,
    }),
  });
}

/**
 * Append a human review observation bound to a verified immutable inbox request.
 * No review decision from this ledger is a Sentinel authorization or execution grant.
 */
export async function appendAgentOperationReview(db, principalId, input) {
  requireDatabase(db);
  validatePrincipal(principalId);
  exactRecord(input, [
    'eventId', 'requestId', 'requestDigest', 'actionDigest', 'evidenceDigest',
    'decision', 'note', 'createdAt',
  ], 'Agent operation review input');

  if (typeof input.eventId !== 'string' || !EVENT_ID_PATTERN.test(input.eventId)) {
    throw new TypeError('Review event identifier is invalid.');
  }
  if (typeof input.requestId !== 'string' || !REQUEST_ID_PATTERN.test(input.requestId)) {
    throw new TypeError('Operation request identifier is invalid.');
  }
  validateDigest(input.requestDigest, 'Request');
  validateDigest(input.actionDigest, 'Action');
  validateDigest(input.evidenceDigest, 'Evidence');
  if (!DECISIONS.has(input.decision)) {
    throw new TypeError('Review decision is not supported.');
  }
  const note = validateText(input.note, 'Review note', 1000);
  const createdAt = validateTimestamp(input.createdAt);

  const request = await loadVerifiedRequest(db, principalId, input.requestId);
  if (input.requestDigest !== request.requestDigest) {
    throw new Error('Review request digest does not match the immutable inbox request.');
  }
  if (input.actionDigest !== request.actionDigest) {
    throw new Error('Review action digest does not match the immutable proposed action.');
  }
  if (input.evidenceDigest !== request.evidenceDigest) {
    throw new Error('Review evidence digest does not match the immutable request evidence.');
  }
  if (Date.parse(createdAt) < Date.parse(request.createdAt)) {
    throw new RangeError('Review timestamp cannot predate its operation request.');
  }

  const inserted = await db.prepare(
    'INSERT INTO agent_operation_review_events (event_id, principal_id, request_id, request_digest, action_digest, evidence_digest, decision, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(principal_id, event_id) DO NOTHING'
  ).bind(
    input.eventId, principalId, input.requestId, input.requestDigest,
    input.actionDigest, input.evidenceDigest, input.decision, note, createdAt,
  ).run();

  const stored = await db.prepare(
    'SELECT event_id, principal_id, request_id, request_digest, action_digest, evidence_digest, decision, note, created_at FROM agent_operation_review_events WHERE principal_id = ? AND event_id = ?'
  ).bind(principalId, input.eventId).first();
  if (!stored) throw new Error('Agent operation review event could not be persisted.');

  const expected = [
    input.requestId, input.requestDigest, input.actionDigest, input.evidenceDigest,
    input.decision, note, createdAt,
  ];
  const actual = [
    stored.request_id, stored.request_digest, stored.action_digest, stored.evidence_digest,
    stored.decision, stored.note, stored.created_at,
  ];
  if (stored.principal_id !== principalId || JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error('Review event identifier already exists with different immutable content.');
  }

  return Object.freeze({
    created: Number(inserted?.meta?.changes || 0) === 1,
    review: mapEvent(stored, principalId),
  });
}

/** Read a principal's review history for one request and recheck its digest binding. */
export async function listAgentOperationReviews(db, principalId, requestId, options = {}) {
  requireDatabase(db);
  validatePrincipal(principalId);
  if (typeof requestId !== 'string' || !REQUEST_ID_PATTERN.test(requestId)) {
    throw new TypeError('Operation request identifier is invalid.');
  }
  exactRecord(options, ['limit'], 'Review list options');
  const limit = options.limit === undefined ? 50 : options.limit;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new TypeError('Review list limit must be between 1 and 100.');
  }

  let request;
  try {
    request = await loadVerifiedRequest(db, principalId, requestId);
  } catch (error) {
    if (String(error?.message || '').includes('was not found')) return [];
    throw error;
  }

  const result = await db.prepare(
    'SELECT event_id, principal_id, request_id, request_digest, action_digest, evidence_digest, decision, note, created_at FROM agent_operation_review_events WHERE principal_id = ? AND request_id = ? ORDER BY created_at DESC, event_id DESC LIMIT ?'
  ).bind(principalId, requestId, limit).all();
  return (result.results || []).map((row) => {
    if (row.request_id !== requestId ||
        row.request_digest !== request.requestDigest ||
        row.action_digest !== request.actionDigest ||
        row.evidence_digest !== request.evidenceDigest ||
        !DECISIONS.has(row.decision)) {
      throw new Error('Stored operation review event failed request or evidence binding verification.');
    }
    validateTimestamp(row.created_at);
    validateText(row.note, 'Stored review note', 1000);
    return mapEvent(row, principalId);
  });
}
