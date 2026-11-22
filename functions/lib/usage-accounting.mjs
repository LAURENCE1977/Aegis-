import { isCompleteProviderUsage } from './provider-usage.mjs';
import { reserveUsage, settleUsage } from './usage-ledger.mjs';

const DEFAULT_MAX_VERIFICATION_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_PROMPT_BYTES = 256 * 1024;
const MAX_OUTPUT_TOKENS = 8192;
const MAX_OVERHEAD_TOKENS = 4096;
const PROVIDER_USAGE_SOURCES = Object.freeze({
  anthropic: 'anthropic',
  'alibaba-qwen': 'openai-compatible',
});

function requireIdentifier(value, label) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)) {
    throw new TypeError('Invalid usage accounting ' + label);
  }
}

function requireUtc(value, label) {
  if (typeof value !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) ||
      !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
    throw new TypeError('Invalid usage accounting ' + label);
  }
}

/**
 * Reserve a conservative upper bound before a token-billed provider request.
 * UTF-8 payload bytes are a safety reservation estimate, never reported actual usage.
 */
export function estimateTokenReservation({
  messages,
  tools = [],
  maxOutputTokens,
  overheadTokens = 256,
  requestCount = 1,
  extraPromptBytes = 0,
} = {}) {
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > 14 ||
      messages.some(message => !message || typeof message !== 'object' ||
        typeof message.content !== 'string')) {
    throw new TypeError('Invalid usage accounting messages');
  }
  if (!Number.isSafeInteger(maxOutputTokens) || maxOutputTokens < 1 ||
      maxOutputTokens > MAX_OUTPUT_TOKENS) {
    throw new TypeError('Invalid usage accounting output token limit');
  }
  if (!Array.isArray(tools) || tools.length > 4) {
    throw new TypeError('Invalid usage accounting tool payload');
  }
  if (!Number.isSafeInteger(overheadTokens) || overheadTokens < 0 ||
      overheadTokens > MAX_OVERHEAD_TOKENS) {
    throw new TypeError('Invalid usage accounting overhead');
  }
  if (!Number.isSafeInteger(requestCount) || requestCount < 1 || requestCount > 2) {
    throw new TypeError('Invalid usage accounting request count');
  }
  if (!Number.isSafeInteger(extraPromptBytes) || extraPromptBytes < 0 ||
      extraPromptBytes > 16 * 1024) {
    throw new TypeError('Invalid usage accounting extra prompt bound');
  }
  const promptBytes = new TextEncoder().encode(JSON.stringify({ messages, tools })).byteLength;
  if (promptBytes < 1 || promptBytes > MAX_PROMPT_BYTES) {
    throw new RangeError('Usage accounting prompt exceeds the reservation bound');
  }
  const reservation = promptBytes * requestCount +
    maxOutputTokens * requestCount + overheadTokens + extraPromptBytes;
  if (!Number.isSafeInteger(reservation) || reservation < 1) {
    throw new RangeError('Invalid usage accounting reservation size');
  }
  return reservation;
}

/** Stable, opaque D1 identifiers scoped to one paid dispatch attempt. */
export async function deriveUsageReservationIds({ threadId, runId, providerId, modelId, attemptId } = {}) {
  requireIdentifier(threadId, 'thread identifier');
  requireIdentifier(runId, 'run identifier');
  requireIdentifier(providerId, 'provider identifier');
  requireIdentifier(modelId, 'model identifier');
  requireIdentifier(attemptId, 'attempt identifier');
  // A repeated AG-UI run ID is a new provider dispatch attempt, not a free replay.
  // Keep retries within this invocation idempotent while reserving quota again for
  // a separately received request, including retries after an incomplete stream.
  const source = JSON.stringify({ threadId, runId, providerId, modelId, attemptId });
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source));
  const hex = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
  return Object.freeze({
    reservationId: 'usage-' + hex,
    idempotencyKey: 'agui-' + hex,
  });
}

