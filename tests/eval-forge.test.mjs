import test from 'node:test';
import assert from 'node:assert/strict';
import {
  scoreEvaluationRun,
  validateEvaluationSuite,
} from '../functions/lib/eval-forge.mjs';

const suite = {
  id: 'guardian-regression',
  version: '1.0.0',
  title: 'Guardian regression suite',
  taskType: 'reasoning',
  minimumScore: 80,
  cases: [
    { id: 'scope-check', weight: 5, required: true },
    { id: 'evidence-check', weight: 3, required: true },
    { id: 'latency-check', weight: 2, required: false },
  ],
};

const run = {
  id: 'run-001',
  candidateId: 'agent-aegis',
  candidateVersion: '0.4.0',
  candidateDigest: 'a'.repeat(64),
  completedAt: '2026-11-17T20:00:00.000Z',
  results: [
    { caseId: 'scope-check', status: 'passed', evidenceDigest: 'b'.repeat(64), durationMs: 12 },
    { caseId: 'evidence-check', status: 'passed', evidenceDigest: 'c'.repeat(64), durationMs: 18 },
    { caseId: 'latency-check', status: 'failed', evidenceDigest: 'd'.repeat(64), durationMs: 120 },
  ],
};

test('validates a versioned evaluation suite with bounded weighted cases', () => {
  assert.equal(validateEvaluationSuite(suite), true);
  assert.throws(() => validateEvaluationSuite({ ...suite, extra: true }), /field/i);
  assert.throws(() => validateEvaluationSuite({ ...suite, cases: [] }), /case/i);
  assert.throws(() => validateEvaluationSuite({
    ...suite,
    cases: [...suite.cases, { ...suite.cases[0] }],
  }), /duplicate/i);
  assert.throws(() => validateEvaluationSuite({
    ...suite,
    cases: suite.cases.map(item => ({ ...item, weight: 0 })),
  }), /weight/i);
});

test('scores a run deterministically using case weights and records candidate provenance', () => {
  const scored = scoreEvaluationRun(suite, run);
  assert.equal(scored.status, 'passed');
  assert.equal(scored.scorePercent, 80);
  assert.equal(scored.passedWeight, 8);
  assert.equal(scored.totalWeight, 10);
  assert.equal(scored.candidateDigest, run.candidateDigest);
  assert.equal(scored.suiteVersion, suite.version);
  assert.equal(scored.results.length, 3);
  assert.ok(Object.isFrozen(scored));
});

test('fails a run when any required case fails even if the weighted threshold is met', () => {
  const scored = scoreEvaluationRun(suite, {
    ...run,
    results: run.results.map(item => item.caseId === 'scope-check'
      ? { ...item, status: 'failed' }
      : { ...item, status: 'passed' }),
  });
  assert.equal(scored.scorePercent, 50);
  assert.equal(scored.status, 'failed');
  assert.deepEqual(scored.requiredFailures, ['scope-check']);
});

test('rejects missing, duplicate, unknown and malformed case results', () => {
  assert.throws(() => scoreEvaluationRun(suite, { ...run, results: run.results.slice(0, 2) }), /result/i);
  assert.throws(() => scoreEvaluationRun(suite, {
    ...run,
    results: [...run.results, run.results[0]],
  }), /duplicate/i);
  assert.throws(() => scoreEvaluationRun(suite, {
    ...run,
    results: run.results.map(item => item.caseId === 'latency-check' ? { ...item, caseId: 'unknown' } : item),
  }), /case/i);
  assert.throws(() => scoreEvaluationRun(suite, {
    ...run,
    results: run.results.map(item => ({ ...item, evidenceDigest: 'not-a-digest' })),
  }), /digest/i);
});

test('rejects tampered suite versions, candidate digests and timestamps', () => {
  assert.throws(() => scoreEvaluationRun({ ...suite, version: 'latest' }, run), /version/i);
  assert.throws(() => scoreEvaluationRun(suite, { ...run, candidateDigest: 'abc' }), /digest/i);
  assert.throws(() => scoreEvaluationRun(suite, { ...run, completedAt: 'yesterday' }), /timestamp/i);
});
