import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProviderRegistry, listEligibleModels, isSupportedProviderAdapter } from '../functions/lib/provider-registry.mjs';

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
      sourceUrl: 'https://developers.cloudflare.com/workers-ai/models/',
      verifiedAt: '2026-11-15T18:00:00.000Z',
      contextTokens: 8192,
      maxOutputTokens: 1024,
      tasks: ['chat', 'simple'],
      inputCost: 0,
      outputCost: 0,
    }],
  }],
});

test('exposes one canonical server-owned adapter allowlist for runtime routing', () => {
  assert.equal(isSupportedProviderAdapter('workers-ai'), true);
  assert.equal(isSupportedProviderAdapter('anthropic'), true);
  assert.equal(isSupportedProviderAdapter('alibaba-qwen'), true);
  assert.equal(isSupportedProviderAdapter('attacker-controlled-adapter'), false);
  assert.equal(isSupportedProviderAdapter('https://attacker.example'), false);
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

test('requires HTTPS source provenance and a canonical verification timestamp per model', () => {
  const missing = registry();
  delete missing.providers[0].models[0].sourceUrl;
  assert.throws(() => validateProviderRegistry(missing), /source/i);
  const insecure = registry();
  insecure.providers[0].models[0].sourceUrl = 'http://example.com/model';
  assert.throws(() => validateProviderRegistry(insecure), /https/i);
  const badDate = registry();
  badDate.providers[0].models[0].verifiedAt = 'last week';
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
    id: 'provider-b', adapterId: 'workers-ai', displayName: 'Future',
    status: 'disabled', termsUrl: 'https://example.com/terms',
    verifiedAt: '2026-11-15T18:00:00.000Z',
    models: [{
      id: 'model-b', sourceUrl: 'https://example.com/model-b',
      verifiedAt: '2026-11-15T18:00:00.000Z',
      contextTokens: 1000000, maxOutputTokens: 1000, tasks: ['research'],
    }],
  });
  const result = listEligibleModels(input, { task: 'chat', now: '2026-11-15T19:00:00.000Z', maxAgeMs: 86400000 });
  assert.deepEqual(result.map(model => model.id), ['model-a']);
});

test('rejects adapter identifiers that are not in the server-owned adapter allowlist', () => {
  const input = registry();
  input.providers[0].adapterId = 'attacker-controlled-adapter';
  assert.throws(() => validateProviderRegistry(input), /adapter/i);
});

test('fails closed for stale verification and malformed catalogue structure', () => {
  const stale = registry();
  assert.deepEqual(listEligibleModels(stale, {
    task: 'chat', now: '2026-11-20T19:00:00.000Z', maxAgeMs: 86400000,
  }), []);
  assert.throws(() => validateProviderRegistry({ version: 1, providers: [] }), /providers/i);
});

test('excludes a model with stale model-specific evidence even when its provider record is fresh', () => {
  const input = registry();
  input.providers[0].verifiedAt = '2026-11-15T18:30:00.000Z';
  input.providers[0].models[0].verifiedAt = '2026-11-14T18:00:00.000Z';
  assert.deepEqual(listEligibleModels(input, {
    task: 'chat', now: '2026-11-15T19:00:00.000Z', maxAgeMs: 86400000,
  }), []);
});

test('preserves unknown provider pricing as null rather than reporting it as free', () => {
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

test('preserves explicitly verified zero pricing as zero', () => {
  const [model] = listEligibleModels(registry(), {
    task: 'chat',
    now: '2026-11-15T19:00:00.000Z',
    maxAgeMs: 86400000,
  });
  assert.equal(model.inputCost, 0);
  assert.equal(model.outputCost, 0);
});


test('keeps internal catalogue IDs separate from native provider model IDs', () => {
  const input = registry();
  input.providers[0].models[0].providerModelId = '@cf/meta/llama-3.3-70b-instruct';
  const [model] = listEligibleModels(input, {
    task: 'chat', now: '2026-11-15T19:00:00.000Z', maxAgeMs: 86400000,
  });
  assert.equal(model.id, 'model-a');
  assert.equal(model.providerModelId, '@cf/meta/llama-3.3-70b-instruct');
});

test('rejects malformed native provider model identifiers', () => {
  const input = registry();
  input.providers[0].models[0].providerModelId = 'https://attacker.example/model';
  assert.throws(() => validateProviderRegistry(input), /provider model/i);
});
