const PRINCIPAL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const CAPABILITY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ACTION_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RETENTION_MS = 24 * 60 * 60 * 1000;

function requireId(value, pattern, label) {
  if (typeof value !== 'string' || !pattern.test(value)) {
    throw new TypeError('Invalid rate-limit ' + label);
  }
}

/**
 * Atomically reserves one invocation in a UTC minute bucket.
 *
 * The UPSERT's conditional UPDATE is evaluated by D1, so concurrent Workers
 * cannot all pass the same final slot. Old buckets are retained for 24 hours
 * to support bounded cleanup and operational inspection.
 */
export async function reserveCapabilityInvocation(db, {
  principalId,
  capabilityId,
  actionId,
  requestsPerMinute,
  now = Date.now(),
} = {}) {
  if (!db || typeof db.prepare !== 'function') {
    throw new TypeError('Rate-limit database is required');
  }
  requireId(principalId, PRINCIPAL_PATTERN, 'principal');
  requireId(capabilityId, CAPABILITY_PATTERN, 'capability identifier');
  requireId(actionId, ACTION_PATTERN, 'action identifier');
  if (!Number.isInteger(requestsPerMinute) || requestsPerMinute < 1 || requestsPerMinute > 10000) {
    throw new TypeError('Invalid requests-per-minute limit');
  }
  if (!Number.isFinite(now) || now < 0) throw new TypeError('Invalid rate-limit clock');

  const windowStart = Math.floor(now / 60_000) * 60_000;
  const updatedAt = new Date(now).toISOString();

  await db.prepare(`
    DELETE FROM capability_invocation_limits
    WHERE window_start_ms < ?
  `).bind(now - RETENTION_MS).run();

  const row = await db.prepare(`
    INSERT INTO capability_invocation_limits (
      principal_id, capability_id, action_id, window_start_ms, request_count, updated_at
    ) VALUES (?, ?, ?, ?, 1, ?)
    ON CONFLICT (principal_id, capability_id, action_id, window_start_ms)
    DO UPDATE SET
      request_count = capability_invocation_limits.request_count + 1,
      updated_at = excluded.updated_at
    WHERE capability_invocation_limits.request_count < ?
    RETURNING request_count
  `).bind(
    principalId, capabilityId, actionId, windowStart, updatedAt, requestsPerMinute,
  ).first();

  return Number.isInteger(row?.request_count) && row.request_count >= 1;
}
