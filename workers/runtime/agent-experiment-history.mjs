import { verifyAgentExperimentRecordDigest } from './agent-experiment-record.mjs';

const MAX_HISTORY_RECORDS = 500;
const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function validateHistoryRecord(record, index) {
  if (!isRecord(record) || record.schemaVersion !== 'aegis.experiment-record.v1') {
    throw new TypeError('History item ' + index + ' is not a supported experiment record.');
  }
  if (typeof record.ownerId !== 'string' || !record.ownerId.trim()) {
    throw new TypeError('Every history record must have an owner.');
  }
  if (typeof record.id !== 'string' || !record.id.trim() ||
      typeof record.createdAt !== 'string' ||
      !Number.isFinite(Date.parse(record.createdAt)) ||
      new Date(record.createdAt).toISOString() !== record.createdAt) {
    throw new TypeError('Every history record needs a valid identifier and canonical UTC timestamp.');
  }
  if (!isRecord(record.measurementContext) ||
      !isRecord(record.evaluation) ||
      !['complete', 'incomplete', 'no_safe_candidate'].includes(record.evaluation.status) ||
      !['balanced', 'lowest_cost', 'fastest', 'highest_reliability'].includes(record.evaluation.priority) ||
      typeof record.evaluation.currency !== 'string' ||
      !/^[A-Z]{3}$/.test(record.evaluation.currency) ||
      !Array.isArray(record.evaluation.criteria) ||
      record.evaluation.criteria.length < 1 || record.evaluation.criteria.length > 8 ||
      !Array.isArray(record.evaluation.candidates) ||
      record.evaluation.candidates.length < 2 || record.evaluation.candidates.length > 8) {
    throw new TypeError('Every history record must contain a supported, bounded evaluation.');
  }
  const criteriaIds = new Set();
  for (const criterion of record.evaluation.criteria) {
    if (!isRecord(criterion) || typeof criterion.id !== 'string' ||
        !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,79}$/.test(criterion.id) ||
        typeof criterion.description !== 'string' || !criterion.description.trim() ||
        criterion.description.length > 240 || criteriaIds.has(criterion.id)) {
      throw new TypeError('History record contains invalid or duplicate evaluation criteria.');
    }
    criteriaIds.add(criterion.id);
  }
  if (record.measurementContext.benchmarkId !== record.benchmarkId ||
      typeof record.measurementContext.id !== 'string' ||
      typeof record.measurementContext.benchmarkVersion !== 'string' ||
      typeof record.measurementContext.workloadDigest !== 'string' ||
      !DIGEST_PATTERN.test(record.measurementContext.workloadDigest) ||
      typeof record.measurementContext.runtime !== 'string' ||
      typeof record.measurementContext.runtimeVersion !== 'string' ||
      typeof record.measurementContext.region !== 'string' ||
      !Number.isInteger(record.measurementContext.concurrency) ||
      !Number.isInteger(record.measurementContext.warmupRuns) ||
      !Number.isInteger(record.measurementContext.measuredRuns) ||
      !Number.isInteger(record.measurementContext.timeoutMs)) {
    throw new TypeError('History record benchmark context is inconsistent.');
  }
  const candidateIds = new Set();
  for (const candidate of record.evaluation.candidates) {
    if (!isRecord(candidate) || typeof candidate.id !== 'string' || candidateIds.has(candidate.id)) {
      throw new TypeError('History record contains invalid or duplicate candidate identifiers.');
    }
    candidateIds.add(candidate.id);
  }
  return record;
}

function cohortDescriptor(record) {
  const context = record.measurementContext;
  const criteria = record.evaluation.criteria
    .map((item) => ({ id: item.id, description: item.description }))
    .sort((left, right) => compareText(left.id, right.id));
  const currency = record.evaluation.currency;
  const descriptor = {
    benchmarkId: record.benchmarkId,
    benchmarkVersion: context.benchmarkVersion,
    workloadDigest: context.workloadDigest,
    runtime: context.runtime,
    runtimeVersion: context.runtimeVersion,
    region: context.region,
    concurrency: context.concurrency,
    warmupRuns: context.warmupRuns,
    measuredRuns: context.measuredRuns,
    timeoutMs: context.timeoutMs,
    currency,
    criteria,
  };
  return { descriptor, key: JSON.stringify(descriptor) };
}

function validateCandidate(candidate, contextId, criterionIds) {
  if (!isRecord(candidate) ||
      typeof candidate.id !== 'string' ||
      !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,79}$/.test(candidate.id) ||
      candidate.measurementContextId !== contextId ||
      typeof candidate.costMinorUnits !== 'string' ||
      !/^(0|[1-9][0-9]{0,17})$/.test(candidate.costMinorUnits) ||
      !Number.isSafeInteger(candidate.elapsedMs) || candidate.elapsedMs < 1 ||
      typeof candidate.safetyChecksPassed !== 'boolean' ||
      !Number.isInteger(candidate.passedCriteria) || candidate.passedCriteria < 0 ||
      !Number.isInteger(candidate.failedCriteria) || candidate.failedCriteria < 0 ||
      !Number.isInteger(candidate.unknownCriteria) || candidate.unknownCriteria < 0 ||
      !Array.isArray(candidate.criterionResults)) {
    throw new TypeError('History contains a malformed candidate measurement.');
  }
  const resultIds = candidate.criterionResults.map((item) => {
    if (!isRecord(item) || typeof item.criterionId !== 'string') {
      throw new TypeError('History contains a malformed criterion result.');
    }
    return item.criterionId;
  }).sort(compareText);
  if (JSON.stringify(resultIds) !== JSON.stringify([...criterionIds].sort(compareText))) {
    throw new TypeError('History candidate criteria do not match the benchmark cohort.');
  }
  return candidate;
}

