const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const UNIT_KINDS = new Set(['tokens', 'neurons']);

function requireId(value, label) {
  if (typeof value !== 'string' || !ID.test(value)) throw new TypeError('Invalid ' + label);
}

function requireUtc(value, label) {
  if (typeof value !== 'string' || !ISO_UTC.test(value) ||
      !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
    throw new TypeError('Invalid UTC ' + label);
  }
}

export function validateUsageReservation(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Invalid usage reservation');
  }
  for (const key of ['id', 'idempotencyKey', 'principalId', 'providerId', 'modelId']) {
    requireId(input[key], key);
  }
  if (input.projectId !== undefined && input.projectId !== null) requireId(input.projectId, 'project');
  if (!UNIT_KINDS.has(input.unitKind)) throw new TypeError('Invalid usage unit kind');
  if (!Number.isSafeInteger(input.reservedUnits) || input.reservedUnits < 1) {
    throw new TypeError('Invalid reserved units');
  }
  requireUtc(input.windowStart, 'window start');
  requireUtc(input.windowEnd, 'window end');
  if (Date.parse(input.windowEnd) <= Date.parse(input.windowStart)) {
    throw new TypeError('Invalid usage window range');
  }
  return Object.freeze({ ...input });
}

export function validateUsageSettlement({ reservedUnits, actualUnits }) {
  if (!Number.isSafeInteger(reservedUnits) || reservedUnits < 1 ||
      !Number.isSafeInteger(actualUnits) || actualUnits < 0) {
    throw new TypeError('Invalid actual usage units');
  }
  if (actualUnits > reservedUnits) {
    throw new RangeError('Actual usage exceeds the reservation; reject and investigate');
  }
  return Object.freeze({ reservedUnits, actualUnits });
}

export function isUsageWindowActive(window, now) {
  requireUtc(now, 'current time');
  requireUtc(window?.windowStart, 'window start');
  requireUtc(window?.windowEnd, 'window end');
  return Date.parse(now) >= Date.parse(window.windowStart) &&
    Date.parse(now) < Date.parse(window.windowEnd);
}

function requireDb(db) {
  if (!db || typeof db.prepare !== 'function' || typeof db.batch !== 'function') {
    throw new TypeError('D1 database binding is required');
  }
}

