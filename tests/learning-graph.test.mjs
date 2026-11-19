import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateLearningPath,
  buildLearningSequence,
  getAvailableLearningConcepts,
} from '../functions/lib/learning-graph.mjs';

const path = {
  schemaVersion: 1,
  id: 'intro-to-secure-systems',
  title: 'Introduction to Secure Systems',
  description: 'A small, source-attributed learning path.',
  concepts: [
    { id: 'threat-models', title: 'Threat models', prerequisites: [], outcomes: ['Identify assets and trust boundaries.'] },
    { id: 'least-privilege', title: 'Least privilege', prerequisites: ['threat-models'], outcomes: ['Constrain authority to a task.'] },
    { id: 'audit-evidence', title: 'Audit evidence', prerequisites: ['least-privilege'], outcomes: ['Record reproducible evidence.'] },
    { id: 'risk-review', title: 'Risk review', prerequisites: ['threat-models'], outcomes: ['Explain residual risk.'] },
  ],
  activities: [
    { id: 'draw-boundaries', conceptId: 'threat-models', kind: 'exercise', sourceUrl: 'https://example.org/security-basics', evidenceRequired: true },
  ],
};

test('accepts a bounded learning path with explicit outcomes and attributed activities', () => {
  assert.equal(validateLearningPath(path), true);
});

test('rejects duplicate concepts and duplicate prerequisite edges', () => {
  assert.throws(() => validateLearningPath({ ...path, concepts: [...path.concepts, path.concepts[0]] }), /duplicate concept/i);
  assert.throws(() => validateLearningPath({
    ...path,
    concepts: path.concepts.map((concept) => concept.id === 'least-privilege'
      ? { ...concept, prerequisites: ['threat-models', 'threat-models'] } : concept),
  }), /duplicate prerequisite/i);
});

test('rejects missing, self-referential and cyclic prerequisites', () => {
  assert.throws(() => validateLearningPath({
    ...path,
    concepts: path.concepts.map((concept) => concept.id === 'least-privilege'
      ? { ...concept, prerequisites: ['missing-concept'] } : concept),
  }), /unknown prerequisite/i);
  assert.throws(() => validateLearningPath({
    ...path,
    concepts: path.concepts.map((concept) => concept.id === 'threat-models'
      ? { ...concept, prerequisites: ['threat-models'] } : concept),
  }), /cannot depend on itself/i);
  assert.throws(() => validateLearningPath({
    ...path,
    concepts: path.concepts.map((concept) => concept.id === 'threat-models'
      ? { ...concept, prerequisites: ['audit-evidence'] } : concept),
  }), /cycle/i);
});

test('rejects untrusted or malformed activity source URLs and unknown concept references', () => {
  assert.throws(() => validateLearningPath({
    ...path,
    activities: [{ ...path.activities[0], sourceUrl: 'javascript:alert(1)' }],
  }), /HTTPS/i);
  assert.throws(() => validateLearningPath({
    ...path,
    activities: [{ ...path.activities[0], conceptId: 'not-a-concept' }],
  }), /unknown concept/i);
});

test('builds a deterministic prerequisite-first sequence without changing source records', () => {
  const original = structuredClone(path);
  assert.deepEqual(buildLearningSequence(path), [
    'threat-models', 'least-privilege', 'audit-evidence', 'risk-review',
  ]);
  assert.deepEqual(path, original);
});

test('only exposes incomplete concepts whose prerequisites are complete', () => {
  assert.deepEqual(getAvailableLearningConcepts(path, []), ['threat-models']);
  assert.deepEqual(getAvailableLearningConcepts(path, ['threat-models']), ['least-privilege', 'risk-review']);
  assert.deepEqual(getAvailableLearningConcepts(path, ['threat-models', 'least-privilege']), ['audit-evidence', 'risk-review']);
});

test('rejects unknown completion claims instead of silently accepting them', () => {
  assert.throws(() => getAvailableLearningConcepts(path, ['invented-concept']), /unknown completed concept/i);
});

test('rejects oversized paths and unsafe text fields', () => {
  assert.throws(() => validateLearningPath({ ...path, title: 'x'.repeat(201) }), /title/i);
  assert.throws(() => validateLearningPath({
    ...path,
    concepts: path.concepts.map((concept) => concept.id === 'threat-models'
      ? { ...concept, outcomes: ['hidden\ncontrol'] } : concept),
  }), /outcome/i);
});
