const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const STATUSES = new Set(['candidate', 'verified', 'rejected']);
const SENSITIVITY = new Set(['public', 'internal', 'private', 'restricted']);
const FIELDS = Object.freeze([
  'taskDigest',
  'inputDigest',
  'scopeDigest',
  'cachedTaskDigest',
  'cachedInputDigest',
  'cachedScopeDigest',
  'resultDigest',
  'sourceDigest',
  'currentSourceDigest',
  'verificationStatus',
  'sensitivity',
  'verifiedAt',
  'expiresAt',
  'now',
]);

function exactRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Reusable result request must be a plain object.');
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError('Reusable result request must be a plain object.');
  }
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== 'string' || !descriptor?.enumerable ||
        !Object.hasOwn(descriptor, 'value') || !FIELDS.includes(key)) {
      throw new TypeError('Reusable result request contains an unsupported field or accessor.');
    }
  }
  for (const field of FIELDS) {
    if (!Object.hasOwn(value, field)) {
      throw new TypeError('Reusable result request is missing ' + field + '.');
    }
  }
}

function requireDigest(value, label) {
  if (typeof value !== 'string' || !DIGEST_PATTERN.test(value)) {
    throw new TypeError('Reusable result ' + label + ' must be a lowercase SHA-256 digest.');
  }
}

function parseTimestamp(value, label) {
  if (typeof value !== 'string') {
    throw new TypeError('Reusable result ' + label + ' must be a canonical UTC timestamp.');
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new TypeError('Reusable result ' + label + ' must be a canonical UTC timestamp.');
  }
  return parsed.getTime();
}

function recompute(reason) {
  return Object.freeze({
    schemaVersion: 'aegis.reusable-result-decision.v1',
    decision: 'recompute',
    reason,
    resultDigest: null,
  });
}

/**
 * Decide whether a previously verified result can be reused.
 *
 * This is a pure eligibility policy, not a cache, verifier, storage adapter,
 * or proof that the supplied digests and verification status are truthful.
 * The caller must derive scope identity server-side and verify evidence before
 * marking a result as verified.
 */
export function decideReusableResult(input) {
  exactRecord(input);
  for (const field of [
    'taskDigest', 'inputDigest', 'scopeDigest',
    'cachedTaskDigest', 'cachedInputDigest', 'cachedScopeDigest',
    'resultDigest', 'sourceDigest', 'currentSourceDigest',
  ]) {
    requireDigest(input[field], field);
  }

  if (!STATUSES.has(input.verificationStatus)) {
    throw new TypeError('Reusable result verification status is invalid.');
  }
  if (!SENSITIVITY.has(input.sensitivity)) {
    throw new TypeError('Reusable result sensitivity is invalid.');
  }

  const verifiedAt = parseTimestamp(input.verifiedAt, 'verification time');
  const expiresAt = parseTimestamp(input.expiresAt, 'expiry time');
  const now = parseTimestamp(input.now, 'current time');
  if (expiresAt <= verifiedAt) {
    throw new TypeError('Reusable result expiry must follow verification time.');
  }

  // Check scope before reporting any other cache-match detail.
  if (input.scopeDigest !== input.cachedScopeDigest) return recompute('scope_mismatch');
  if (input.sensitivity === 'restricted') return recompute('restricted_data');
  if (input.verificationStatus !== 'verified') return recompute('not_verified');
  if (input.taskDigest !== input.cachedTaskDigest) return recompute('task_changed');
  if (input.inputDigest !== input.cachedInputDigest) return recompute('inputs_changed');
  if (input.sourceDigest !== input.currentSourceDigest) return recompute('source_changed');
  if (verifiedAt > now) return recompute('not_yet_verified');
  if (expiresAt <= now) return recompute('expired');

  return Object.freeze({
    schemaVersion: 'aegis.reusable-result-decision.v1',
    decision: 'reuse',
    reason: 'verified_exact_match',
    resultDigest: input.resultDigest,
  });
}
