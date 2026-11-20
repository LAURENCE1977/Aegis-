const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,79}$/;
const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;
const MAX_EVIDENCE = 64;

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validateId(value, label) {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    throw new TypeError(label + ' must be a bounded identifier.');
  }
  return value;
}

function validateSafeText(value, label, maxLength) {
  if (typeof value !== 'string') throw new TypeError(label + ' must be text.');
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength ||
      /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new TypeError(label + ' must contain 1–' + maxLength + ' safe characters.');
  }
  return normalized;
}

function validateUtcTimestamp(value, label) {
  if (typeof value !== 'string') throw new TypeError(label + ' must be a UTC timestamp.');
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) {
    throw new TypeError(label + ' must be a canonical UTC timestamp.');
  }
  return value;
}

function validateMeasurementContext(value) {
  if (!isRecord(value) || value.schemaVersion !== 'aegis.measurement-context.v1') {
    throw new TypeError('A versioned measurement context is required.');
  }
  const context = {
    schemaVersion: 'aegis.measurement-context.v1',
    id: validateId(value.id, 'Measurement context ID'),
    benchmarkId: validateId(value.benchmarkId, 'Benchmark ID'),
    benchmarkVersion: validateSafeText(value.benchmarkVersion, 'Benchmark version', 40),
    workloadDigest: value.workloadDigest,
    runtime: value.runtime,
    runtimeVersion: validateSafeText(value.runtimeVersion, 'Runtime version', 80),
    region: value.region,
    concurrency: value.concurrency,
    warmupRuns: value.warmupRuns,
    measuredRuns: value.measuredRuns,
    timeoutMs: value.timeoutMs,
  };
  if (typeof context.workloadDigest !== 'string' || !DIGEST_PATTERN.test(context.workloadDigest)) {
    throw new TypeError('Workload digest must be a SHA-256 digest.');
  }
  if (typeof context.runtime !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,39}$/.test(context.runtime)) {
    throw new TypeError('Runtime must be a bounded lowercase identifier.');
  }
  if (typeof context.region !== 'string' || !/^(local|[A-Z0-9-]{2,16})$/.test(context.region)) {
    throw new TypeError('Region must be a bounded region identifier.');
  }
  if (!Number.isInteger(context.concurrency) || context.concurrency < 1 || context.concurrency > 32) {
    throw new TypeError('Concurrency must be between one and 32.');
  }
  if (!Number.isInteger(context.warmupRuns) || context.warmupRuns < 0 || context.warmupRuns > 20) {
    throw new TypeError('Warmup runs must be between zero and 20.');
  }
  if (!Number.isInteger(context.measuredRuns) || context.measuredRuns < 1 || context.measuredRuns > 100) {
    throw new TypeError('Measured runs must be between one and 100.');
  }
  if (!Number.isInteger(context.timeoutMs) || context.timeoutMs < 100 || context.timeoutMs > 300000) {
    throw new TypeError('Timeout must be between 100 and 300000 milliseconds.');
  }
  return context;
}