function reservationFromRow(row) {
  if (!row) return null;
  return Object.freeze({
    id: row.id,
    idempotencyKey: row.idempotency_key,
    principalId: row.principal_id,
    projectId: row.project_id ?? null,
    quotaWindowId: row.quota_window_id,
    reservedUnits: row.reserved_units,
    actualUnits: row.actual_units,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export async function reserveUsage({ db, reservation, quotaWindowId, now }) {
  requireDb(db);
  const input = validateUsageReservation(reservation);
  requireId(quotaWindowId, 'quota window');
  requireUtc(now, 'current time');
  if (!isUsageWindowActive(input, now)) throw new Error('Usage quota window is not active');

  const existing = await db.prepare(
    'SELECT r.*, w.provider_id, w.model_id, w.unit_kind, w.window_start, w.window_end FROM model_usage_reservations r JOIN model_usage_quota_windows w ON w.id = r.quota_window_id WHERE r.idempotency_key = ?'
  ).bind(input.idempotencyKey).first();
  if (existing) {
    const same = existing.principal_id === input.principalId &&
      existing.project_id === (input.projectId ?? null) &&
      existing.provider_id === input.providerId &&
      existing.model_id === input.modelId &&
      existing.unit_kind === input.unitKind &&
      existing.reserved_units === input.reservedUnits &&
      existing.window_start === input.windowStart &&
      existing.window_end === input.windowEnd &&
      existing.quota_window_id === quotaWindowId;
    if (!same) throw new Error('Idempotency key already belongs to a different usage reservation');
    return reservationFromRow(existing);
  }

  const insert = db.prepare(`
    INSERT INTO model_usage_reservations
      (id, idempotency_key, principal_id, project_id, quota_window_id, reserved_units, actual_units, status, created_at, updated_at)
    SELECT ?, ?, ?, ?, w.id, ?, NULL, 'reserved', ?, ?
    FROM model_usage_quota_windows w
    WHERE w.id = ? AND w.provider_id = ? AND w.model_id = ? AND w.unit_kind = ?
      AND w.window_start = ? AND w.window_end = ? AND w.status = 'enabled'
      AND w.window_start <= ? AND w.window_end > ?
      AND (SELECT COALESCE(SUM(CASE WHEN status = 'reserved' THEN reserved_units WHEN status = 'settled' THEN actual_units ELSE 0 END), 0)
           FROM model_usage_reservations WHERE quota_window_id = w.id) + ? <= w.limit_units
    ON CONFLICT(idempotency_key) DO NOTHING
  `).bind(
    input.id, input.idempotencyKey, input.principalId, input.projectId ?? null,
    input.reservedUnits, now, now, quotaWindowId, input.providerId, input.modelId,
    input.unitKind, input.windowStart, input.windowEnd, now, now, input.reservedUnits,
  );
  const event = db.prepare(`
    INSERT OR IGNORE INTO model_usage_events (event_id, reservation_id, event_type, detail_json, created_at)
    SELECT ?, id, 'reserved', ?, ? FROM model_usage_reservations
    WHERE id = ? AND status = 'reserved'
  `).bind('reserve:' + input.id, JSON.stringify({ reservedUnits: input.reservedUnits, unitKind: input.unitKind }), now, input.id);
  await db.batch([insert, event]);

  const saved = await db.prepare(
    'SELECT r.*, w.provider_id, w.model_id, w.unit_kind, w.window_start, w.window_end FROM model_usage_reservations r JOIN model_usage_quota_windows w ON w.id = r.quota_window_id WHERE r.idempotency_key = ?'
  ).bind(input.idempotencyKey).first();
  if (saved) {
    if (saved.reserved_units !== input.reservedUnits ||
        saved.principal_id !== input.principalId ||
        saved.project_id !== (input.projectId ?? null) ||
        saved.provider_id !== input.providerId || saved.model_id !== input.modelId ||
        saved.unit_kind !== input.unitKind || saved.window_start !== input.windowStart ||
        saved.window_end !== input.windowEnd || saved.quota_window_id !== quotaWindowId) {
      throw new Error('Idempotency key already belongs to a different usage reservation');
    }
    return reservationFromRow(saved);
  }
  throw new Error('Usage quota exhausted or quota window unavailable; no reservation was created');
}

export async function settleUsage({ db, reservationId, actualUnits, now }) {
  requireDb(db);
  requireId(reservationId, 'reservation');
  requireUtc(now, 'settlement time');
  const row = await db.prepare('SELECT reserved_units, status FROM model_usage_reservations WHERE id = ?')
    .bind(reservationId).first();
  if (!row) throw new Error('Usage reservation not found');
  if (row.status !== 'reserved') throw new Error('Usage reservation is not open');
  const usage = validateUsageSettlement({ reservedUnits: row.reserved_units, actualUnits });
  const update = db.prepare(
    "UPDATE model_usage_reservations SET status = 'settled', actual_units = ?, updated_at = ? WHERE id = ? AND status = 'reserved' AND reserved_units >= ?"
  ).bind(usage.actualUnits, now, reservationId, usage.actualUnits);
  const event = db.prepare(`
    INSERT OR IGNORE INTO model_usage_events (event_id, reservation_id, event_type, detail_json, created_at)
    SELECT ?, id, 'settled', ?, ? FROM model_usage_reservations
    WHERE id = ? AND status = 'settled' AND actual_units = ?
  `).bind('settle:' + reservationId, JSON.stringify({ actualUnits }), now, reservationId, actualUnits);
  const results = await db.batch([update, event]);
  if (!results?.[0]?.meta?.changes) throw new Error('Usage reservation changed before settlement');
  return Object.freeze({ reservationId, actualUnits, status: 'settled' });
}

export async function releaseUsage({ db, reservationId, reason, now }) {
  requireDb(db);
  requireId(reservationId, 'reservation');
  requireUtc(now, 'release time');
  if (typeof reason !== 'string' || !reason.trim() || reason.length > 200) {
    throw new TypeError('Invalid usage release reason');
  }
  const update = db.prepare(
    "UPDATE model_usage_reservations SET status = 'released', updated_at = ? WHERE id = ? AND status = 'reserved'"
  ).bind(now, reservationId);
  const event = db.prepare(`
    INSERT OR IGNORE INTO model_usage_events (event_id, reservation_id, event_type, detail_json, created_at)
    SELECT ?, id, 'released', ?, ? FROM model_usage_reservations
    WHERE id = ? AND status = 'released'
  `).bind('release:' + reservationId, JSON.stringify({ reason: reason.trim() }), now, reservationId);
  const results = await db.batch([update, event]);
  if (!results?.[0]?.meta?.changes) throw new Error('Usage reservation is missing or no longer open');
  return Object.freeze({ reservationId, status: 'released' });
}
