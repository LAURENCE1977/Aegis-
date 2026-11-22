import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isPaidInferenceProvider,
  resolvePaidInferencePolicy,
} from '../functions/lib/paid-inference-policy.mjs';

test('recognises only explicitly supported token-billed providers as paid inference', () => {
  assert.equal(isPaidInferenceProvider('anthropic'), true);
  assert.equal(isPaidInferenceProvider('alibaba-qwen'), true);
  assert.equal(isPaidInferenceProvider('workers-ai'), false);
  assert.equal(isPaidInferenceProvider('openrouter'), false);
});

test('zero-spend lock rejects paid providers by default even when legacy approval and token ceiling are set', () => {
  assert.throws(() => resolvePaidInferencePolicy({
    AEGIS_PAID_INFERENCE_APPROVED: 'true',
    AEGIS_PAID_INFERENCE_MAX_TOKENS_PER_RUN: '5000',
    APINEX_API_KEY: 'a-valid-looking-apinex-secret',
  }, 'apinex', 'free/deepseek-v4.1-flash'), error => error.code === 'PAID_SPEND_DISABLED');
});

test('API key presence never counts as paid-inference approval', () => {
  assert.throws(() => resolvePaidInferencePolicy({
    AEGIS_ALLOW_PAID_SPEND: 'true',
    ANTHROPIC_API_KEY: 'a-valid-looking-secret-key',
    AEGIS_PAID_INFERENCE_MAX_TOKENS_PER_RUN: '5000',
  }, 'anthropic', 'claude-sonnet-4-5'), error => error.code === 'PAID_INFERENCE_NOT_APPROVED');
});

test('requires an explicit owner approval flag and a finite per-run token ceiling', () => {
  assert.throws(() => resolvePaidInferencePolicy({
    AEGIS_ALLOW_PAID_SPEND: 'true',
    AEGIS_PAID_INFERENCE_APPROVED: 'true',
  }, 'alibaba-qwen', 'qwen3.8-flash'), error => error.code === 'PAID_INFERENCE_BUDGET_NOT_CONFIGURED');
  assert.throws(() => resolvePaidInferencePolicy({
    AEGIS_ALLOW_PAID_SPEND: 'true',
    AEGIS_PAID_INFERENCE_APPROVED: 'true',
    AEGIS_PAID_INFERENCE_MAX_TOKENS_PER_RUN: 'unlimited',
  }, 'alibaba-qwen', 'qwen3.8-flash'), error => error.code === 'PAID_INFERENCE_BUDGET_NOT_CONFIGURED');
});

test('returns a bounded immutable policy only after explicit approval', () => {
  const policy = resolvePaidInferencePolicy({
    AEGIS_ALLOW_PAID_SPEND: 'true',
    AEGIS_PAID_INFERENCE_APPROVED: 'true',
    AEGIS_PAID_INFERENCE_MAX_TOKENS_PER_RUN: '5000',
  }, 'alibaba-qwen', 'qwen3.8-flash');
  assert.deepEqual(policy, {
    providerId: 'alibaba-qwen',
    modelId: 'qwen3.8-flash',
    maxTokensPerRun: 5000,
    approvalSource: 'owner-configured',
  });
  assert.equal(Object.isFrozen(policy), true);
});

test('rejects unknown providers and malformed model identifiers', () => {
  assert.throws(() => resolvePaidInferencePolicy({
    AEGIS_ALLOW_PAID_SPEND: 'true',
    AEGIS_PAID_INFERENCE_APPROVED: 'true',
    AEGIS_PAID_INFERENCE_MAX_TOKENS_PER_RUN: '5000',
  }, 'openrouter', 'model-a'), /provider/i);
  assert.throws(() => resolvePaidInferencePolicy({
    AEGIS_PAID_INFERENCE_APPROVED: 'true',
    AEGIS_PAID_INFERENCE_MAX_TOKENS_PER_RUN: '5000',
  }, 'anthropic', '../model'), /model/i);
});
test('treats APInex as a metered external provider requiring owner approval even for free-tier model IDs', () => {
  assert.equal(isPaidInferenceProvider('apinex'), true);
  assert.throws(() => resolvePaidInferencePolicy({
    AEGIS_ALLOW_PAID_SPEND: 'true',
    APINEX_API_KEY: 'a-valid-looking-apinex-secret',
    AEGIS_PAID_INFERENCE_MAX_TOKENS_PER_RUN: '5000',
  }, 'apinex', 'free/deepseek-v4.1-flash'), error => error.code === 'PAID_INFERENCE_NOT_APPROVED');
  const policy = resolvePaidInferencePolicy({
    AEGIS_ALLOW_PAID_SPEND: 'true',
    AEGIS_PAID_INFERENCE_APPROVED: 'true',
    AEGIS_PAID_INFERENCE_MAX_TOKENS_PER_RUN: '5000',
  }, 'apinex', 'free/deepseek-v4.1-flash');
  assert.equal(policy.providerId, 'apinex');
  assert.equal(policy.modelId, 'free/deepseek-v4.1-flash');
});