function validateEvaluation(value, contextId) {
  if (!isRecord(value) || !['complete', 'incomplete', 'no_safe_candidate'].includes(value.status)) {
    throw new TypeError('A supported evaluation status is required.');
  }
  if (!['balanced', 'lowest_cost', 'fastest', 'highest_reliability'].includes(value.priority)) {
    throw new TypeError('A supported evaluation priority is required.');
  }
  if (value.measurementContextId !== contextId) {
    throw new TypeError('Evaluation context identifier does not match the measurement context identifier.');
  }
  if (value.evidenceState !== 'references_recorded_not_independently_verified') {
    throw new TypeError('Evaluation evidence state is not supported.');
  }
  if (!Array.isArray(value.criteria) || value.criteria.length < 1 || value.criteria.length > 8) {
    throw new TypeError('Evaluation criteria must contain between one and eight items.');
  }
  const criteria = value.criteria.map((criterion) => {
    if (!isRecord(criterion)) throw new TypeError('Evaluation criterion must be an object.');
    return {
      id: validateId(criterion.id, 'Evaluation criterion ID'),
      description: validateSafeText(criterion.description, 'Evaluation criterion description', 240),
    };
  });
  const criterionIds = criteria.map((criterion) => criterion.id);
  if (new Set(criterionIds).size !== criterionIds.length) {
    throw new TypeError('Evaluation criterion IDs must be unique.');
  }
  if (!Array.isArray(value.candidates) || value.candidates.length < 2 || value.candidates.length > 8) {
    throw new TypeError('Evaluation must contain between two and eight candidates.');
  }
  const candidateIds = new Set();
  const requiredEvidence = new Map();
  const candidates = [];
  let currency = null;
  for (const candidate of value.candidates) {
    if (!isRecord(candidate)) throw new TypeError('Evaluation candidate must be an object.');
    const id = validateId(candidate.id, 'Candidate ID');
    if (candidateIds.has(id)) throw new TypeError('Evaluation candidate IDs must be unique.');
    candidateIds.add(id);
    if (candidate.measurementContextId !== contextId) {
      throw new TypeError('Every candidate must use the recorded measurement context identifier.');
    }
    if (typeof candidate.currency !== 'string' || !/^[A-Z]{3}$/.test(candidate.currency)) {
      throw new TypeError('Candidate currency must be an uppercase three-letter code.');
    }
    if (currency && currency !== candidate.currency) {
      throw new TypeError('All evaluation candidates must use the same currency.');
    }
    currency = candidate.currency;
    if (typeof candidate.costMinorUnits !== 'string' || !/^(0|[1-9][0-9]{0,17})$/.test(candidate.costMinorUnits)) {
      throw new TypeError('Candidate cost must be a non-negative integer string.');
    }
    if (!Number.isSafeInteger(candidate.elapsedMs) || candidate.elapsedMs < 1) {
      throw new TypeError('Candidate elapsed time must be a positive safe integer.');
    }
    const safetyRef = validateSafeText(candidate.safetyEvidenceRef, 'Safety evidence reference', 500);
    requiredEvidence.set(safetyRef, 'safety');
    if (typeof candidate.safetyChecksPassed !== 'boolean') {
      throw new TypeError('Candidate safety outcome must be explicit.');
    }
    if (!Array.isArray(candidate.criterionResults) || candidate.criterionResults.length !== criterionIds.length) {
      throw new TypeError('Candidate criterion results must match the evaluation criteria exactly.');
    }
    const seenCriteria = new Set();
    const counts = { pass: 0, fail: 0, unknown: 0 };
    const criterionResults = candidate.criterionResults.map((result) => {
      if (!isRecord(result) || !['pass', 'fail', 'unknown'].includes(result.outcome)) {
        throw new TypeError('Candidate criterion outcome is invalid.');
      }
      const criterionId = validateId(result.criterionId, 'Result criterion ID');
      if (!criterionIds.includes(criterionId) || seenCriteria.has(criterionId)) {
        throw new TypeError('Candidate criterion results must match the evaluation criteria exactly once.');
      }
      seenCriteria.add(criterionId);
      counts[result.outcome] += 1;
      if (result.outcome === 'unknown') {
        if (result.evidenceRef !== null) {
          throw new TypeError('Unknown criterion outcomes cannot cite evidence.');
        }
        return { criterionId, outcome: 'unknown', evidenceRef: null };
      }
      const ref = validateSafeText(result.evidenceRef, 'Criterion evidence reference', 500);
      requiredEvidence.set(ref, 'criterion');
      return { criterionId, outcome: result.outcome, evidenceRef: ref };
    });
    if (seenCriteria.size !== criterionIds.length) {
      throw new TypeError('Candidate criterion results must match the evaluation criteria exactly once.');
    }
    if (candidate.passedCriteria !== counts.pass ||
        candidate.failedCriteria !== counts.fail ||
        candidate.unknownCriteria !== counts.unknown) {
      throw new TypeError('Candidate criterion counts do not match the recorded outcomes.');
    }
    candidates.push({
      id,
      currency: candidate.currency,
      costMinorUnits: candidate.costMinorUnits,
      elapsedMs: candidate.elapsedMs,
      safetyChecksPassed: candidate.safetyChecksPassed,
      safetyEvidenceRef: safetyRef,
      measurementContextId: candidate.measurementContextId,
      criterionResults,
      passedCriteria: counts.pass,
      failedCriteria: counts.fail,
      unknownCriteria: counts.unknown,
    });
  }
  if (value.currency !== currency) {
    throw new TypeError('Evaluation currency must match all candidate currencies.');
  }
  const expectedExcluded = candidates
    .filter((candidate) => !candidate.safetyChecksPassed)
    .map((candidate) => candidate.id)
    .sort();
  const excluded = Array.isArray(value.excludedCandidateIds) ? value.excludedCandidateIds : [];
  if (new Set(excluded).size !== excluded.length ||
      excluded.some((id) => !candidateIds.has(id)) ||
      JSON.stringify([...excluded].sort()) !== JSON.stringify(expectedExcluded)) {
    throw new TypeError('Excluded candidate safety exclusion list must exactly match candidates that failed safety checks.');
  }
  const safeCandidates = candidates.filter((candidate) => candidate.safetyChecksPassed);
  const hasUnknownSafeResult = safeCandidates.some((candidate) => candidate.unknownCriteria > 0);
  const expectedStatus = safeCandidates.length === 0
    ? 'no_safe_candidate'
    : hasUnknownSafeResult ? 'incomplete' : 'complete';
  if (value.status !== expectedStatus) {
    throw new TypeError('Evaluation status does not match safety and evidence completeness.');
  }
  if (value.recommendation !== null) {
    if (!isRecord(value.recommendation) ||
        !candidateIds.has(value.recommendation.candidateId) ||
        expectedExcluded.includes(value.recommendation.candidateId)) {
      throw new TypeError('Recommendation cannot select an excluded candidate.');
    }
    const allowedBasis = value.priority === 'balanced'
      ? 'unique_pareto_dominant_candidate'
      : 'declared_priority_lexicographic_comparison';
    if (value.recommendation.basis !== allowedBasis) {
      throw new TypeError('Recommendation basis does not match the declared priority.');
    }
  }
  if (value.status !== 'complete' && value.recommendation !== null) {
    throw new TypeError('Incomplete or unsafe evaluations cannot recommend a candidate.');
  }
  if (value.priority === 'balanced') {
    if (!Array.isArray(value.paretoFront)) throw new TypeError('Balanced evaluation must include its Pareto frontier.');
    const front = new Set(value.paretoFront);
    if (front.size !== value.paretoFront.length ||
        value.paretoFront.some((id) => !safeCandidates.some((candidate) => candidate.id === id))) {
      throw new TypeError('Balanced Pareto frontier must contain unique safe candidates.');
    }
    if (value.recommendation &&
        (front.size !== 1 || !front.has(value.recommendation.candidateId))) {
      throw new TypeError('Balanced recommendation must be the unique Pareto candidate.');
    }
    if (value.status === 'complete' && front.size === 1 && value.recommendation === null) {
      throw new TypeError('A unique balanced Pareto candidate must be recommended.');
    }
  } else if (value.status === 'complete') {
    if (!Array.isArray(value.rankedCandidateIds)) {
      throw new TypeError('Priority evaluation must include its ranked candidates.');
    }
    const ranked = new Set(value.rankedCandidateIds);
    if (ranked.size !== safeCandidates.length ||
        ranked.size !== value.rankedCandidateIds.length ||
        safeCandidates.some((candidate) => !ranked.has(candidate.id))) {
      throw new TypeError('Ranked candidates must contain every safe candidate exactly once.');
    }
  }
  const normalizedEvaluation = {
    priority: value.priority,
    currency,
    measurementContextId: contextId,
    criteria,
    candidates,
    excludedCandidateIds: expectedExcluded,
    evidenceState: value.evidenceState,
    recommendation: value.recommendation === null
      ? null
      : { candidateId: value.recommendation.candidateId, basis: value.recommendation.basis },
    paretoFront: Array.isArray(value.paretoFront) ? [...value.paretoFront] : [],
    status: value.status,
    ...(Array.isArray(value.rankedCandidateIds)
      ? { rankedCandidateIds: [...value.rankedCandidateIds] }
      : {}),
  };
  return {
    evaluation: normalizedEvaluation,
    requiredEvidence,
  };
}

