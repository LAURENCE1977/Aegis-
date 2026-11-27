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

test('preserves unknown provider pricing instead of converting it to zero cost', () => {
  const input = registry();
  delete input.providers[0].models[0].inputCost;
  delete input.providers[0].models[0].outputCost;
  const [model] = listEligibleModels(input, {
    task: 'chat',
    now: '2026-11-15T19:00:00.000Z',
    maxAgeMs: 86400000,
  });
  assert.equal(model.inputCost, null);
  assert.equal(model.outputCost, null);
});
