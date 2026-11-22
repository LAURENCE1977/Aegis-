const UNIT_KINDS = new Set(['tokens', 'neurons']);
const STATUSES = new Set(['enabled', 'disabled', 'review']);
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function requireUtc(value, label) {
  if (typeof value !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) ||
      !Number.isFinite(Date.parse(value)) ||
      new Date(value).toISOString() !== value) {
    throw new TypeError('Invalid resource-pool ' + label);
  }
  return Date.parse(value);
}

function requireNonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError('Invalid resource-pool ' + label);
  }
}

function readField(row, camel, snake) {
  return row[camel] === undefined ? row[snake] : row[camel];
}

function normalizeQuotaRow(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    throw new TypeError('Invalid resource-pool quota row');
  }
  const normalized = {
    quotaWindowId: readField(row, 'quotaWindowId', 'quota_window_id'),
    providerId: readField(row, 'providerId', 'provider_id'),
    modelId: readField(row, 'modelId', 'model_id'),
    unitKind: readField(row, 'unitKind', 'unit_kind'),
    windowStart: readField(row, 'windowStart', 'window_start'),
    windowEnd: readField(row, 'windowEnd', 'window_end'),
    limitUnits: readField(row, 'limitUnits', 'limit_units'),
    usedUnits: readField(row, 'usedUnits', 'used_units'),
    sourceUrl: readField(row, 'sourceUrl', 'source_url'),
    verifiedAt: readField(row, 'verifiedAt', 'verified_at'),
    status: row.status,
  };

  for (const key of ['quotaWindowId', 'providerId', 'modelId']) {
    if (typeof normalized[key] !== 'string' || !ID.test(normalized[key])) {
      throw new TypeError('Invalid resource-pool ' + key);
    }
  }
  if (!UNIT_KINDS.has(normalized.unitKind)) {
    throw new TypeError('Invalid resource-pool unit kind');
  }
  if (!STATUSES.has(normalized.status)) {
    throw new TypeError('Invalid resource-pool quota status');
  }
  const start = requireUtc(normalized.windowStart, 'window start');
  const end = requireUtc(normalized.windowEnd, 'window end');
  const verified = requireUtc(normalized.verifiedAt, 'verification time');
  if (end <= start) throw new TypeError('Invalid resource-pool quota window range');
  requireNonNegativeInteger(normalized.limitUnits, 'limit units');
  requireNonNegativeInteger(normalized.usedUnits, 'used units');

  if (typeof normalized.sourceUrl !== 'string') {
    throw new TypeError('Invalid resource-pool source URL');
  }
  let source;
  try { source = new URL(normalized.sourceUrl); } catch {
    throw new TypeError('Invalid resource-pool source URL');
  }
  if (source.protocol !== 'https:' || !source.hostname || source.username || source.password) {
    throw new TypeError('Resource-pool source URL must use HTTPS');
  }

  return { ...normalized, start, end, verified };
}

/**
 * Build a redacted, read-only view of provider quotas.
 * Tokens and Cloudflare Neurons remain distinct units and are never summed.
 * Missing, stale, disabled or unverified quota data is not treated as capacity.
 */
export function buildResourcePoolSnapshot({
  rows,
  now,
  maxAgeMs = DEFAULT_MAX_AGE_MS,
}) {
  const nowMs = requireUtc(now, 'observation time');
  if (!Number.isSafeInteger(maxAgeMs) || maxAgeMs < 1) {
    throw new TypeError('Invalid resource-pool verification age');
  }
  if (!Array.isArray(rows) || rows.length > 5000) {
    throw new TypeError('Invalid resource-pool quota rows');
  }

  const budgets = [];
  const seen = new Set();
  for (const raw of rows) {
    const row = normalizeQuotaRow(raw);
    if (row.usedUnits > row.limitUnits) {
      throw new RangeError('Resource-pool usage exceeds the verified quota limit');
    }
    if (row.status !== 'enabled' || row.start > nowMs || row.end <= nowMs ||
        row.verified > nowMs || nowMs - row.verified > maxAgeMs) {
      continue;
    }

    const key = [row.providerId, row.modelId, row.unitKind].join(':');
    if (seen.has(key)) {
      throw new Error('Duplicate active resource-pool quota window');
    }
    seen.add(key);

    budgets.push(Object.freeze({
      quotaWindowId: row.quotaWindowId,
      providerId: row.providerId,
      modelId: row.modelId,
      unitKind: row.unitKind,
      limitUnits: row.limitUnits,
      usedUnits: row.usedUnits,
      remainingUnits: row.limitUnits - row.usedUnits,
      windowStart: row.windowStart,
      windowEnd: row.windowEnd,
      verifiedAt: row.verifiedAt,
      sourceUrl: row.sourceUrl,
    }));
  }

  budgets.sort((a, b) =>
    a.providerId.localeCompare(b.providerId) ||
    a.modelId.localeCompare(b.modelId) ||
    a.unitKind.localeCompare(b.unitKind));

  return Object.freeze({
    schemaVersion: 'aegis.resource-pool.v1',
    observedAt: now,
    verificationMaxAgeMs: maxAgeMs,
    budgets: Object.freeze(budgets),
  });
}