function validateEvidence(value, requiredEvidence) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_EVIDENCE) {
    throw new TypeError('Provide between one and 64 evidence manifest entries.');
  }
  const seen = new Set();
  const evidence = value.map((item) => {
    if (!isRecord(item)) throw new TypeError('Each evidence manifest entry must be an object.');
    const ref = validateSafeText(item.ref, 'Evidence reference', 500);
    if (seen.has(ref)) throw new TypeError('Evidence references must be unique.');
    seen.add(ref);
    if (!['safety', 'criterion', 'benchmark', 'cost', 'runtime'].includes(item.kind)) {
      throw new TypeError('Evidence kind is not supported.');
    }
    if (typeof item.sha256 !== 'string' || !DIGEST_PATTERN.test(item.sha256)) {
      throw new TypeError('Evidence must include a SHA-256 digest.');
    }
    const capturedAt = validateUtcTimestamp(item.capturedAt, 'Evidence capture time');
    const requiredKind = requiredEvidence.get(ref);
    if (requiredKind && requiredKind !== item.kind) {
      throw new TypeError('Evidence kind does not match the referenced evaluation result.');
    }
    return { kind: item.kind, ref, sha256: item.sha256, capturedAt };
  }).sort((left, right) => left.ref.localeCompare(right.ref));
  for (const [ref, kind] of requiredEvidence) {
    const entry = evidence.find((item) => item.ref === ref);
    if (!entry) throw new TypeError('A referenced evaluation item is missing from the evidence manifest.');
    if (entry.kind !== kind) throw new TypeError('Evidence kind does not match the referenced evaluation result.');
  }
  return evidence;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

