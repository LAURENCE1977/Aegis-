import test from 'node:test';
import assert from 'node:assert/strict';
import { accountWorkload } from '../functions/lib/intelligence-engine.mjs';

test('accounts for all supplied messages and a separately reserved output budget', () => {
  const messages = [
    { role: 'system', content: 'Be accurate.' },
    { role: 'user', content: 'Explain deterministic routing.' },
  ];
  const result = accountWorkload({ messages, requestedOutputTokens: 250 });
  const bytes = messages.reduce((sum, item) => sum + Buffer.byteLength(item.content, 'utf8'), 0);
  const inputTokens = messages.reduce((sum, item) => sum + 4 + Math.ceil(Buffer.byteLength(item.content, 'utf8') / 4), 0);
  assert.equal(result.inputBytes, bytes);
  assert.equal(result.estimatedInputTokens, inputTokens);
  assert.equal(result.requestedOutputTokens, 250);
  assert.equal(result.estimatedTotalTokens, inputTokens + 250);
  assert.equal(result.messageCount, 2);
});

test('reports heuristic estimates honestly and never invents actual usage or financial cost', () => {
  const result = accountWorkload({
    messages: [{ role: 'user', content: 'Calculate 2 + 2.' }],
    requestedOutputTokens: 50,
  });
  assert.equal(result.estimationMethod, 'utf8_bytes_div_4_plus_4_per_message');
  assert.equal(result.providerTokenizerVerified, false);
  assert.equal(result.actualUsage, null);
  assert.equal(result.estimatedCost, null);
  assert.equal(result.cpuEstimate, null);
  assert.equal(result.memoryEstimateBytes, null);
  assert.equal(result.latencyEstimateMs, null);
});

test('reports whether the estimated input fits an optional input budget', () => {
  const messages = [{ role: 'user', content: 'A short request.' }];
  const estimate = accountWorkload({ messages, requestedOutputTokens: 10 });
  assert.equal(accountWorkload({
    messages, requestedOutputTokens: 10,
    maxInputTokens: estimate.estimatedInputTokens,
  }).withinInputBudget, true);
  assert.equal(accountWorkload({
    messages, requestedOutputTokens: 10,
    maxInputTokens: estimate.estimatedInputTokens - 1,
  }).withinInputBudget, false);
});

test('rejects malformed messages, accessors, oversized payloads and unknown fields', () => {
  const getterMessage = {};
  Object.defineProperty(getterMessage, 'role', { get() { throw new Error('must not run'); } });
  for (const input of [
    null,
    {},
    { messages: [] },
    { messages: [{ role: 'tool', content: 'x' }] },
    { messages: [{ role: 'user', content: '   ' }] },
    { messages: [getterMessage] },
    { messages: [{ role: 'user', content: 'x' }], requestedOutputTokens: 0 },
    { messages: [{ role: 'user', content: 'x' }], maxInputTokens: 0 },
    { messages: [{ role: 'user', content: 'x' }], execute: true },
    { messages: [{ role: 'user', content: 'x'.repeat(1000001) }] },
  ]) assert.throws(() => accountWorkload(input));
});

test('returns a deeply immutable plan-only account', () => {
  const result = accountWorkload({
    messages: [{ role: 'user', content: 'Plan this task.' }],
    requestedOutputTokens: 100,
  });
  assert.equal(Object.isFrozen(result), true);
  assert.equal(result.execution, 'not_authorised');
  assert.equal(result.toolsInvoked, false);
});
