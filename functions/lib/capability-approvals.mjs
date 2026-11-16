const MAX_APPROVAL_TTL_MS = 15 * 60 * 1000;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/i;

function requiredId(value, label) {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    throw new TypeError('Invalid approval ' + label);
  }
}

function mapApproval(row) {
  if (!row) return null;
  return {
    id: row.id,
    principalId: row.principal_id,
    capabilityId: row.capability_id,
    capabilityVersion: row.capability_version,
    actionId: row.action_id,
    resourceId: row.resource_id,
    operationSummary: row.operation_summary,
    connectionId: row.connection_id,
    inputDigest: row.input_digest,
    requestedBy: row.requested_by,
    requestedAt: row.requested_at,
    expiresAt: row.expires_at,
    status: row.status,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
    consumedAt: row.consumed_at,
  };
}

function validateBinding(input) {
  requiredId(input.principalId, 'principal');
  requiredId(input.capabilityId, 'capability identifier');
  requiredId(input.capabilityVersion, 'capability version');
  requiredId(input.actionId, 'action identifier');
  if (typeof input.resourceId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/.test(input.resourceId) || input.resourceId.includes('..')) {
    throw new TypeError('Invalid approval resource identifier');
  }
  if (typeof input.operationSummary !== 'string' || input.operationSummary.trim().length < 1 || input.operationSummary.length > 500) {
    throw new TypeError('Invalid approval operation summary');
  }
  if (input.connectionId !== null && input.connectionId !== undefined) {
    requiredId(input.connectionId, 'connection identifier');
  }
  if (typeof input.inputDigest !== 'string' || !DIGEST_PATTERN.test(input.inputDigest)) {
    throw new TypeError('Invalid approval input digest');
  }
}

function isoTime(value, label) {
  const time = Date.parse(value);
  if (typeof value !== 'string' || !Number.isFinite(time)) {
    throw new TypeError('Invalid approval ' + label);
  }
  return new Date(time).toISOString();
}

export async function createApprovalRequest(db, input, now = Date.now()) {
  if (!db || typeof db.prepare !== 'function' || !input || typeof input !== 'object') {
    throw new TypeError('Approval database and request are required');
  }
  validateBinding(input);
  requiredId(input.requestedBy, 'requester');
  if (!Number.isFinite(now)) throw new TypeError('Invalid approval clock');
  const requestedAt = new Date(now).toISOString();
  const expiresAt = isoTime(input.expiresAt, 'expiry');
  const expiry = Date.parse(expiresAt);
  if (expiry <= now || expiry > now + MAX_APPROVAL_TTL_MS) {
    throw new TypeError('Approval expiry must be in the next 15 minutes');
  }

  const id = crypto.randomUUID();
  await db.prepare(`
    INSERT INTO capability_approvals (
      id, principal_id, capability_id, capability_version, action_id,
      resource_id, operation_summary, connection_id, input_digest, requested_by,
      requested_at, expires_at, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `).bind(
    id, input.principalId, input.capabilityId, input.capabilityVersion,
    input.actionId, input.resourceId, input.operationSummary.trim(), input.connectionId ?? null,
    input.inputDigest, input.requestedBy, requestedAt, expiresAt,
  ).run();

  const row = await db.prepare(
    'SELECT * FROM capability_approvals WHERE id = ?',
  ).bind(id).first();
  if (!row) throw new Error('Approval request could not be persisted');
  return mapApproval(row);
}


/**
 * Lists a bounded set of pending requests for the authenticated owner's inbox.
 * Expired requests remain visible so the owner can see why they can no longer
 * be decided; decideApprovalRequest still rejects them atomically.
 */
export async function listPendingApprovals(db, limit = 50) {
  if (!db || typeof db.prepare !== 'function') {
    throw new TypeError('Approval database is required');
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new TypeError('Approval list limit must be between 1 and 100');
  }
  const result = await db.prepare(`
    SELECT * FROM capability_approvals
    WHERE status = 'pending'
    ORDER BY requested_at DESC
    LIMIT ?
  `).bind(limit).all();
  return (result?.results || []).map(mapApproval);
}