async function sha256(value) {
  if (!globalThis.crypto?.subtle || typeof TextEncoder !== 'function') {
    throw new Error('Web Crypto SHA-256 support is required to create an experiment record.');
  }
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return 'sha256:' + Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
}

export async function createAgentExperimentRecord(input) {
  if (!isRecord(input)) throw new TypeError('Experiment record input must be an object.');
  const id = validateId(input.id, 'Experiment record ID');
  const ownerId = validateId(input.ownerId, 'Experiment owner ID');
  const sourceRunId = input.sourceRunId === undefined || input.sourceRunId === null
    ? null
    : validateId(input.sourceRunId, 'Source run ID');
  const benchmarkId = validateId(input.benchmarkId, 'Benchmark ID');
  const createdAt = validateUtcTimestamp(input.createdAt, 'Record creation time');
  const measurementContext = validateMeasurementContext(input.measurementContext);
  if (measurementContext.benchmarkId !== benchmarkId) {
    throw new TypeError('Record benchmark ID must match the measurement context.');
  }
  const { evaluation, requiredEvidence } = validateEvaluation(input.evaluation, measurementContext.id);
  const evidence = validateEvidence(input.evidence, requiredEvidence);
  const unsignedRecord = {
    schemaVersion: 'aegis.experiment-record.v1',
    id,
    ownerId,
    sourceRunId,
    benchmarkId,
    createdAt,
    measurementContext,
    evaluation,
    evidence,
  };
  const canonical = JSON.stringify(canonicalize(unsignedRecord));
  const recordDigest = await sha256(canonical);
  return deepFreeze({ ...unsignedRecord, recordDigest });
}
