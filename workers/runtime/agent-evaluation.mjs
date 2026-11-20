const ALLOWED_PRIORITIES = Object.freeze([
  'balanced',
  'lowest_cost',
  'fastest',
  'highest_reliability',
]);
const MAX_CRITERIA = 8;
const MAX_CANDIDATES = 8;
const MAX_EVIDENCE_REF_LENGTH = 500;
const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,79}$/;
const COST_PATTERN = /^(0|[1-9][0-9]{0,17})$/;

function isPlainRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validateId(value, label) {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    throw new TypeError(label + ' must be a bounded identifier.');
  }
  return value;
}

function validateCriteria(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_CRITERIA) {
    throw new TypeError('Provide between one and eight evaluation criteria.');
  }
  const seen = new Set();
  return value.map((criterion) => {
    if (!isPlainRecord(criterion)) throw new TypeError('Each criterion must be an object.');
    const id = validateId(criterion.id, 'Criterion ID');
    if (seen.has(id)) throw new TypeError('Criterion IDs must be unique.');
    seen.add(id);
    if (typeof criterion.description !== 'string' ||
        !criterion.description.trim() || criterion.description.length > 240) {
      throw new TypeError('Each criterion needs a bounded description.');
    }
    return { id, description: criterion.description.trim() };
  });
}

function validateCandidate(candidate, criterionIds, expectedCurrency) {
  if (!isPlainRecord(candidate)) throw new TypeError('Each candidate must be an object.');
  const id = validateId(candidate.id, 'Candidate ID');
  if (typeof candidate.currency !== 'string' || !/^[A-Z]{3}$/.test(candidate.currency)) {
    throw new TypeError('Candidate currency must be an uppercase three-letter code.');
  }
  if (expectedCurrency && candidate.currency !== expectedCurrency) {
    throw new TypeError('All candidates must use the same currency to compare costs.');
  }
  if (typeof candidate.costMinorUnits !== 'string' || !COST_PATTERN.test(candidate.costMinorUnits)) {
    throw new TypeError('Cost must be a non-negative integer string in minor units.');
  }
  if (!Number.isSafeInteger(candidate.elapsedMs) || candidate.elapsedMs < 1) {
    throw new TypeError('Elapsed time must be a positive safe integer in milliseconds.');
  }
  if (typeof candidate.safetyChecksPassed !== 'boolean') {
    throw new TypeError('Safety-check outcome must be explicit.');
  }
  if (!Array.isArray(candidate.criterionResults) || candidate.criterionResults.length !== criterionIds.length) {
    throw new TypeError('Every candidate must report exactly one result for every criterion.');
  }
  const seen = new Set();
  const criterionResults = candidate.criterionResults.map((result) => {
    if (!isPlainRecord(result)) throw new TypeError('Each criterion result must be an object.');
    const criterionId = validateId(result.criterionId, 'Result criterion ID');
    if (!criterionIds.includes(criterionId) || seen.has(criterionId)) {
      throw new TypeError('Criterion results must match the evaluation criteria exactly once.');
    }
    seen.add(criterionId);
    if (!['pass', 'fail', 'unknown'].includes(result.outcome)) {
      throw new TypeError('Criterion outcome must be pass, fail or unknown.');
    }
    if (result.outcome === 'unknown') {
      if (result.evidenceRef !== undefined && result.evidenceRef !== null) {
        throw new TypeError('Unknown outcomes cannot claim supporting evidence.');
      }
      return { criterionId, outcome: 'unknown', evidenceRef: null };
    }
    if (typeof result.evidenceRef !== 'string' || !result.evidenceRef.trim() ||
        result.evidenceRef.length > MAX_EVIDENCE_REF_LENGTH ||
        /[\u0000-\u001f\u007f]/.test(result.evidenceRef)) {
      throw new TypeError('Pass and fail outcomes require a bounded evidence reference.');
    }
    return {
      criterionId,
      outcome: result.outcome,
      evidenceRef: result.evidenceRef.trim(),
    };
  });
  if (seen.size !== criterionIds.length) {
    throw new TypeError('Every evaluation criterion must be represented.');
  }
  const passedCriteria = criterionResults.filter((item) => item.outcome === 'pass').length;
  const failedCriteria = criterionResults.filter((item) => item.outcome === 'fail').length;
  const unknownCriteria = criterionResults.filter((item) => item.outcome === 'unknown').length;
  return {
    id,
    currency: candidate.currency,
    costMinorUnits: candidate.costMinorUnits,
    elapsedMs: candidate.elapsedMs,
    safetyChecksPassed: candidate.safetyChecksPassed,
    criterionResults,
    passedCriteria,
    failedCriteria,
    unknownCriteria,
  };
}

