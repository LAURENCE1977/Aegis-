const ROUTE_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const TASK_DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const COST_CLASSES = Object.freeze(['deterministic', 'local', 'no_charge', 'metered', 'unknown']);
const ROUTE_PRIORITY = Object.freeze({
  deterministic: 0,
  local: 1,
  no_charge: 2,
});

function exactRecord(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    throw new TypeError(label + ' must be a plain object.');
  }
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== 'string' || !descriptor?.enumerable ||
        !Object.hasOwn(descriptor, 'value') || !allowed.includes(key)) {
      throw new TypeError(label + ' contains an unsupported field or accessor.');
    }
  }
}

function normaliseCandidate(candidate) {
  const fields = [
    'id',
    'costClass',
    'available',
    'suitable',
    'qualityAdequate',
    'termsVerified',
    'quotaAvailable',
  ];
  exactRecord(candidate, fields, 'Infinity Zero route candidate');
  if (typeof candidate.id !== 'string' || !ROUTE_ID_PATTERN.test(candidate.id)) {
    throw new TypeError('Infinity Zero route candidate identifier is invalid.');
  }
  if (!COST_CLASSES.includes(candidate.costClass)) {
    throw new TypeError('Infinity Zero route candidate cost class is unsupported.');
  }
  for (const key of fields.slice(2)) {
    if (typeof candidate[key] !== 'boolean') {
      throw new TypeError('Infinity Zero route candidate ' + key + ' must be boolean.');
    }
  }
  return {
    id: candidate.id,
    costClass: candidate.costClass,
    available: candidate.available,
    suitable: candidate.suitable,
    qualityAdequate: candidate.qualityAdequate,
    termsVerified: candidate.termsVerified,
    quotaAvailable: candidate.quotaAvailable,
  };
}

/**
 * Select an eligible route under Infinity Zero. This pure policy function
 * never authorises paid routes and never treats unknown pricing as free.
 * It does not invoke providers or prove their claims.
 */
export function decideInfinityZeroRoute(input) {
  exactRecord(input, ['mode', 'taskDigest', 'candidates'], 'Infinity Zero route request');
  if (input.mode !== 'infinity_zero') {
    throw new TypeError('Infinity Zero route mode is required.');
  }
  if (typeof input.taskDigest !== 'string' || !TASK_DIGEST_PATTERN.test(input.taskDigest)) {
    throw new TypeError('Infinity Zero task digest must be a lowercase SHA-256 digest.');
  }
  if (!Array.isArray(input.candidates) || input.candidates.length > 32) {
    throw new TypeError('Infinity Zero candidates must be an array of at most 32 entries.');
  }

  const candidates = input.candidates.map(normaliseCandidate);
  const ids = candidates.map(candidate => candidate.id);
  if (new Set(ids).size !== ids.length) {
    throw new TypeError('Infinity Zero route candidate identifiers must be unique.');
  }

  const eligible = candidates
    .filter(candidate =>
      Object.hasOwn(ROUTE_PRIORITY, candidate.costClass) &&
      candidate.available === true &&
      candidate.suitable === true &&
      candidate.qualityAdequate === true &&
      (candidate.costClass !== 'no_charge' ||
        (candidate.termsVerified === true && candidate.quotaAvailable === true)))
    .sort((a, b) =>
      ROUTE_PRIORITY[a.costClass] - ROUTE_PRIORITY[b.costClass] ||
      a.id.localeCompare(b.id));

  const selected = eligible[0] ?? null;
  return Object.freeze({
    schemaVersion: 'aegis.infinity-zero-route-decision.v1',
    decision: selected ? 'selected' : 'blocked',
    routeId: selected?.id ?? null,
    costClass: selected?.costClass ?? null,
    reason: selected ? 'highest_priority_eligible_zero_cost_route' : 'no_eligible_zero_cost_route',
    taskDigest: input.taskDigest,
    paidFallback: 'disabled',
  });
}