/**
 * Read the active provider/model quota windows from D1.
 * Only server-authored quota rows are used; credentials are never selected.
 */
export async function readResourcePoolSnapshot({
  db,
  now,
  maxAgeMs = DEFAULT_MAX_AGE_MS,
}) {
  requireUtc(now, 'observation time');
  if (!db || typeof db.prepare !== 'function') {
    throw new TypeError('Resource-pool D1 database is required');
  }
  const result = await db.prepare(`
    SELECT
      w.id AS quota_window_id,
      w.provider_id,
      w.model_id,
      w.unit_kind,
      w.window_start,
      w.window_end,
      w.limit_units,
      w.source_url,
      w.verified_at,
      w.status,
      COALESCE(SUM(
        CASE
          WHEN r.status = 'reserved' THEN r.reserved_units
          WHEN r.status = 'settled' THEN COALESCE(r.actual_units, 0)
          ELSE 0
        END
      ), 0) AS used_units
    FROM model_usage_quota_windows w
    LEFT JOIN model_usage_reservations r
      ON r.quota_window_id = w.id
      AND r.status IN ('reserved', 'settled')
    WHERE w.status = 'enabled'
      AND w.window_start <= ?
      AND w.window_end > ?
      AND w.verified_at <= ?
    GROUP BY w.id
    ORDER BY w.provider_id, w.model_id, w.unit_kind
  `).bind(now, now, now).all();

  if (!result || !Array.isArray(result.results)) {
    throw new Error('Resource-pool quota query returned an invalid result');
  }
  return buildResourcePoolSnapshot({ rows: result.results, now, maxAgeMs });
}


/**
 * Merge verified token balances into server-approved provider state.
 * Provider enablement and paid-fallback approval remain owned by the caller;
 * quota observations can reduce capacity but can never enable a provider.
 */
export function mergeResourcePoolProviderState(snapshot, providerState) {
  if (!snapshot || typeof snapshot !== 'object' ||
      snapshot.schemaVersion !== 'aegis.resource-pool.v1' ||
      !Array.isArray(snapshot.budgets)) {
    throw new TypeError('Invalid resource-pool snapshot');
  }
  if (!providerState || typeof providerState !== 'object' || Array.isArray(providerState)) {
    throw new TypeError('Invalid server provider state');
  }

  const merged = {};
  for (const [providerId, state] of Object.entries(providerState)) {
    if (!ID.test(providerId) || !state || typeof state !== 'object' || Array.isArray(state)) {
      throw new TypeError('Invalid server provider state entry');
    }
    if (state.models !== undefined &&
        (!state.models || typeof state.models !== 'object' || Array.isArray(state.models))) {
      throw new TypeError('Invalid server model provider state');
    }
    merged[providerId] = state.enabled === true
      ? { ...state, models: { ...(state.models ?? {}) } }
      : { ...state };
  }

  for (const budget of snapshot.budgets) {
    if (!budget || typeof budget !== 'object' || Array.isArray(budget) ||
        typeof budget.providerId !== 'string' || !ID.test(budget.providerId) ||
        typeof budget.modelId !== 'string' || !ID.test(budget.modelId) ||
        !UNIT_KINDS.has(budget.unitKind) ||
        !Number.isSafeInteger(budget.remainingUnits) || budget.remainingUnits < 0) {
      throw new TypeError('Invalid resource-pool budget entry');
    }
    if (budget.unitKind !== 'tokens') continue;

    const provider = merged[budget.providerId];
    if (!provider || provider.enabled !== true) continue;

    provider.models[budget.modelId] = {
      ...(provider.models[budget.modelId] ?? {}),
      enabled: true,
      remainingTokens: budget.remainingUnits,
      quotaWindowId: budget.quotaWindowId,
    };
  }

  for (const provider of Object.values(merged)) {
    if (provider.models) {
      for (const [modelId, state] of Object.entries(provider.models)) {
        provider.models[modelId] = Object.freeze({ ...state });
      }
      Object.freeze(provider.models);
    }
    Object.freeze(provider);
  }
  return Object.freeze(merged);
}
