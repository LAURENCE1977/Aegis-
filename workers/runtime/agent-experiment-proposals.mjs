const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;
const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,79}$/;
const DIRECTIONS = new Set(['lower', 'higher', 'unchanged']);

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function validateDelta(value) {
  if (!isRecord(value) ||
      typeof value.costMinorUnits !== 'string' ||
      !/^-?(0|[1-9][0-9]{0,18})$/.test(value.costMinorUnits) ||
      !Number.isSafeInteger(value.elapsedMs) ||
      !Number.isSafeInteger(value.passedCriteria)) {
    throw new TypeError('Analysis candidate delta is malformed.');
  }
  return value;
}

function validateComparison(comparison, cohort) {
  if (!isRecord(comparison) ||
      typeof comparison.candidateId !== 'string' || !ID_PATTERN.test(comparison.candidateId) ||
      !Number.isInteger(comparison.observations) || comparison.observations < 2 ||
      !isRecord(comparison.direction) ||
      !DIRECTIONS.has(comparison.direction.cost) ||
      !DIRECTIONS.has(comparison.direction.elapsedMs) ||
      !DIRECTIONS.has(comparison.direction.passedCriteria) ||
      !isRecord(comparison.baseline) || !isRecord(comparison.latest)) {
    throw new TypeError('Analysis candidate comparison is malformed.');
  }
  validateDelta(comparison.delta);
  for (const side of [comparison.baseline, comparison.latest]) {
    if (typeof side.costMinorUnits !== 'string' ||
        !/^(0|[1-9][0-9]{0,17})$/.test(side.costMinorUnits) ||
        !Number.isSafeInteger(side.elapsedMs) || side.elapsedMs < 1 ||
        !Number.isInteger(side.passedCriteria) || side.passedCriteria < 0 ||
        !Number.isInteger(side.failedCriteria) || side.failedCriteria < 0) {
      throw new TypeError('Analysis candidate endpoint measurements are malformed.');
    }
  }
  if (comparison.observations !== cohort.recordCount) {
    throw new TypeError('Analysis candidate observation count does not match its cohort.');
  }
}

function proposalFor(cohort, comparison, ownerId) {
  const observedChanges = [];
  const risks = [];
  for (const [key, label] of [
    ['cost', 'cost'],
    ['elapsedMs', 'elapsed time'],
    ['passedCriteria', 'passed criteria'],
  ]) {
    const direction = comparison.direction[key];
    if ((key === 'passedCriteria' && direction === 'higher') ||
        (key !== 'passedCriteria' && direction === 'lower')) {
      observedChanges.push(key);
    } else if ((key === 'passedCriteria' && direction === 'lower') ||
        (key !== 'passedCriteria' && direction === 'higher')) {
      risks.push('Observed regression in ' + label + ' between the recorded endpoints.');
    }
  }
  if (observedChanges.length === 0) return null;

  const id = [
    'proposal',
    cohort.benchmarkId,
    cohort.workloadDigest.slice(7, 19),
    comparison.candidateId,
    cohort.firstRecordId,
    cohort.lastRecordId,
  ].join(':');

  return {
    id,
    schemaVersion: 'aegis.experiment-improvement-proposal.v1',
    ownerId,
    status: 'human_review_required',
    benchmarkId: cohort.benchmarkId,
    benchmarkVersion: cohort.benchmarkVersion,
    cohortId: cohort.cohortId,
    candidateId: comparison.candidateId,
    workload: {
      digest: cohort.workloadDigest,
      runtime: cohort.runtime,
      runtimeVersion: cohort.runtimeVersion,
      region: cohort.region,
    },
    observedChanges,
    measurements: {
      currency: cohort.currency,
      baseline: { ...comparison.baseline },
      latest: { ...comparison.latest },
      delta: { ...comparison.delta },
      observations: comparison.observations,
    },
    evidence: {
      firstRecordId: cohort.firstRecordId,
      lastRecordId: cohort.lastRecordId,
      workloadDigest: cohort.workloadDigest,
      evidenceState: 'record_references_only_not_independently_verified',
    },
    expectedBenefit: {
      kind: 'observed_potential_only',
      statement: 'The recorded endpoints show a change in ' + observedChanges.join(', ') +
        '. This is a review lead, not a forecast or guarantee.',
    },
    risks: [
      ...risks,
      'Endpoint comparisons do not establish statistical significance, causation or durable performance.',
      'Underlying evidence artifacts have not been independently retrieved by this proposal builder.',
      'A candidate may improve one measured dimension while regressing another.',
    ],
    recommendation: null,
    approval: {
      required: true,
      authority: 'Sentinel',
      rule: 'A human must review the underlying evidence; Sentinel must independently authorise any consequential action.',
    },
    execution: 'not_authorised',
  };
}

/**
 * Convert verified, descriptive history into cautious review leads. This
 * function never selects a winner, changes policy, invokes Sentinel or acts.
 */
export function buildAgentExperimentProposals(analysis) {
  if (!isRecord(analysis) ||
      analysis.schemaVersion !== 'aegis.experiment-history-analysis.v1' ||
      typeof analysis.ownerId !== 'string' || !analysis.ownerId.trim() ||
      !Number.isInteger(analysis.recordCount) || analysis.recordCount < 0 ||
      !Array.isArray(analysis.cohorts) || analysis.cohorts.length > 500) {
    throw new TypeError('A supported analysis report with an owner is required.');
  }

  const proposals = [];
  for (const cohort of analysis.cohorts) {
    if (!isRecord(cohort)) throw new TypeError('Analysis cohort is malformed.');
    if (cohort.status !== 'comparable' || cohort.recordCount < 2 ||
        !DIGEST_PATTERN.test(cohort.workloadDigest || '') ||
        typeof cohort.benchmarkId !== 'string' || !ID_PATTERN.test(cohort.benchmarkId) ||
        typeof cohort.cohortId !== 'string' || !cohort.cohortId ||
        typeof cohort.firstRecordId !== 'string' || !ID_PATTERN.test(cohort.firstRecordId) ||
        typeof cohort.lastRecordId !== 'string' || !ID_PATTERN.test(cohort.lastRecordId) ||
        !Array.isArray(cohort.excludedCandidateIds) ||
        !Array.isArray(cohort.incompleteCandidateIds) ||
        !Array.isArray(cohort.candidateComparisons)) {
      continue;
    }
    for (const comparison of cohort.candidateComparisons) {
      validateComparison(comparison, cohort);
      if (cohort.excludedCandidateIds.includes(comparison.candidateId) ||
          cohort.incompleteCandidateIds.includes(comparison.candidateId)) continue;
      const proposal = proposalFor(cohort, comparison, analysis.ownerId);
      if (proposal) proposals.push(proposal);
    }
  }

  proposals.sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
  return deepFreeze({
    schemaVersion: 'aegis.experiment-proposals.v1',
    ownerId: analysis.ownerId,
    sourceAnalysisVersion: analysis.schemaVersion,
    sourceRecordCount: analysis.recordCount,
    proposalCount: proposals.length,
    proposals,
    interpretation: 'Review leads only. No candidate is declared a winner; no action is authorised.',
  });
}
