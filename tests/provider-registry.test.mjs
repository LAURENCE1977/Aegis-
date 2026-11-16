import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProviderRegistry, listEligibleModels } from '../functions/lib/provider-registry.mjs';

const registry = () => ({
  version: 1,
  providers: [{
    id: 'provider-a',
    adapterId: 'workers-ai',
    displayName: 'Workers AI',
    status: 'enabled',
    termsUrl: 'https://developers.cloudflare.com/workers-ai/',
    verifiedAt: '2026-11-15T18:00:00.000Z',
    models: [{
      id: 'model-a',
      contextTokens: 8192,
      maxOutputTokens: 1024,
      tasks: ['chat', 'simple'],
      inputCost: 0,
      outputCost: 0,
    }],
  }],
});

test('accepts a verified provider catalogue with fixed adapter identifiers', () => {
  const result = validateProviderRegistry(registry());
  assert.equal(result.providers[0].adapterId, 'workers-ai');
  assert.equal(result.providers[0].models[0].contextTokens, 8192);
});

test('rejects arbitrary endpoint and credential fields in catalogue entries', () => {
  const input = registry();
  input.providers[0].endpoint = 'https://attacker.example';
  assert.throws(() => validateProviderRegistry(input), /fields/i);
  const second = registry();
  second.providers[0].apiKey = 'secret';
  assert.throws(() => validateProviderRegistry(second), /fields/i);
});

test('rejects unverified, stale-format or insecure provenance metadata', () => {
  const missing = registry();
  delete missing.providers[0].termsUrl;
  assert.throws(() => validateProviderRegistry(missing), /terms/i);
  const http = registry();
  http.providers[0].termsUrl = 'http://example.com/terms';
  assert.throws(() => validateProviderRegistry(http), /https/i);
  const badDate = registry();
  badDate.providers[0].verifiedAt = 'yesterday';
  assert.throws(() => validateProviderRegistry(badDate), /verified/i);
});

test('rejects duplicate provider/model IDs and invalid model capabilities', () => {
  const duplicate = registry();
  duplicate.providers.push({ ...duplicate.providers[0] });
  assert.throws(() => validateProviderRegistry(duplicate), /duplicate/i);
  const badModel = registry();
  badModel.providers[0].models[0].contextTokens = -1;
  assert.throws(() => validateProviderRegistry(badModel), /context/i);
});

test('lists only enabled models with supported task and a recent verification', () => {
  const input = registry();
  input.providers.push({
    id: 'provider-b', adapterId: 'future-adapter', displayName: 'Future',
    status: 'disabled', termsUrl: 'https://example.com/terms',
    verifiedAt: '2026-11-15T18:00:00.000Z',
    models: [{ id: 'model-b', contextTokens: 1000000, maxOutputTokens: 1000, tasks: ['research'] }],
  });
  const result = listEligibleModels(input, { task: 'chat', now: '2026-11-15T19:00:00.000Z', maxAgeMs: 86400000 });
  assert.deepEqual(result.map(model => model.id), ['model-a']);
});

test('fails closed for stale verification and malformed catalogue structure', () => {
  const stale = registry();
  assert.deepEqual(listEligibleModels(stale, {
    task: 'chat', now: '2026-11-20T19:00:00.000Z', maxAgeMs: 86400000,
  }), []);
  assert.throws(() => validateProviderRegistry({ version: 1, providers: [] }), /providers/i);
});

test('ranks eligible models by explicit provider preference, then known cost and stable ID', async () => {
  const { rankEligibleModels } = await import('../functions/lib/provider-registry.mjs');
  const input = registry();
  input.providers[0].models[0].inputCost = 0.2;
  input.providers[0].models[0].outputCost = 0.4;
  input.providers.push({
    id: 'provider-b', adapterId: 'adapter-b', displayName: 'Provider B',
    status: 'enabled', termsUrl: 'https://example.com/terms',
    verifiedAt: '2026-11-15T18:00:00.000Z',
    models: [
      { id: 'model-b', contextTokens: 32000, maxOutputTokens: 2048, tasks: ['chat'], inputCost: 0.1, outputCost: 0.2 },
      { id: 'model-c', contextTokens: 64000, maxOutputTokens: 4096, tasks: ['chat'] },
    ],
  });
  const ranked = rankEligibleModels(input, {
    task: 'chat',
    now: '2026-11-15T19:00:00.000Z',
    preferredProviderIds: ['provider-a'],
  });
  assert.deepEqual(ranked.map(model => model.id), ['model-a', 'model-b', 'model-c']);
  assert.equal(ranked[2].costKnown, false);
});

test('filters candidates by context, output and maximum cost without treating unknown prices as free', async () => {
  const { rankEligibleModels } = await import('../functions/lib/provider-registry.mjs');
  const input = registry();
  input.providers[0].models[0].inputCost = 0.2;
  input.providers[0].models[0].outputCost = 0.4;
  input.providers.push({
    id: 'provider-b', adapterId: 'adapter-b', displayName: 'Provider B',
    status: 'enabled', termsUrl: 'https://example.com/terms',
    verifiedAt: '2026-11-15T18:00:00.000Z',
    models: [
      { id: 'model-b', contextTokens: 32000, maxOutputTokens: 2048, tasks: ['chat'], inputCost: 0.1, outputCost: 0.2 },
      { id: 'model-c', contextTokens: 64000, maxOutputTokens: 4096, tasks: ['chat'] },
    ],
  });
  const ranked = rankEligibleModels(input, {
    task: 'chat',
    now: '2026-11-15T19:00:00.000Z',
    requiredContextTokens: 16000,
    requiredOutputTokens: 1500,
    maxInputCost: 0.15,
    maxOutputCost: 0.25,
  });
  assert.deepEqual(ranked.map(model => model.id), ['model-b']);
});

test('rejects invalid routing constraints instead of silently widening eligibility', async () => {
  const { rankEligibleModels } = await import('../functions/lib/provider-registry.mjs');
  assert.throws(() => rankEligibleModels(registry(), {
    task: 'chat', now: '2026-11-15T19:00:00.000Z', requiredContextTokens: -1,
  }), /context/i);
});


test('preserves unknown provider prices as unknown instead of exposing false zero-cost values', () => {
  const input = registry();
  input.providers[0].models[0].inputCost = undefined;
  input.providers[0].models[0].outputCost = undefined;
  const [model] = listEligibleModels(input, {
    task: 'chat',
    now: '2026-11-15T19:00:00.000Z',
  });
  assert.equal(model.costKnown, false);
  assert.equal(model.inputCost, undefined);
  assert.equal(model.outputCost, undefined);
});