/**
 * Loads one approved, unconsumed approval for an exact invocation binding.
 * The caller must still compare the returned connectionId with the live
 * connection and atomically consume this record immediately before execution.
 */
export async function loadApproval(db, {
  principalId, capabilityId, capabilityVersion, actionId, resourceId, inputDigest,
} = {}, now = Date.now()) {
  if (!db || typeof db.prepare !== 'function') {
    throw new TypeError('Approval database is required');
  }
  requiredId(principalId, 'principal');
  requiredId(capabilityId, 'capability identifier');
  requiredId(capabilityVersion, 'capability version');
  requiredId(actionId, 'action identifier');
  if (typeof resourceId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/.test(resourceId) || resourceId.includes('..')) {
    throw new TypeError('Invalid approval resource identifier');
  }
  if (typeof inputDigest !== 'string' || !DIGEST_PATTERN.test(inputDigest)) {
    throw new TypeError('Invalid approval input digest');
  }
  if (!Number.isFinite(now)) throw new TypeError('Invalid approval clock');

  const row = await db.prepare(`
    SELECT * FROM capability_approvals
    WHERE principal_id = ?
      AND capability_id = ?
      AND capability_version = ?
      AND action_id = ?
      AND resource_id = ?
      AND input_digest = ?
      AND status = 'approved'
      AND consumed_at IS NULL
      AND expires_at > ?
    ORDER BY decided_at DESC, requested_at DESC
    LIMIT 1
  `).bind(
    principalId, capabilityId, capabilityVersion, actionId,
    resourceId, inputDigest, new Date(now).toISOString(),
  ).first();
  return mapApproval(row);
}

export async function decideApprovalRequest(db, {
  id, decision, decidedBy, principalId = null, capabilityId = null, now = Date.now(),
} = {}) {
  requiredId(id, 'request identifier');
  requiredId(decidedBy, 'decision actor');
  if (principalId !== null) requiredId(principalId, 'principal');
  if (capabilityId !== null) requiredId(capabilityId, 'capability identifier');
  if (!['approved', 'denied'].includes(decision)) {
    throw new TypeError('Approval decision must be approved or denied');
  }
  if (!Number.isFinite(now)) throw new TypeError('Invalid approval clock');
  const decidedAt = new Date(now).toISOString();
  const row = await db.prepare(`
    UPDATE capability_approvals
    SET status = ?, decided_by = ?, decided_at = ?
    WHERE id = ? AND status = 'pending' AND expires_at > ?
      AND (? IS NULL OR principal_id = ?)
      AND (? IS NULL OR capability_id = ?)
    RETURNING *
  `).bind(decision, decidedBy, decidedAt, id, decidedAt, principalId, principalId, capabilityId, capabilityId).first();
  return mapApproval(row);
}

/**
 * Atomically consumes an approved decision for one exact operation.
 * A concurrent caller or replay receives null; no read-then-write window exists.
 */
export async function consumeApproval(db, {
  id, principalId, capabilityId, capabilityVersion, actionId,
  resourceId, operationSummary, connectionId = null, inputDigest, now = Date.now(),
} = {}) {
  requiredId(id, 'request identifier');
  validateBinding({
    principalId, capabilityId, capabilityVersion, actionId,
    resourceId, operationSummary, connectionId, inputDigest,
  });
  if (!Number.isFinite(now)) throw new TypeError('Invalid approval clock');
  const consumedAt = new Date(now).toISOString();
  const row = await db.prepare(`
    UPDATE capability_approvals
    SET status = 'consumed', consumed_at = ?
    WHERE id = ?
      AND status = 'approved'
      AND consumed_at IS NULL
      AND expires_at > ?
      AND principal_id = ?
      AND capability_id = ?
      AND capability_version = ?
      AND action_id = ?
      AND resource_id = ?
      AND operation_summary = ?
      AND connection_id IS ?
      AND input_digest = ?
    RETURNING *
  `).bind(
    consumedAt, id, consumedAt, principalId, capabilityId,
    capabilityVersion, actionId, resourceId, operationSummary.trim(), connectionId, inputDigest,
  ).first();
  return mapApproval(row);
}
