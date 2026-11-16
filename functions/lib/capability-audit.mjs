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
const INPUT_KEYS = new Set([
  'invocationId', 'type', 'principalId', 'capabilityId', 'capabilityVersion',
  'actionId', 'resourceId', 'inputDigest', 'reasonCode', 'occurredAt',
]);

function requiredId(value, label) {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    throw new TypeError('Invalid audit ' + label);
  }
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
  };
}

function validateEvent(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event) ||
      Object.keys(event).some(key => !INPUT_KEYS.has(key)) ||
      Object.keys(event).length !== INPUT_KEYS.size) {
    throw new TypeError('Invalid audit event fields');
  }
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
}

export async function recordCapabilityAudit(db, event) {
  if (!db || typeof db.prepare !== 'function') throw new TypeError('Audit database is required');
  validateEvent(event);
  const id = crypto.randomUUID();
  const result = await db.prepare(`
    INSERT INTO capability_invocation_audit (
      id, invocation_id, event_type, principal_id, capability_id,
      capability_version, action_id, resource_id, input_digest,
      reason_code, occurred_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, event.invocationId, event.type, event.principalId, event.capabilityId,
    event.capabilityVersion, event.actionId, event.resourceId, event.inputDigest,
    event.reasonCode, event.occurredAt,
  ).run();
  if (result?.meta?.changes === 0) throw new Error('Audit event could not be persisted');
  return {
    id,
    invocationId: event.invocationId,
    type: event.type,
    principalId: event.principalId,
    capabilityId: event.capabilityId,
    capabilityVersion: event.capabilityVersion,
    actionId: event.actionId,
    resourceId: event.resourceId,
    inputDigest: event.inputDigest,
    reasonCode: event.reasonCode,
    occurredAt: event.occurredAt,
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
