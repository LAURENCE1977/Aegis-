const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const RESOURCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/;
const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/i;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const REASON_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;
const EVENT_TYPES = new Set([
  'invocation_denied',
  'invocation_policy_allowed',
  'invocation_authorized',
  'invocation_failed',
  'invocation_succeeded',
]);
const REQUIRED_INPUT_KEYS = new Set([
  'invocationId', 'type', 'principalId', 'capabilityId', 'capabilityVersion',
  'actionId', 'resourceId', 'inputDigest', 'reasonCode', 'occurredAt',
]);
const OPTIONAL_INPUT_KEYS = new Set([
  'grantId', 'connectionId', 'approvalId', 'taskId', 'sessionId',
  'parentSessionId', 'workerId', 'adapterReceiptId',
]);
const ALL_INPUT_KEYS = new Set([...REQUIRED_INPUT_KEYS, ...OPTIONAL_INPUT_KEYS]);

function requiredId(value, label) {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    throw new TypeError('Invalid audit ' + label);
  }
}

function optionalId(value, label) {
  if (value !== null && value !== undefined &&
      (typeof value !== 'string' || !ID_PATTERN.test(value))) {
    throw new TypeError('Invalid audit ' + label);
  }
}

function normalizeEvent(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event) ||
      Object.keys(event).some((key) => !ALL_INPUT_KEYS.has(key)) ||
      [...REQUIRED_INPUT_KEYS].some((key) => !Object.prototype.hasOwnProperty.call(event, key))) {
    throw new TypeError('Invalid audit event fields');
  }
  return {
    ...event,
    grantId: event.grantId ?? null,
    connectionId: event.connectionId ?? null,
    approvalId: event.approvalId ?? null,
    taskId: event.taskId ?? null,
    sessionId: event.sessionId ?? null,
    parentSessionId: event.parentSessionId ?? null,
    workerId: event.workerId ?? null,
    adapterReceiptId: event.adapterReceiptId ?? null,
  };
}

function validateEvent(event) {
  requiredId(event.invocationId, 'invocation identifier');
  requiredId(event.principalId, 'principal');
  requiredId(event.capabilityId, 'capability identifier');
  requiredId(event.actionId, 'action identifier');
  if (!EVENT_TYPES.has(event.type)) throw new TypeError('Invalid audit event type');
  if (typeof event.capabilityVersion !== 'string' || !VERSION_PATTERN.test(event.capabilityVersion)) {
    throw new TypeError('Invalid audit capability version');
  }
  if (typeof event.resourceId !== 'string' || !RESOURCE_PATTERN.test(event.resourceId) ||
      event.resourceId.includes('..')) throw new TypeError('Invalid audit resource');
  if (typeof event.inputDigest !== 'string' || !DIGEST_PATTERN.test(event.inputDigest)) {
    throw new TypeError('Invalid audit digest');
  }
  if (typeof event.reasonCode !== 'string' || !REASON_PATTERN.test(event.reasonCode)) {
    throw new TypeError('Invalid audit reason code');
  }
  const timestamp = Date.parse(event.occurredAt);
  if (typeof event.occurredAt !== 'string' || !Number.isFinite(timestamp) ||
      new Date(timestamp).toISOString() !== event.occurredAt) {
    throw new TypeError('Invalid audit timestamp');
  }
  optionalId(event.grantId, 'grant identifier');
  optionalId(event.connectionId, 'connection identifier');
  optionalId(event.approvalId, 'approval identifier');
  optionalId(event.taskId, 'task identifier');
  optionalId(event.sessionId, 'session identifier');
  optionalId(event.parentSessionId, 'parent session identifier');
  optionalId(event.workerId, 'worker identifier');
  optionalId(event.adapterReceiptId, 'adapter receipt identifier');
}

function mapAudit(row) {
  return {
    id: row.id,
    invocationId: row.invocation_id,
    type: row.event_type,
    principalId: row.principal_id,
    capabilityId: row.capability_id,
    capabilityVersion: row.capability_version,
    actionId: row.action_id,
    resourceId: row.resource_id,
    inputDigest: row.input_digest,
    reasonCode: row.reason_code,
    occurredAt: row.occurred_at,
    grantId: row.grant_id ?? null,
    connectionId: row.connection_id ?? null,
    approvalId: row.approval_id ?? null,
    taskId: row.task_id ?? null,
    sessionId: row.session_id ?? null,
    parentSessionId: row.parent_session_id ?? null,
    workerId: row.worker_id ?? null,
    adapterReceiptId: row.adapter_receipt_id ?? null,
  };
}

export async function recordCapabilityAudit(db, event) {
  if (!db || typeof db.prepare !== 'function') throw new TypeError('Audit database is required');
  const normalized = normalizeEvent(event);
  validateEvent(normalized);
  const id = crypto.randomUUID();
  const result = await db.prepare(`
    INSERT INTO capability_invocation_audit (
      id, invocation_id, event_type, principal_id, capability_id,
      capability_version, action_id, resource_id, input_digest,
      reason_code, occurred_at, grant_id, connection_id, approval_id,
      task_id, session_id, parent_session_id, worker_id, adapter_receipt_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, normalized.invocationId, normalized.type, normalized.principalId,
    normalized.capabilityId, normalized.capabilityVersion, normalized.actionId,
    normalized.resourceId, normalized.inputDigest, normalized.reasonCode,
    normalized.occurredAt, normalized.grantId, normalized.connectionId,
    normalized.approvalId, normalized.taskId, normalized.sessionId,
    normalized.parentSessionId, normalized.workerId, normalized.adapterReceiptId,
  ).run();
  if (result?.meta?.changes === 0) throw new Error('Audit event could not be persisted');
  return {
    id,
    invocationId: normalized.invocationId,
    type: normalized.type,
    principalId: normalized.principalId,
    capabilityId: normalized.capabilityId,
    capabilityVersion: normalized.capabilityVersion,
    actionId: normalized.actionId,
    resourceId: normalized.resourceId,
    inputDigest: normalized.inputDigest,
    reasonCode: normalized.reasonCode,
    occurredAt: normalized.occurredAt,
    grantId: normalized.grantId,
    connectionId: normalized.connectionId,
    approvalId: normalized.approvalId,
    taskId: normalized.taskId,
    sessionId: normalized.sessionId,
    parentSessionId: normalized.parentSessionId,
    workerId: normalized.workerId,
    adapterReceiptId: normalized.adapterReceiptId,
  };
}

export async function listCapabilityAudit(db, principalId, {
  invocationId = null, limit = 50,
} = {}) {
  if (!db || typeof db.prepare !== 'function') throw new TypeError('Audit database is required');
  requiredId(principalId, 'principal');
  if (invocationId !== null) requiredId(invocationId, 'invocation identifier');
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new TypeError('Audit list limit must be between 1 and 100');
  }
  const result = await db.prepare(`
    SELECT * FROM capability_invocation_audit
    WHERE principal_id = ? AND (? IS NULL OR invocation_id = ?)
    ORDER BY occurred_at DESC, id DESC
    LIMIT ?
  `).bind(principalId, invocationId, invocationId, limit).all();
  return (result?.results || []).map(mapAudit);
}
