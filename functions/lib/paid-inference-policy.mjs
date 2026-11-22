const PAID_TOKEN_PROVIDERS = new Set(['anthropic', 'alibaba-qwen']);
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const MAX_TOKENS_PER_RUN = 100000;

export function isPaidInferenceProvider(providerId) {
  return PAID_TOKEN_PROVIDERS.has(providerId);
}

function policyError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

/**
 * Resolve an owner-controlled paid-inference ceiling.
 * A configured API key is never treated as spending approval.
 */
export function resolvePaidInferencePolicy(env, providerId, modelId) {
  if (!env || typeof env !== 'object' || Array.isArray(env)) {
    throw new TypeError('Paid inference environment is required');
  }
  if (!isPaidInferenceProvider(providerId)) {
    throw new TypeError('Unsupported paid inference provider');
  }
  if (typeof modelId !== 'string' || !ID.test(modelId)) {
    throw new TypeError('Invalid paid inference model identifier');
  }
  if (env.AEGIS_PAID_INFERENCE_APPROVED !== 'true') {
    throw policyError(
      'PAID_INFERENCE_NOT_APPROVED',
      'Paid inference has not been explicitly approved by the owner.',
    );
  }
  const rawLimit = env.AEGIS_PAID_INFERENCE_MAX_TOKENS_PER_RUN;
  if (typeof rawLimit !== 'string' || !/^[1-9][0-9]{0,5}$/.test(rawLimit)) {
    throw policyError(
      'PAID_INFERENCE_BUDGET_NOT_CONFIGURED',
      'A finite per-run paid-inference token ceiling is required.',
    );
  }
  const maxTokensPerRun = Number(rawLimit);
  if (!Number.isSafeInteger(maxTokensPerRun) || maxTokensPerRun > MAX_TOKENS_PER_RUN) {
    throw policyError(
      'PAID_INFERENCE_BUDGET_NOT_CONFIGURED',
      'The per-run paid-inference token ceiling is outside the supported range.',
    );
  }
  return Object.freeze({
    providerId,
    modelId,
    maxTokensPerRun,
    approvalSource: 'owner-configured',
  });
}
