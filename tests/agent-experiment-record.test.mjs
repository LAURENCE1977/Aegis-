import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAgentExperiment } from '../workers/runtime/agent-evaluation.mjs';
import { createAgentExperimentRecord } from '../workers/runtime/agent-experiment-record.mjs';

const criteria = [
  { id: 'correctness', description: 'The outcome is correct' },
  { id: 'security', description: 'Security requirements are met' },
];

const measurementContext = {
  schemaVersion: 'aegis.measurement-context.v1',
  id: 'benchmark-context-v1',
  benchmarkId: 'routing-baseline',
  benchmarkVersion: '1.0.0',
  workloadDigest: 'sha256:' + 'a'.repeat(64),
  runtime: 'cloudflare-workers',
  runtimeVersion: '2026-11-20',
  region: 'WEUR',
  concurrency: 1,
  warmupRuns: 2,
  measuredRuns: 5,
  timeoutMs: 30000,
};

function candidate(id, costMinorUnits) {
  return {
    id,
    currency: 'GBP',
    costMinorUnits,
    elapsedMs: 1200,
    safetyChecksPassed: true,
    safetyEvidenceRef: 'safety:' + id,
    measurementContextId: measurementContext.id,
    criterionResults: criteria.map((criterion) => ({
      criterionId: criterion.id,
      outcome: 'pass',
      evidenceRef: 'criterion:' + id + ':' + criterion.id,
    })),
  };
}

function evidenceFor(ref, kind = ref.startsWith('safety:') ? 'safety' : 'criterion') {
  return {
    kind,
    ref,
    sha256: 'sha256:' + 'b'.repeat(64),
    capturedAt: '2026-11-20T20:00:00.000Z',
  };
}

function validInput() {
  const evaluation = evaluateAgentExperiment({
    priority: 'lowest_cost',
    criteria,
    candidates: [candidate('candidate-a', '100'), candidate('candidate-b', '200')],
  });
  const refs = evaluation.candidates.flatMap((item) => [
    item.safetyEvidenceRef,
    ...item.criterionResults.map((result) => result.evidenceRef).filter(Boolean),
  ]);
  return {
    id: 'experiment-1',
    ownerId: 'owner-1',
    sourceRunId: 'run-1',
    benchmarkId: measurementContext.benchmarkId,
    createdAt: '2026-11-20T20:05:00.000Z',
    measurementContext,
    evaluation,
    evidence: refs.map((ref) => evidenceFor(ref)),
  };
}

test('creates a versioned immutable record with a SHA-256 digest and complete evidence links', async () => {
  const record = await createAgentExperimentRecord(validInput());

  assert.equal(record.schemaVersion, 'aegis.experiment-record.v1');
  assert.equal(record.id, 'experiment-1');
  assert.equal(record.ownerId, 'owner-1');
  assert.equal(record.evaluation.recommendation.candidateId, 'candidate-a');
  assert.equal(record.evidence.length, 6);
  assert.match(record.recordDigest, /^sha256:[a-f0-9]{64}$/);
  assert.equal(Object.isFrozen(record), true);
  assert.equal(Object.isFrozen(record.measurementContext), true);
  assert.equal(Object.isFrozen(record.evidence), true);
  assert.equal(Object.isFrozen(record.evidence[0]), true);
  assert.equal('rawPayload' in record, false);
});

test('produces the same digest when evidence arrives in a different order', async () => {
  const input = validInput();
  const reversed = { ...input, evidence: [...input.evidence].reverse() };

  const first = await createAgentExperimentRecord(input);
  const second = await createAgentExperimentRecord(reversed);

  assert.equal(first.recordDigest, second.recordDigest);
});

test('rejects a record when any referenced safety or criterion evidence is missing', async () => {
  const input = validInput();
  input.evidence.pop();

  await assert.rejects(() => createAgentExperimentRecord(input), /missing from the evidence manifest/i);
});

test('rejects duplicate evidence references and malformed evidence digests', async () => {
  const input = validInput();
  input.evidence.push({ ...input.evidence[0] });
  await assert.rejects(() => createAgentExperimentRecord(input), /unique/i);

  const malformed = validInput();
  malformed.evidence[0].sha256 = 'not-a-digest';
  await assert.rejects(() => createAgentExperimentRecord(malformed), /SHA-256/i);
});