function comparePriority(priority, left, right) {
  const byCost = () => BigInt(left.costMinorUnits) < BigInt(right.costMinorUnits) ? -1
    : BigInt(left.costMinorUnits) > BigInt(right.costMinorUnits) ? 1 : 0;
  const byTime = () => left.elapsedMs - right.elapsedMs;
  const byReliability = () => right.passedCriteria - left.passedCriteria;
  const comparators = {
    lowest_cost: [byCost, byReliability, byTime],
    fastest: [byTime, byReliability, byCost],
    highest_reliability: [byReliability, byCost, byTime],
  };
  for (const compare of comparators[priority] || []) {
    const result = compare();
    if (result !== 0) return result;
  }
  return 0;
}

function dominates(left, right) {
  const noWorse = left.passedCriteria >= right.passedCriteria &&
    BigInt(left.costMinorUnits) <= BigInt(right.costMinorUnits) &&
    left.elapsedMs <= right.elapsedMs;
  const strictlyBetter = left.passedCriteria > right.passedCriteria ||
    BigInt(left.costMinorUnits) < BigInt(right.costMinorUnits) ||
    left.elapsedMs < right.elapsedMs;
  return noWorse && strictlyBetter;
}

export function evaluateAgentExperiment(input) {
  if (!isPlainRecord(input) || !ALLOWED_PRIORITIES.includes(input.priority)) {
    throw new TypeError('A valid experiment and supported priority are required.');
  }
  const criteria = validateCriteria(input.criteria);
  if (!Array.isArray(input.candidates) || input.candidates.length < 2 ||
      input.candidates.length > MAX_CANDIDATES) {
    throw new TypeError('Provide between two and eight candidate outcomes.');
  }
  const criterionIds = criteria.map((criterion) => criterion.id);
  const candidates = [];
  const ids = new Set();
  let currency = null;
  for (const candidate of input.candidates) {
    const validated = validateCandidate(candidate, criterionIds, currency);
    if (ids.has(validated.id)) throw new TypeError('Candidate IDs must be unique.');
    ids.add(validated.id);
    currency = validated.currency;
    candidates.push(validated);
  }

  const excludedCandidateIds = candidates
    .filter((candidate) => !candidate.safetyChecksPassed)
    .map((candidate) => candidate.id)
    .sort();
  const safeCandidates = candidates.filter((candidate) => candidate.safetyChecksPassed);
  const hasUnknownResults = safeCandidates.some((candidate) => candidate.unknownCriteria > 0);

  const base = {
    priority: input.priority,
    currency,
    criteria: criteria.map(({ id, description }) => ({ id, description })),
    candidates,
    excludedCandidateIds,
    evidenceState: 'references_recorded_not_independently_verified',
    recommendation: null,
    paretoFront: [],
  };

  if (safeCandidates.length === 0) {
    return { ...base, status: 'no_safe_candidate' };
  }
  if (hasUnknownResults) {
    return { ...base, status: 'incomplete' };
  }

  if (input.priority === 'balanced') {
    const paretoFront = safeCandidates
      .filter((candidate) => !safeCandidates.some((other) =>
        other.id !== candidate.id && dominates(other, candidate)
      ))
      .map((candidate) => candidate.id)
      .sort();
    const recommendation = paretoFront.length === 1
      ? { candidateId: paretoFront[0], basis: 'unique_pareto_dominant_candidate' }
      : null;
    return {
      ...base,
      status: 'complete',
      paretoFront,
      recommendation,
    };
  }

  const ranked = [...safeCandidates].sort((left, right) =>
    comparePriority(input.priority, left, right) || left.id.localeCompare(right.id)
  );
  const uniqueBest = ranked.length === 1 ||
    comparePriority(input.priority, ranked[0], ranked[1]) !== 0;
  return {
    ...base,
    status: 'complete',
    rankedCandidateIds: ranked.map((candidate) => candidate.id),
    recommendation: uniqueBest
      ? { candidateId: ranked[0].id, basis: 'declared_priority_lexicographic_comparison' }
      : null,
  };
}
