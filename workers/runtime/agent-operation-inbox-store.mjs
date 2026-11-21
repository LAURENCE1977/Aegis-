import { createAgentOperationRequest } from './agent-operation-request.mjs';
import { canonicalizeInput, digestCanonicalInput } from '../../functions/lib/canonical-input.mjs';

const PRINCIPAL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,79}$/;
const REQUEST_PATTERN = /^[a-z0-9][a-z0-9._-]{0,79}$/;
const MAX_REQUEST_BYTES = 64 * 1024;
const MAX_PAGE_SIZE = 100;

function validatePrincipal(value) {
  if (typeof value !== 'string' || !PRINCIPAL_PATTERN.test(value)) {
    throw new TypeError('Authenticated principal identifier is invalid.');
  }
  return value;
}

function validateRequestId(value) {
  if (typeof value !== 'string' || !REQUEST_PATTERN.test(value)) {
    throw new TypeError('Operation request identifier is invalid.');
  }
  return value;
}

function validateTimestamp(value, label) {
  if (typeof value !== 'string') throw new TypeError(label + ' must be canonical UTC.');
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) {
    throw new TypeError(label + ' must be canonical UTC.');
  }
  return value;
}

function requireDatabase(db) {
  if (!db || typeof db.prepare !== 'function') {
    throw new TypeError('A D1-compatible database binding is required.');
  }
  return db;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

async function rebuildRequest({ definition, run, checkpoint, request, now }) {
  const rebuilt = await createAgentOperationRequest({
    requestId: request?.requestId,
    definition,
    run,
    checkpoint,
    action: request?.action,
    createdAt: request?.createdAt,
    observedAt: now,
  });
  if (canonicalizeInput(request) !== canonicalizeInput(rebuilt)) {
    throw new TypeError('Agent operation request failed contract or digest verification.');
  }
  if (Date.parse(request.createdAt) > Date.parse(now)) {
    throw new RangeError('Agent operation request cannot be newer than its server acceptance time.');
  }
  return rebuilt;
}

/**
 * Append a verified request under a server-authenticated principal.
 * principalId must come from trusted server identity, never request data.
 */
export async function appendAgentOperationRequest({
  db, principalId, definition, run, checkpoint, request, now = new Date().toISOString(),
} = {}) {
  requireDatabase(db);
  validatePrincipal(principalId);
  validateRequestId(request?.requestId);
  validateTimestamp(now, 'Operation request acceptance timestamp');

  const rebuilt = await rebuildRequest({ definition, run, checkpoint, request, now });
  const requestJson = JSON.stringify(rebuilt);
  if (new TextEncoder().encode(requestJson).byteLength > MAX_REQUEST_BYTES) {
    throw new RangeError('Agent operation request exceeds the 64 KiB storage limit.');
  }

  const inserted = await db.prepare(
    'INSERT INTO agent_operation_requests (principal_id, request_id, run_id, workflow_id, definition_digest, checkpoint_digest, action_digest, evidence_digest, request_digest, request_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(principal_id, request_id) DO NOTHING'
  ).bind(
    principalId, rebuilt.requestId, rebuilt.runId, rebuilt.workflowId,
    rebuilt.definitionDigest, rebuilt.checkpointDigest, rebuilt.actionDigest,
    rebuilt.evidenceDigest, rebuilt.requestDigest, requestJson, rebuilt.createdAt,
  ).run();

  const stored = await db.prepare(
    'SELECT principal_id, request_id, run_id, workflow_id, definition_digest, checkpoint_digest, action_digest, evidence_digest, request_digest, request_json, created_at FROM agent_operation_requests WHERE principal_id = ? AND request_id = ?'
  ).bind(principalId, rebuilt.requestId).first();
  if (!stored) throw new Error('Agent operation request could not be persisted.');

  const expected = [
    rebuilt.runId, rebuilt.workflowId, rebuilt.definitionDigest,
    rebuilt.checkpointDigest, rebuilt.actionDigest, rebuilt.evidenceDigest,
    rebuilt.requestDigest, requestJson, rebuilt.createdAt,
  ];
  const actual = [
    stored.run_id, stored.workflow_id, stored.definition_digest,
    stored.checkpoint_digest, stored.action_digest, stored.evidence_digest,
    stored.request_digest, stored.request_json, stored.created_at,
  ];
  if (stored.principal_id !== principalId || JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error('Operation request identifier already exists with different immutable content.');
  }

  return Object.freeze({
    schemaVersion: 'aegis.agent-operation-request-persistence.v1',
    status: Number(inserted?.meta?.changes || 0) === 1 ? 'appended' : 'already_recorded',
    principalId,
    requestId: rebuilt.requestId,
    requestDigest: rebuilt.requestDigest,
  });
}

/** Read and verify one authenticated principal's pending-operation inbox. */
export async function listAgentOperationRequests({
  db, principalId, afterCreatedAt = null, afterRequestId = null, limit = 25,
} = {}) {
  requireDatabase(db);
  validatePrincipal(principalId);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    throw new TypeError('Operation inbox page size must be between 1 and 100.');
  }
  if ((afterCreatedAt === null) !== (afterRequestId === null)) {
    throw new TypeError('Operation inbox cursor must include both timestamp and request identifier.');
  }
  if (afterCreatedAt !== null) {
    validateTimestamp(afterCreatedAt, 'Operation inbox cursor timestamp');
    validateRequestId(afterRequestId);
  }

  const result = await db.prepare(
    'SELECT principal_id, request_id, run_id, workflow_id, definition_digest, checkpoint_digest, action_digest, evidence_digest, request_digest, request_json, created_at FROM agent_operation_requests WHERE principal_id = ? AND (? IS NULL OR created_at < ? OR (created_at = ? AND request_id < ?)) ORDER BY created_at DESC, request_id DESC LIMIT ?'
  ).bind(
    principalId, afterCreatedAt, afterCreatedAt, afterCreatedAt, afterRequestId, limit + 1,
  ).all();

  const rows = result.results || [];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const requests = [];

  for (const row of page) {
    let request;
    try {
      request = JSON.parse(row.request_json);
    } catch {
      throw new Error('Stored agent operation request is not valid JSON.');
    }
    const { requestDigest, ...unsigned } = request || {};
    const actualDigest = await digestCanonicalInput(unsigned);
    if (row.principal_id !== principalId ||
        row.request_id !== request.requestId ||
        row.run_id !== request.runId ||
        row.workflow_id !== request.workflowId ||
        row.definition_digest !== request.definitionDigest ||
        row.checkpoint_digest !== request.checkpointDigest ||
        row.action_digest !== request.actionDigest ||
        row.evidence_digest !== request.evidenceDigest ||
        row.request_digest !== requestDigest ||
        row.created_at !== request.createdAt ||
        actualDigest !== requestDigest ||
        request.schemaVersion !== 'aegis.agent-operation-request.v1' ||
        request.status !== 'awaiting_human_review' ||
        request.authority?.approvalGranted !== false ||
        request.authority?.execution !== 'not_authorised' ||
        request.authority?.sentinelApprovalRequired !== true) {
      throw new Error('Stored agent operation request failed integrity or ownership verification.');
    }
    requests.push(deepFreeze(request));
  }

  const last = requests.length ? requests[requests.length - 1] : null;
  return Object.freeze({
    requests: Object.freeze(requests),
    nextCursor: hasMore && last
      ? Object.freeze({ createdAt: last.createdAt, requestId: last.requestId })
      : null,
    hasMore,
  });
}