test('rejects mismatched measurement context and malformed benchmark controls', async () => {
  const mismatch = validInput();
  mismatch.measurementContext = { ...measurementContext, id: 'other-context' };
  await assert.rejects(() => createAgentExperimentRecord(mismatch), /context identifier/i);

  const invalidControls = validInput();
  invalidControls.measurementContext.measuredRuns = 0;
  await assert.rejects(() => createAgentExperimentRecord(invalidControls), /measured runs/i);
});

test('rejects recommendations for candidates excluded by the safety evaluation', async () => {
  const input = validInput();
  input.evaluation = {
    ...input.evaluation,
    excludedCandidateIds: ['candidate-a'],
    recommendation: { candidateId: 'candidate-a', basis: 'forged' },
  };

  await assert.rejects(() => createAgentExperimentRecord(input), /excluded candidate/i);
});

test('rejects invalid ownership, timestamps and unsupported evaluation states', async () => {
  const badOwner = validInput();
  badOwner.ownerId = '  ';
  await assert.rejects(() => createAgentExperimentRecord(badOwner), /owner/i);

  const badTime = validInput();
  badTime.createdAt = 'yesterday';
  await assert.rejects(() => createAgentExperimentRecord(badTime), /UTC timestamp/i);

  const badStatus = validInput();
  badStatus.evaluation = { ...badStatus.evaluation, status: 'approved' };
  await assert.rejects(() => createAgentExperimentRecord(badStatus), /evaluation status/i);
});


test('rejects a forged evaluation that recommends a candidate marked unsafe', async () => {
  const input = validInput();
  input.evaluation = {
    ...input.evaluation,
    candidates: input.evaluation.candidates.map((item) =>
      item.id === 'candidate-a' ? { ...item, safetyChecksPassed: false } : item
    ),
  };

  await assert.rejects(() => createAgentExperimentRecord(input), /safety exclusion/i);
});

test('rejects criterion counts or criterion identities that do not match the recorded outcomes', async () => {
  const wrongCounts = validInput();
  wrongCounts.evaluation = {
    ...wrongCounts.evaluation,
    candidates: wrongCounts.evaluation.candidates.map((item, index) =>
      index === 0 ? { ...item, passedCriteria: 1 } : item
    ),
  };
  await assert.rejects(() => createAgentExperimentRecord(wrongCounts), /criterion counts/i);

  const wrongIdentity = validInput();
  wrongIdentity.evaluation = {
    ...wrongIdentity.evaluation,
    candidates: wrongIdentity.evaluation.candidates.map((item, index) =>
      index === 0
        ? { ...item, criterionResults: [{ ...item.criterionResults[0], criterionId: 'invented' }, item.criterionResults[1]] }
        : item
    ),
  };
  await assert.rejects(() => createAgentExperimentRecord(wrongIdentity), /criterion results must match/i);
});

test('rejects a complete evaluation that contains unknown results or inconsistent currency', async () => {
  const incomplete = validInput();
  incomplete.evaluation = {
    ...incomplete.evaluation,
    candidates: incomplete.evaluation.candidates.map((item, index) =>
      index === 0
        ? { ...item, criterionResults: item.criterionResults.map((result, resultIndex) =>
            resultIndex === 0 ? { ...result, outcome: 'unknown', evidenceRef: null } : result
          ) }
        : item
    ),
  };
  await assert.rejects(() => createAgentExperimentRecord(incomplete), /status does not match/i);

  const mixedCurrency = validInput();
  mixedCurrency.evaluation = {
    ...mixedCurrency.evaluation,
    candidates: mixedCurrency.evaluation.candidates.map((item, index) =>
      index === 1 ? { ...item, currency: 'USD' } : item
    ),
  };
  await assert.rejects(() => createAgentExperimentRecord(mixedCurrency), /same currency/i);
});


test('stores only the versioned evaluation fields and does not copy arbitrary caller payloads', async () => {
  const input = validInput();
  input.evaluation = { ...input.evaluation, rawPayload: 'must-not-be-stored' };
  const record = await createAgentExperimentRecord(input);

  assert.equal('rawPayload' in record.evaluation, false);
  assert.equal(record.evaluation.candidates[0].rawPayload, undefined);
});
