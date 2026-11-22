import test from 'node:test';
import assert from 'node:assert/strict';
import {
  estimateTokenCount,
  selectModelRoute,
  fitMessagesToContext,
} from '../functions/lib/intelligence-engine.mjs';

const models = [
  { id: 'cheap-small', providerId: 'provider-a', contextTokens: 8192, maxOutputTokens: 1024, inputCost: 0, outputCost: 0, priority: 1 },
  { id: 'strong-large', providerId: 'provider-b', contextTokens: 1000000, maxOutputTokens: 8192, inputCost: 0, outputCost: 0, priority: 2 },
];

test('estimates token count conservatively for ordinary text', () => {
  assert.equal(estimateTokenCount('abcd'.repeat(10)), 10);
  assert.equal(estimateTokenCount(''), 0);
  assert.throws(() => estimateTokenCount(42), /text/i);
});

test('routes simple jobs to the smallest eligible model and large context jobs to a large-context model', () => {
  const simple = selectModelRoute({ models, task: 'simple', estimatedInputTokens: 1000, requestedOutputTokens: 500 });
  assert.equal(simple.modelId, 'cheap-small');
  const large = selectModelRoute({ models, task: 'research', estimatedInputTokens: 20000, requestedOutputTokens: 1000 });
  assert.equal(large.modelId, 'strong-large');
});

test('excludes unavailable or quota-exhausted providers and fails closed when none qualify', () => {
  const route = selectModelRoute({
    models,
    task: 'simple',
    estimatedInputTokens: 100,
    requestedOutputTokens: 100,
    providerState: { 'provider-a': { enabled: true, remainingTokens: 0 }, 'provider-b': { enabled: true, remainingTokens: 10000 } },
  });
  assert.equal(route.modelId, 'strong-large');
  assert.throws(() => selectModelRoute({
    models,
    task: 'simple',
    estimatedInputTokens: 100,
    requestedOutputTokens: 100,
    providerState: { 'provider-a': { enabled: false }, 'provider-b': { enabled: false } },
  }), /no eligible/i);
});

test('rejects requests exceeding every model context window', () => {
  assert.throws(() => selectModelRoute({ models, task: 'research', estimatedInputTokens: 1000001, requestedOutputTokens: 1000 }), /context/i);
});

test('fits messages within an input budget without splitting messages or dropping the system instruction', () => {
  const messages = [
    { role: 'system', content: 'system rules' },
    { role: 'user', content: 'old question '.repeat(200) },
    { role: 'assistant', content: 'old answer '.repeat(200) },
    { role: 'user', content: 'latest question' },
  ];
  const fitted = fitMessagesToContext(messages, 20);
  assert.equal(fitted[0].role, 'system');
  assert.equal(fitted.at(-1).content, 'latest question');
  assert.ok(fitted.reduce((sum, item) => sum + estimateTokenCount(item.content), 0) <= 20);
});

test('rejects malformed model catalogues and message lists', () => {
  assert.throws(() => selectModelRoute({ models: [{ id: 'bad' }], task: 'simple', estimatedInputTokens: 1, requestedOutputTokens: 1 }), /model/i);
  assert.throws(() => fitMessagesToContext([{ role: 'tool', content: 'x' }], 10), /message/i);
});

test('free-only routing excludes paid models even when their price or priority is attractive', () => {
  const mixed = [
    { id: 'free', providerId: 'free-provider', contextTokens: 8192, maxOutputTokens: 1024, inputCost: 0, outputCost: 0, priority: 20 },
    { id: 'paid', providerId: 'paid-provider', contextTokens: 8192, maxOutputTokens: 1024, inputCost: 0.000001, outputCost: 0.000001, priority: 1 },
  ];
  const route = selectModelRoute({
    models: mixed, task: 'chat', estimatedInputTokens: 100, requestedOutputTokens: 100,
    costMode: 'free-only',
  });
  assert.equal(route.modelId, 'free');
});

test('free-only routing treats missing cost metadata as unknown rather than free', () => {
  const unknown = [{
    id: 'unknown-cost', providerId: 'provider-a',
    contextTokens: 8192, maxOutputTokens: 1024, priority: 1,
  }];
  assert.throws(() => selectModelRoute({
    models: unknown, task: 'chat', estimatedInputTokens: 100, requestedOutputTokens: 100,
    costMode: 'free-only',
  }), /no eligible/i);
});

test('paid routing requires allow-paid mode and explicit provider approval', () => {
  const paid = [{
    id: 'paid', providerId: 'paid-provider',
    contextTokens: 8192, maxOutputTokens: 1024,
    inputCost: 0.000001, outputCost: 0.000002, priority: 1,
  }];
  const request = {
    models: paid, task: 'chat', estimatedInputTokens: 100, requestedOutputTokens: 100,
    costMode: 'allow-paid',
  };
  assert.throws(() => selectModelRoute(request), /no eligible/i);
  assert.throws(() => selectModelRoute({
    ...request,
    providerState: { 'paid-provider': { enabled: true, remainingTokens: 1000, paidFallbackApproved: false } },
  }), /no eligible/i);
  assert.equal(selectModelRoute({
    ...request,
    providerState: { 'paid-provider': { enabled: true, remainingTokens: 1000, paidFallbackApproved: true } },
  }).modelId, 'paid');
});

test('free-only routing stops at exhausted free quota and never falls through to paid', () => {
  const mixed = [
    { id: 'free', providerId: 'free-provider', contextTokens: 8192, maxOutputTokens: 1024, inputCost: 0, outputCost: 0, priority: 1 },
    { id: 'paid', providerId: 'paid-provider', contextTokens: 8192, maxOutputTokens: 1024, inputCost: 0.000001, outputCost: 0.000001, priority: 2 },
  ];
  assert.throws(() => selectModelRoute({
    models: mixed, task: 'chat', estimatedInputTokens: 100, requestedOutputTokens: 100,
    costMode: 'free-only',
    providerState: { 'free-provider': { enabled: true, remainingTokens: 0 }, 'paid-provider': { enabled: true, remainingTokens: 1000, paidFallbackApproved: true } },
  }), /no eligible/i);
});