/** Convert validated provider-reported usage into the matching token unit. */
export function providerUsageUnits({ providerId, usage } = {}) {
  requireIdentifier(providerId, 'provider identifier');
  const expectedSource = PROVIDER_USAGE_SOURCES[providerId];
  if (!expectedSource || !usage || usage.source !== expectedSource) {
    throw new TypeError('Provider usage source does not match the selected provider');
  }
  if (!isCompleteProviderUsage(usage)) {
    throw new Error('Provider usage is incomplete; reservation must remain held for reconciliation');
  }
  return usage.totalTokens;
}

/** Resolve exactly one active, current, verified token quota window. */
export async function findActiveTokenQuotaWindow({
  db,
  providerId,
  modelId,
  now,
  maxAgeMs = DEFAULT_MAX_VERIFICATION_AGE_MS,
} = {}) {
  if (!db || typeof db.prepare !== 'function') {
    throw new TypeError('Usage accounting D1 database is required');
  }
  requireIdentifier(providerId, 'provider identifier');
  requireIdentifier(modelId, 'model identifier');
  requireUtc(now, 'current time');
  if (!Number.isSafeInteger(maxAgeMs) || maxAgeMs < 1) {
    throw new TypeError('Invalid usage accounting quota verification age');
  }
  const verifiedAfter = new Date(Date.parse(now) - maxAgeMs).toISOString();
  const result = await db.prepare(`
    SELECT id, window_start, window_end
    FROM model_usage_quota_windows
    WHERE provider_id = ? AND model_id = ? AND unit_kind = 'tokens'
      AND status = 'enabled'
      AND window_start <= ? AND window_end > ?
      AND verified_at <= ? AND verified_at >= ?
    ORDER BY verified_at DESC, id ASC
    LIMIT 2
  `).bind(providerId, modelId, now, now, now, verifiedAfter).all();

  if (!result || !Array.isArray(result.results)) {
    throw new Error('Usage accounting quota query returned an invalid result');
  }
  if (result.results.length > 1) {
    throw new Error('Duplicate active verified token quota windows');
  }
  if (result.results.length === 0) {
    throw new Error('No active verified token quota window is available');
  }
  const row = result.results[0];
  requireIdentifier(row.id, 'quota window identifier');
  requireUtc(row.window_start, 'quota window start');
  requireUtc(row.window_end, 'quota window end');
  if (Date.parse(row.window_end) <= Date.parse(row.window_start)) {
    throw new TypeError('Invalid usage accounting quota window range');
  }
  return Object.freeze({
    id: row.id,
    windowStart: row.window_start,
    windowEnd: row.window_end,
  });
}

/** Reserve quota before dispatching a paid token-provider request. */
export async function reserveTokenUsage({
  db,
  reservationId,
  idempotencyKey,
  principalId = 'owner',
  projectId = null,
  providerId,
  modelId,
  messages,
  tools = [],
  maxOutputTokens,
  overheadTokens = 256,
  requestCount = 1,
  extraPromptBytes = 0,
  now,
  maxAgeMs = DEFAULT_MAX_VERIFICATION_AGE_MS,
} = {}) {
  requireIdentifier(reservationId, 'reservation identifier');
  requireIdentifier(idempotencyKey, 'idempotency key');
  const reservedUnits = estimateTokenReservation({
    messages, tools, maxOutputTokens, overheadTokens, requestCount, extraPromptBytes,
  });
  const quota = await findActiveTokenQuotaWindow({ db, providerId, modelId, now, maxAgeMs });
  return reserveUsage({
    db,
    quotaWindowId: quota.id,
    now,
    maxAgeMs,
    reservation: {
      id: reservationId,
      idempotencyKey,
      principalId,
      projectId,
      providerId,
      modelId,
      unitKind: 'tokens',
      reservedUnits,
      windowStart: quota.windowStart,
      windowEnd: quota.windowEnd,
    },
  });
}

/**
 * Settle only complete, provider-matched actual usage. Missing or partial
 * usage throws and leaves the reservation open for reconciliation.
 */
export async function settleTokenUsage({ db, reservationId, providerId, modelId, usage, now } = {}) {
  const actualUnits = providerUsageUnits({ providerId, usage });
  requireIdentifier(modelId, 'model identifier');
  return settleUsage({ db, reservationId, actualUnits, now, expectedProviderId: providerId, expectedModelId: modelId });
}
