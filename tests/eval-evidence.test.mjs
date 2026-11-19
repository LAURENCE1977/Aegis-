import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyEvaluationRunEvidence } from '../functions/lib/eval-evidence.mjs';

const suite = {
  id: 'guardian-regression',
  version: '1.0.0',
  title: 'Guardian regression suite',
  taskType: 'reasoning',
  minimumScore: 100,
  cases: [
    { id: 'scope-check', weight: 1, required: true },
    { id: 'evidence-check', weight: 1, required: true },
  ],
};
const candidateBytes = new TextEncoder().encode('candidate artifact v1');
const scopeEvidence = new TextEncoder().encode('scope assertion: passed');
const evidenceEvidence = new TextEncoder().encode('evidence assertion: passed');

async function digest(bytes) {
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map(value => value.toString(16).padStart(2, '0')).join('');
}

async function makeRun(overrides = {}) {
  return {
    id: 'run-001',
    candidateId: 'agent-aegis',
    candidateVersion: '0.4.0',
    candidateDigest: await digest(candidateBytes),
    completedAt: '2026-11-17T20:00:00.000Z',
    results: [
      { caseId: 'scope-check', status: 'passed', evidenceDigest: await digest(scopeEvidence), durationMs: 12 },
      { caseId: 'evidence-check', status: 'passed', evidenceDigest: await digest(evidenceEvidence), durationMs: 18 },
    ],
    ...overrides,
  };
}

test('verifies candidate artifact bytes and each case evidence before scoring', async () => {
  const run = await makeRun();
  const result = await verifyEvaluationRunEvidence(suite, run, {
    candidateBytes,
    evidenceByCase: {
      'scope-check': scopeEvidence,
      'evidence-check': evidenceEvidence,
    },
  });
  assert.equal(result.status, 'passed');
  assert.equal(result.scorePercent, 100);
  assert.equal(result.evidenceVerified, true);
});

test('rejects candidate bytes that do not match the declared artifact digest', async () => {
  const run = await makeRun();
  await assert.rejects(
    verifyEvaluationRunEvidence(suite, run, {
      candidateBytes: new TextEncoder().encode('different artifact'),
      evidenceByCase: { 'scope-check': scopeEvidence, 'evidence-check': evidenceEvidence },
    }),
    /candidate artifact digest/i,
  );
});

test('rejects missing or mismatched evidence bytes instead of trusting caller digests', async () => {
  const run = await makeRun();
  await assert.rejects(
    verifyEvaluationRunEvidence(suite, run, {
      candidateBytes,
      evidenceByCase: { 'scope-check': scopeEvidence },
    }),
    /missing evaluation evidence/i,
  );
  await assert.rejects(
    verifyEvaluationRunEvidence(suite, run, {
      candidateBytes,
      evidenceByCase: {
        'scope-check': new TextEncoder().encode('fabricated'),
        'evidence-check': evidenceEvidence,
      },
    }),
    /evidence digest/i,
  );
});

test('rejects unreferenced evidence payloads and malformed byte inputs', async () => {
  const run = await makeRun();
  await assert.rejects(
    verifyEvaluationRunEvidence(suite, run, {
      candidateBytes,
      evidenceByCase: {
        'scope-check': scopeEvidence,
        'evidence-check': evidenceEvidence,
        'unexpected': new TextEncoder().encode('extra'),
      },
    }),
    /unexpected evaluation evidence/i,
  );
  await assert.rejects(
    verifyEvaluationRunEvidence(suite, run, {
      candidateBytes: 'not-bytes',
      evidenceByCase: { 'scope-check': scopeEvidence, 'evidence-check': evidenceEvidence },
    }),
    /candidate artifact bytes/i,
  );
});
