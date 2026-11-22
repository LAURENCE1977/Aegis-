const DEFAULT_MAX_VERIFICATION_AGE_MS = 24 * 60 * 60 * 1000;

function parsePositiveInteger(value) {
  if (typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function isUtcTimestamp(value) {
  return typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value;
}

function windowStatus(row, nowMs, maxAgeMs) {
  if (row.status !== 'enabled' || row.unit_kind !== 'tokens') return 'disabled';
  if (!isUtcTimestamp(row.verified_at)) return 'unverified';
  const verifiedMs = Date.parse(row.verified_at);
  if (verifiedMs > nowMs) return 'unverified';
  if (nowMs - verifiedMs > maxAgeMs) return 'stale';
  return 'verified';
}

/**
 * Produce a safe owner-facing usage view. Quota is usable only when its
 * window is active and its verification is current; unknown values stay null.
 */
export function buildUsageDashboard({
  windows = [],
  reservations = [],
  now = new Date().toISOString(),
  paidInferenceApproved = 'false',
  maxTokensPerRun = '',
  maxVerificationAgeMs = DEFAULT_MAX_VERIFICATION_AGE_MS,
} = {}) {
  if (!isUtcTimestamp(now)) throw new TypeError('Invalid usage dashboard time');
  if (!Array.isArray(windows) || !Array.isArray(reservations) ||
      !Number.isSafeInteger(maxVerificationAgeMs) || maxVerificationAgeMs < 1) {
    throw new TypeError('Invalid usage dashboard input');
  }

  const nowMs = Date.parse(now);
  const ceiling = parsePositiveInteger(maxTokensPerRun);
  const activeWindows = windows.filter((row) =>
    row && row.status === 'enabled' && row.unit_kind === 'tokens' &&
    isUtcTimestamp(row.window_start) && isUtcTimestamp(row.window_end) &&
    Date.parse(row.window_start) <= nowMs && Date.parse(row.window_end) > nowMs
  );

  const safeWindows = activeWindows.map((row) => {
    const status = windowStatus(row, nowMs, maxVerificationAgeMs);
    const limitUnits = Number.isSafeInteger(row.limit_units) && row.limit_units >= 0
      ? row.limit_units : null;
    const settledUnits = Number.isSafeInteger(row.settled_units) && row.settled_units >= 0
      ? row.settled_units : null;
    const reservedUnits = Number.isSafeInteger(row.reserved_units) && row.reserved_units >= 0
      ? row.reserved_units : null;
    const usageKnown = limitUnits !== null && settledUnits !== null && reservedUnits !== null;
    const remaining = usageKnown ? limitUnits - settledUnits - reservedUnits : null;
    const overdrawn = usageKnown && remaining < 0;
    const verified = status === 'verified' && usageKnown && !overdrawn;
    const matchingReservations = Number.isSafeInteger(row.outstanding_reservations) &&
      row.outstanding_reservations >= 0
      ? row.outstanding_reservations
      : reservations.filter((reservation) =>
        reservation?.provider_id === row.provider_id &&
        reservation?.model_id === row.model_id &&
        reservation?.status === 'reserved'
      ).length;

    return Object.freeze({
      providerId: row.provider_id,
      modelId: row.model_id,
      unit: 'tokens',
      windowStart: row.window_start,
      windowEnd: row.window_end,
      verifiedAt: row.verified_at,
      status: overdrawn ? 'overdrawn' : usageKnown ? status : 'unavailable',
      limitUnits,
      settledUnits,
      reservedUnits,
      remainingUnits: verified ? remaining : null,
      outstandingReservations: matchingReservations,
      sourceUrl: typeof row.source_url === 'string' && row.source_url.startsWith('https://')
        ? row.source_url : null,
    });
  });

  const enabledByDeploymentGate = paidInferenceApproved === 'true';
  const canAuthorisePaidRun = enabledByDeploymentGate && ceiling !== null &&
    safeWindows.some((window) =>
      window.status === 'verified' && window.remainingUnits !== null &&
      window.remainingUnits >= ceiling
    );

  return Object.freeze({
    checkedAt: now,
    paidInference: Object.freeze({
      enabledByDeploymentGate,
      maxTokensPerRun: ceiling,
      canAuthorisePaidRun,
      note: 'Every paid run still requires separate exact-run owner approval.',
    }),
    windows: Object.freeze(safeWindows),
    totalActiveTokenWindows: safeWindows.length,
  });
}
