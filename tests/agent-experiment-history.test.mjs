import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAgentExperiment } from '../workers/runtime/agent-evaluation.mjs';
import { createAgentExperimentRecord } from '../workers/runtime/agent-experiment-record.mjs';
import { summarizeAgentExperimentHistory } from '../workers/runtime/agent-experiment-history.mjs';

function makeInput({ id, createdAt, contextId, workloadDigest, costA, elapsedA, safeA = true }) {
  const context = {
    schemaVersion: 'aegis.measurement-context.v1',
    id: contextId,
    benchmarkId: 'routing-benchmark',
    benchmarkVersion: '1.0',
    workloadDigest,
    workloadEvidenceRef: 'benchmark:' + contextId,
    runtime: 'node',
    runtimeVersion: '22',
    region: 'local',
    concurrency: 1,
    warmupRuns: 1,
    measuredRuns: 5,
    timeoutMs: 30000,
  };
  const candidates = [
    {
      id: 'candidate-a',
      currency: 'GBP',
      costMinorUnits: String(costA),
      elapsedMs: elapsedA,
      safetyChecksPassed: safeA,
      safetyEvidenceRef: 'safety:' + contextId + ':a',
      measurementContextId: contextId,
      criterionResults: [{ criterionId: 'correctness', outcome: 'pass', evidenceRef: 'criterion:' + contextId + ':a' }],
    },
    {
      id: 'candidate-b',
      currency: 'GBP',
      costMinorUnits: '250',
      elapsedMs: 1500,
      safetyChecksPassed: true,
      safetyEvidenceRef: 'safety:' + contextId + ':b',
      measurementContextId: contextId,
      criterionResults: [{ criterionId: 'correctness', outcome: 'pass', evidenceRef: 'criterion:' + contextId + ':b' }],
    },
  ];
  const evaluation = evaluateAgentExperiment({
    priority: 'lowest_cost',
    criteria: [{ id: 'correctness', description: 'Produces a correct result' }],
    candidates,
  });
  for (const candidate of evaluation.candidates) {
    candidate.costEvidenceRef = 'cost:' + contextId + ':' + candidate.id;
    candidate.elapsedEvidenceRef = 'runtime:' + contextId + ':' + candidate.id;
  }
  const evidence = [
    { ref: context.workloadEvidenceRef, kind: 'benchmark', sha256: workloadDigest },
    ...evaluation.candidates.flatMap((candidate) => [
      { ref: candidate.safetyEvidenceRef, kind: 'safety' },
      { ref: candidate.costEvidenceRef, kind: 'cost' },
      { ref: candidate.elapsedEvidenceRef, kind: 'runtime' },
      ...candidate.criterionResults.map((result) => ({ ref: result.evidenceRef, kind: 'criterion' })),
    ]),
  ].map((entry) => ({
    ...entry,
    sha256: entry.sha256 || 'sha256:' + 'b'.repeat(64),
    capturedAt: createdAt,
  }));
  return {
    id,
    ownerId: 'owner',
    benchmarkId: context.benchmarkId,
    createdAt,
    measurementContext: context,
    evaluation,
    evidence,
  };
}

async function makeRecord(options) {
  return createAgentExperimentRecord(makeInput({
    workloadDigest: 'sha256:' + 'a'.repeat(64),
    ...options,
  }));
}

test('compares only matching benchmark workloads and reports observed candidate deltas', async () => {
  const older = await makeRecord({
    id: 'record-old',
    createdAt: '2026-11-20T10:00:00.000Z',
    contextId: 'context-old',
    costA: 200,
    elapsedA: 2000,
  });
  const newer = await makeRecord({
    id: 'record-new',
    createdAt: '2026-11-20T11:00:00.000Z',
    contextId: 'context-new',
    costA: 150,
    elapsedA: 1700,
  });

  const report = await summarizeAgentExperimentHistory([newer, older]);

  assert.equal(report.schemaVersion, 'aegis.experiment-history-analysis.v1');
  assert.equal(report.ownerId, 'owner');
  assert.equal(report.cohorts.length, 1);
  assert.equal(report.cohorts[0].recordCount, 2);
  assert.equal(report.cohorts[0].status, 'comparable');
  const candidate = report.cohorts[0].candidateComparisons.find((item) => item.candidateId === 'candidate-a');
  assert.equal(candidate.baseline.costMinorUnits, '200');
  assert.equal(candidate.latest.costMinorUnits, '150');
  assert.equal(candidate.delta.costMinorUnits, '-50');
  assert.equal(candidate.delta.elapsedMs, -300);
  assert.equal(candidate.direction.cost, 'lower');
  assert.equal(candidate.direction.elapsedMs, 'lower');
});

test('refuses to analyse tampered records whose digest no longer matches', async () => {
  const record = await makeRecord({
    id: 'record-tampered',
    createdAt: '2026-11-20T10:00:00.000Z',
    contextId: 'context-tampered',
    costA: 200,
    elapsedA: 2000,
  });
  const tampered = { ...record, evaluation: { ...record.evaluation, priority: 'fastest' } };

  await assert.rejects(
    () => summarizeAgentExperimentHistory([tampered]),
    /digest/i,
  );
});

test('does not compare records across different workload digests', async () => {
  const first = await makeRecord({
    id: 'record-workload-a',
    createdAt: '2026-11-20T10:00:00.000Z',
    contextId: 'context-workload-a',
    costA: 200,
    elapsedA: 2000,
  });
  const second = await createAgentExperimentRecord(makeInput({
    id: 'record-workload-b',
    createdAt: '2026-11-20T11:00:00.000Z',
    contextId: 'context-workload-b',
    workloadDigest: 'sha256:' + 'c'.repeat(64),
    costA: 100,
    elapsedA: 1000,
  }));

  const report = await summarizeAgentExperimentHistory([first, second]);

  assert.equal(report.cohorts.length, 2);
  assert.ok(report.cohorts.every((cohort) => cohort.status === 'insufficient_history'));
  assert.ok(report.cohorts.every((cohort) => cohort.candidateComparisons.length === 0));
});

test('does not include a candidate that failed safety in any observation', async () => {
  const safe = await makeRecord({
    id: 'record-safe',
    createdAt: '2026-11-20T10:00:00.000Z',
    contextId: 'context-safe',
    costA: 200,
    elapsedA: 2000,
  });
  const unsafe = await createAgentExperimentRecord(makeInput({
    id: 'record-unsafe',
    createdAt: '2026-11-20T11:00:00.000Z',
    contextId: 'context-unsafe',
    workloadDigest: 'sha256:' + 'a'.repeat(64),
    costA: 100,
    elapsedA: 1000,
    safeA: false,
  }));

  const report = await summarizeAgentExperimentHistory([safe, unsafe]);
  const cohort = report.cohorts[0];

  assert.ok(!cohort.candidateComparisons.some((item) => item.candidateId === 'candidate-a'));
  assert.ok(cohort.excludedCandidateIds.includes('candidate-a'));
});

test('rejects mixed-owner input and oversized histories', async () => {
  const record = await makeRecord({
    id: 'record-owner',
    createdAt: '2026-11-20T10:00:00.000Z',
    contextId: 'context-owner',
    costA: 200,
    elapsedA: 2000,
  });
  const otherOwner = { ...record, ownerId: 'other-owner' };

  await assert.rejects(() => summarizeAgentExperimentHistory([record, otherOwner]), /same owner/i);
  await assert.rejects(() => summarizeAgentExperimentHistory(Array(501).fill(record)), /500/i);
});
