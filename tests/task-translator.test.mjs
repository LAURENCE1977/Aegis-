import test from 'node:test';
import assert from 'node:assert/strict';
import { translateTask } from '../functions/lib/intelligence-engine.mjs';

test('explicit task type takes precedence over lexical hints', () => {
  const result = translateTask({
    objective: 'Research how to calculate the cheapest migration path',
    explicitType: 'research',
  });
  assert.equal(result.task, 'research');
  assert.equal(result.classificationSource, 'explicit');
  assert.equal(result.routeStrategy, 'model_candidate');
});

test('routes clearly deterministic requests before considering generative models', () => {
  const result = translateTask({ objective: 'Calculate the sum of 18 and 24' });
  assert.equal(result.task, 'simple');
  assert.equal(result.routeStrategy, 'deterministic_first');
  assert.equal(result.modelRequired, false);
});

test('classifies clear coding and research requests from bounded lexical evidence', () => {
  assert.equal(translateTask({ objective: 'Debug this JavaScript function' }).task, 'coding');
  assert.equal(translateTask({ objective: 'Research recent approaches to local inference' }).task, 'research');
});

test('does not guess when there is no signal or equally strong conflicting signals', () => {
  for (const objective of [
    'Help me with this',
    'Research and calculate the answer',
  ]) {
    const result = translateTask({ objective });
    assert.equal(result.task, 'unknown');
    assert.equal(result.routeStrategy, 'clarify');
    assert.equal(result.modelRequired, null);
  }
});

test('returns honest input sizing without inventing CPU, memory or latency estimates', () => {
  const result = translateTask({
    objective: 'Summarise this report',
    requestedOutputTokens: 300,
  });
  assert.equal(result.resources.inputBytes, Buffer.byteLength('Summarise this report', 'utf8'));
  assert.ok(result.resources.estimatedInputTokens >= 1);
  assert.equal(result.resources.requestedOutputTokens, 300);
  assert.equal(result.resources.cpuEstimate, null);
  assert.equal(result.resources.memoryEstimateBytes, null);
  assert.equal(result.resources.latencyEstimateMs, null);
});

test('rejects malformed input, unsupported explicit task types and unknown fields', () => {
  for (const input of [
    null,
    {},
    { objective: '   ' },
    { objective: 'x'.repeat(2001) },
    { objective: 'Review code', explicitType: 'admin' },
    { objective: 'Review code', requestedOutputTokens: 0 },
    { objective: 'Review code', execute: true },
  ]) assert.throws(() => translateTask(input));
});

test('returns an immutable plan-only translation with evidence for its classification', () => {
  const result = translateTask({ objective: 'Debug the failing TypeScript test suite' });
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.evidence), true);
  assert.ok(result.evidence.length > 0);
  assert.equal(result.execution, 'not_authorised');
  assert.equal(result.toolsInvoked, false);
});
