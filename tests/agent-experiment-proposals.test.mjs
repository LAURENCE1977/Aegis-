import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAgentExperimentProposals } from '../workers/runtime/agent-experiment-proposals.mjs';

function report(overrides = {}) {
  return {
    schemaVersion: 'aegis.experiment-history-analysis.v1',
    ownerId: 'owner',
    recordCount: 2,
    cohorts: [{
      benchmarkId: 'routing-benchmark',
      benchmarkVersion: '1.0',
      workloadDigest: 'sha256:' + 'a'.repeat(64),
      runtime: 'node',
      runtimeVersion: '22',
      region: 'local',
      concurrency: 1,
      warmupRuns: 1,
      measuredRuns: 5,
      timeoutMs: 30000,
      currency: 'GBP',
      criteria: [{ id: 'correctness', description: 'Produces a correct result' }],
      cohortId: 'routing-benchmark:aaaaaaaaaaaa',
      recordCount: 2,
      status: 'comparable',
      firstRecordId: 'record-old',
      lastRecordId: 'record-new',
      excludedCandidateIds: [],
      incompleteCandidateIds: [],
      candidateComparisons: [{
        candidateId: 'candidate-a',
        observations: 2,
        baseline: { costMinorUnits: '200', elapsedMs: 2000, passedCriteria: 1, failedCriteria: 0 },
        latest: { costMinorUnits: '150', elapsedMs: 1700, passedCriteria: 1, failedCriteria: 0 },
        delta: { costMinorUnits: '-50', elapsedMs: -300, passedCriteria: 0 },
        direction: { cost: 'lower', elapsedMs: 'lower', passedCriteria: 'unchanged' },
      }],
    }],
    interpretation: 'Observed endpoint deltas only.',
    ...overrides,
  };
}

test('creates a review proposal from a verified comparable cohort with observed improvements', () => {
  const proposals = buildAgentExperimentProposals(report());

  assert.equal(proposals.schemaVersion, 'aegis.experiment-proposals.v1');
  assert.equal(proposals.ownerId, 'owner');
  assert.equal(proposals.proposals.length, 1);
  const proposal = proposals.proposals[0];
  assert.equal(proposal.candidateId, 'candidate-a');
  assert.deepEqual(proposal.observedChanges, ['cost', 'elapsedMs']);
  assert.equal(proposal.evidence.firstRecordId, 'record-old');
  assert.equal(proposal.evidence.lastRecordId, 'record-new');
  assert.equal(proposal.evidence.workloadDigest, 'sha256:' + 'a'.repeat(64));
  assert.equal(proposal.expectedBenefit.kind, 'observed_potential_only');
  assert.equal(proposal.approval.required, true);
  assert.equal(proposal.approval.authority, 'Sentinel');
  assert.equal(proposal.execution, 'not_authorised');
  assert.equal(Object.isFrozen(proposals.proposals), true);
  assert.equal(Object.isFrozen(proposal.evidence), true);
});

test('does not propose from insufficient, incomparable, incomplete or unsafe cohorts', () => {
  const base = report().cohorts[0];
  for (const cohort of [
    { ...base, status: 'insufficient_history' },
    { ...base, status: 'no_comparable_candidates' },
    { ...base, status: 'comparable', excludedCandidateIds: ['candidate-a'] },
    { ...base, status: 'comparable', incompleteCandidateIds: ['candidate-a'] },
    { ...base, status: 'comparable', candidateComparisons: [] },
  ]) {
    const result = buildAgentExperimentProposals(report({ cohorts: [cohort] }));
    assert.equal(result.proposals.length, 0);
  }
});

test('does not propose when no measured dimension improved', () => {
  const cohort = report().cohorts[0];
  const comparison = cohort.candidateComparisons[0];
  comparison.direction = { cost: 'higher', elapsedMs: 'unchanged', passedCriteria: 'unchanged' };
  const result = buildAgentExperimentProposals(report({ cohorts: [cohort] }));
  assert.equal(result.proposals.length, 0);
});

test('records regressions as risks and never labels a candidate a winner', () => {
  const cohort = report().cohorts[0];
  const comparison = cohort.candidateComparisons[0];
  comparison.direction = { cost: 'lower', elapsedMs: 'higher', passedCriteria: 'unchanged' };
  const proposal = buildAgentExperimentProposals(report({ cohorts: [cohort] })).proposals[0];

  assert.ok(proposal.risks.some((risk) => risk.includes('elapsed time')));
  assert.equal(proposal.recommendation, null);
  assert.equal(proposal.status, 'human_review_required');
  assert.equal(proposal.execution, 'not_authorised');
});

test('rejects malformed or mixed-owner analysis rather than emitting proposals', () => {
  assert.throws(() => buildAgentExperimentProposals(null), /analysis report/i);
  const input = report({ ownerId: null });
  assert.throws(() => buildAgentExperimentProposals(input), /owner/i);
  const invalid = report();
  invalid.cohorts[0].candidateComparisons[0].delta.costMinorUnits = 'not-a-number';
  assert.throws(() => buildAgentExperimentProposals(invalid), /delta/i);
});

test('proposal IDs are deterministic for the same evidence and output is immutable', () => {
  const first = buildAgentExperimentProposals(report());
  const second = buildAgentExperimentProposals(report());
  assert.equal(first.proposals[0].id, second.proposals[0].id);
  assert.deepEqual(first, second);
  assert.throws(() => { first.proposals[0].status = 'approved'; }, TypeError);
});
