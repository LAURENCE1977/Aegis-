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

test('API key presence never counts as paid-inference approval', () => {
  assert.throws(() => resolvePaidInferencePolicy({
    ANTHROPIC_API_KEY: 'a-valid-looking-secret-key',
    AEGIS_PAID_INFERENCE_MAX_TOKENS_PER_RUN: '5000',
  }, 'anthropic', 'claude-sonnet-4-5'), error => error.code === 'PAID_INFERENCE_NOT_APPROVED');
});

test('requires an explicit owner approval flag and a finite per-run token ceiling', () => {
  assert.throws(() => resolvePaidInferencePolicy({
    AEGIS_PAID_INFERENCE_APPROVED: 'true',
  }, 'alibaba-qwen', 'qwen3.8-flash'), error => error.code === 'PAID_INFERENCE_BUDGET_NOT_CONFIGURED');
  assert.throws(() => resolvePaidInferencePolicy({
    AEGIS_PAID_INFERENCE_APPROVED: 'true',
    AEGIS_PAID_INFERENCE_MAX_TOKENS_PER_RUN: 'unlimited',
  }, 'alibaba-qwen', 'qwen3.8-flash'), error => error.code === 'PAID_INFERENCE_BUDGET_NOT_CONFIGURED');
});

test('returns a bounded immutable policy only after explicit approval', () => {
  const policy = resolvePaidInferencePolicy({
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
    AEGIS_PAID_INFERENCE_APPROVED: 'true',
    AEGIS_PAID_INFERENCE_MAX_TOKENS_PER_RUN: '5000',
  }, 'openrouter', 'model-a'), /provider/i);
  assert.throws(() => resolvePaidInferencePolicy({
    AEGIS_PAID_INFERENCE_APPROVED: 'true',
    AEGIS_PAID_INFERENCE_MAX_TOKENS_PER_RUN: '5000',
  }, 'anthropic', '../model'), /model/i);
});
