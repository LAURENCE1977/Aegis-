import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAgentExperiment } from '../workers/runtime/agent-evaluation.mjs';

const criteria = [
  { id: 'correctness', description: 'The outcome is correct' },
  { id: 'security', description: 'Security requirements are met' },
];

function candidate(id, { cost = '100', elapsed = 1000, outcomes = ['pass', 'pass'], safe = true } = {}) {
  return {
    id,
    currency: 'GBP',
    costMinorUnits: cost,
    elapsedMs: elapsed,
    safetyChecksPassed: safe,
    safetyEvidenceRef: 'safety-evidence:' + id,
    measurementContextId: 'benchmark-context-v1',
    criterionResults: outcomes.map((outcome, index) => ({
      criterionId: criteria[index].id,
      outcome,
      ...(outcome === 'unknown' ? {} : { evidenceRef: 'evidence:' + id + ':' + criteria[index].id }),
    })),
  };
}

function experiment(priority, candidates) {
  return evaluateAgentExperiment({ priority, criteria, candidates });
}

test('recommends the lowest-cost fully evidenced safe candidate when cost is the declared priority', () => {
  const result = experiment('lowest_cost', [
    candidate('more-expensive', { cost: '250' }),
    candidate('lower-cost', { cost: '90' }),
  ]);
  assert.equal(result.status, 'complete');
  assert.equal(result.recommendation.candidateId, 'lower-cost');
  assert.equal(result.evidenceState, 'references_recorded_not_independently_verified');
});

test('recommends the fastest fully evidenced safe candidate when speed is the declared priority', () => {
  const result = experiment('fastest', [
    candidate('slower', { elapsed: 2200 }),
    candidate('faster', { elapsed: 900 }),
  ]);
  assert.equal(result.recommendation.candidateId, 'faster');
});

test('uses measured acceptance-criterion outcomes for reliability comparisons', () => {
  const result = experiment('highest_reliability', [
    candidate('less-reliable', { outcomes: ['pass', 'fail'] }),
    candidate('more-reliable', { outcomes: ['pass', 'pass'] }),
  ]);
  assert.equal(result.recommendation.candidateId, 'more-reliable');
  assert.equal(result.candidates.find(item => item.id === 'less-reliable').passedCriteria, 1);
});

test('does not invent a winner when balanced candidates are non-dominated trade-offs', () => {
  const result = experiment('balanced', [
    candidate('cheap-slower', { cost: '80', elapsed: 2500 }),
    candidate('fast-costlier', { cost: '200', elapsed: 800 }),
  ]);
  assert.equal(result.status, 'complete');
  assert.equal(result.recommendation, null);
  assert.deepEqual(result.paretoFront.sort(), ['cheap-slower', 'fast-costlier']);
});

test('selects a unique balanced candidate only when it dominates every alternative', () => {
  const result = experiment('balanced', [
    candidate('dominated', { cost: '200', elapsed: 2000, outcomes: ['pass', 'fail'] }),
    candidate('dominant', { cost: '100', elapsed: 1000, outcomes: ['pass', 'pass'] }),
  ]);
  assert.equal(result.recommendation.candidateId, 'dominant');
  assert.deepEqual(result.paretoFront, ['dominant']);
});

test('withholds recommendations when any candidate lacks measured criterion outcomes', () => {
  const result = experiment('lowest_cost', [
    candidate('complete'),
    candidate('unknown-result', { outcomes: ['pass', 'unknown'] }),
  ]);
  assert.equal(result.status, 'incomplete');
  assert.equal(result.recommendation, null);
});

test('excludes unsafe candidates and reports when no safe candidate remains', () => {
  const result = experiment('fastest', [
    candidate('unsafe-fast', { elapsed: 100, safe: false }),
    candidate('unsafe-slow', { elapsed: 200, safe: false }),
  ]);
  assert.equal(result.status, 'no_safe_candidate');
  assert.equal(result.recommendation, null);
  assert.deepEqual(result.excludedCandidateIds.sort(), ['unsafe-fast', 'unsafe-slow']);
});

test('rejects incomparable currencies, malformed evidence and duplicate candidate identities', () => {
  const mixed = [candidate('one'), { ...candidate('two'), currency: 'USD' }];
  assert.throws(() => experiment('lowest_cost', mixed));
  const missingEvidence = candidate('missing-evidence');
  delete missingEvidence.criterionResults[0].evidenceRef;
  assert.throws(() => experiment('fastest', [missingEvidence]));
  assert.throws(() => experiment('balanced', [candidate('same'), candidate('same')]));
});

test('rejects malformed metrics, criteria and priorities', () => {
  assert.throws(() => experiment('free-money', [candidate('one')]));
  assert.throws(() => evaluateAgentExperiment({ priority: 'balanced', criteria: [], candidates: [candidate('one')] }));
  assert.throws(() => experiment('balanced', [candidate('one', { cost: '-1' })]));
  assert.throws(() => experiment('balanced', [candidate('one', { elapsed: 0 })]));
  assert.throws(() => evaluateAgentExperiment({
    priority: 'balanced',
    criteria,
    candidates: [candidate('one', { outcomes: ['pass', 'pass'] }), candidate('two', { outcomes: ['pass', 'pass'] })]
      .map(item => ({ ...item, criterionResults: [...item.criterionResults, item.criterionResults[0]] })),
  }));
});

test('rejects candidates measured under different conditions or without safety evidence', () => {
  const differentContext = [
    candidate('one'),
    { ...candidate('two'), measurementContextId: 'different-machine' },
  ];
  assert.throws(() => experiment('fastest', differentContext));
  const missingSafetyEvidence = candidate('no-safety-evidence');
  delete missingSafetyEvidence.safetyEvidenceRef;
  assert.throws(() => experiment('balanced', [missingSafetyEvidence, candidate('other')]));
  const unsafeSafetyEvidence = candidate('control-character-evidence');
  unsafeSafetyEvidence.safetyEvidenceRef = 'bad\\u0000value';
  assert.throws(() => experiment('balanced', [unsafeSafetyEvidence, candidate('other')]));
});