function direction(left, right, lowerIsBetter) {
  if (left === right) return 'unchanged';
  const improved = lowerIsBetter ? right < left : right > left;
  return improved ? (lowerIsBetter ? 'lower' : 'higher') : (lowerIsBetter ? 'higher' : 'lower');
}

function compareCandidate(candidateId, baseline, latest, observations) {
  const costDelta = BigInt(latest.costMinorUnits) - BigInt(baseline.costMinorUnits);
  return {
    candidateId,
    observations,
    baseline: {
      costMinorUnits: baseline.costMinorUnits,
      elapsedMs: baseline.elapsedMs,
      passedCriteria: baseline.passedCriteria,
      failedCriteria: baseline.failedCriteria,
    },
    latest: {
      costMinorUnits: latest.costMinorUnits,
      elapsedMs: latest.elapsedMs,
      passedCriteria: latest.passedCriteria,
      failedCriteria: latest.failedCriteria,
    },
    delta: {
      costMinorUnits: costDelta.toString(),
      elapsedMs: latest.elapsedMs - baseline.elapsedMs,
      passedCriteria: latest.passedCriteria - baseline.passedCriteria,
    },
    direction: {
      cost: direction(BigInt(baseline.costMinorUnits), BigInt(latest.costMinorUnits), true),
      elapsedMs: direction(baseline.elapsedMs, latest.elapsedMs, true),
      passedCriteria: direction(baseline.passedCriteria, latest.passedCriteria, false),
    },
  };
}

/**
 * Summarise verified experiment records without learning, recommending, or
 * changing policy. Only measurements from equivalent benchmark contexts are
 * compared. Deltas are descriptive observations, not statistical conclusions.
 */
export async function summarizeAgentExperimentHistory(records) {
  if (!Array.isArray(records) || records.length > MAX_HISTORY_RECORDS) {
    throw new TypeError('Experiment history must contain no more than 500 records.');
  }

  const validated = [];
  let ownerId = null;
  for (let index = 0; index < records.length; index += 1) {
    const record = validateHistoryRecord(records[index], index);
    if (ownerId === null) ownerId = record.ownerId;
    if (record.ownerId !== ownerId) {
      throw new TypeError('Experiment history must contain records for the same owner.');
    }
    if (!await verifyAgentExperimentRecordDigest(record)) {
      throw new TypeError('Experiment history record digest verification failed.');
    }
    validated.push(record);
  }

  const cohorts = new Map();
  for (const record of validated) {
    const { descriptor, key } = cohortDescriptor(record);
    if (!cohorts.has(key)) cohorts.set(key, { descriptor, records: [] });
    cohorts.get(key).records.push(record);
  }

  const summaries = [...cohorts.values()].map(({ descriptor, records: cohortRecords }) => {
    const ordered = [...cohortRecords].sort((left, right) =>
      compareText(left.createdAt, right.createdAt) || compareText(left.id, right.id)
    );
    const criterionIds = descriptor.criteria.map((item) => item.id);
    const candidatesByRecord = ordered.map((record) => {
      const map = new Map();
      for (const candidate of record.evaluation.candidates) {
        const checked = validateCandidate(candidate, record.measurementContext.id, criterionIds);
        map.set(checked.id, checked);
      }
      return { record, map };
    });
    const candidateIds = [...new Set(candidatesByRecord.flatMap(({ map }) => [...map.keys()]))].sort(compareText);
    const excludedCandidateIds = new Set();
    const incompleteCandidateIds = new Set();
    const candidateComparisons = [];

    for (const candidateId of candidateIds) {
      if (ordered.length < 2) continue;
      const observations = candidatesByRecord.map(({ map }) => map.get(candidateId));
      if (observations.some((candidate) => !candidate)) {
        incompleteCandidateIds.add(candidateId);
        continue;
      }
      if (observations.some((candidate) => !candidate.safetyChecksPassed)) {
        excludedCandidateIds.add(candidateId);
        continue;
      }
      if (ordered.some((record) => record.evaluation.status !== 'complete') ||
          observations.some((candidate) => candidate.unknownCriteria > 0)) {
        incompleteCandidateIds.add(candidateId);
        continue;
      }
      candidateComparisons.push(compareCandidate(
        candidateId,
        observations[0],
        observations[observations.length - 1],
        observations.length,
      ));
    }

    const status = ordered.length < 2
      ? 'insufficient_history'
      : candidateComparisons.length > 0 ? 'comparable' : 'no_comparable_candidates';
    return {
      ...descriptor,
      cohortId: descriptor.benchmarkId + ':' + descriptor.workloadDigest.slice(7, 19),
      recordCount: ordered.length,
      status,
      firstRecordId: ordered[0]?.id || null,
      lastRecordId: ordered[ordered.length - 1]?.id || null,
      excludedCandidateIds: [...excludedCandidateIds].sort(compareText),
      incompleteCandidateIds: [...incompleteCandidateIds].sort(compareText),
      candidateComparisons,
    };
  }).sort((left, right) =>
    compareText(left.benchmarkId, right.benchmarkId) ||
    compareText(left.workloadDigest, right.workloadDigest)
  );

  return deepFreeze({
    schemaVersion: 'aegis.experiment-history-analysis.v1',
    ownerId,
    recordCount: validated.length,
    cohorts: summaries,
    interpretation: 'Observed endpoint deltas only; no statistical significance, causation, recommendation, learning, or policy change is inferred.',
  });
}
