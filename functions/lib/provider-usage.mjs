function validCount(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function usageRecord({ inputTokens = null, outputTokens = null, totalTokens = null, source }) {
  if (inputTokens !== null && validCount(inputTokens) === null) return null;
  if (outputTokens !== null && validCount(outputTokens) === null) return null;
  if (totalTokens !== null && validCount(totalTokens) === null) return null;
  if (inputTokens !== null && outputTokens !== null &&
      totalTokens !== null && totalTokens !== inputTokens + outputTokens) return null;
  return Object.freeze({ inputTokens, outputTokens, totalTokens, source });
}

export function extractProviderUsage(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;

  if (payload.type === 'message_start') {
    const inputTokens = validCount(payload.message?.usage?.input_tokens);
    return inputTokens === null ? null : usageRecord({
      inputTokens,
      source: 'anthropic',
    });
  }

  if (payload.type === 'message_delta') {
    const outputTokens = validCount(payload.usage?.output_tokens);
    return outputTokens === null ? null : usageRecord({
      outputTokens,
      source: 'anthropic',
    });
  }

  const usage = payload.usage;
  if (!usage || typeof usage !== 'object' || Array.isArray(usage)) return null;

  const inputTokens = validCount(
    usage.prompt_tokens ?? usage.input_tokens,
  );
  const outputTokens = validCount(
    usage.completion_tokens ?? usage.output_tokens,
  );
  const totalTokens = validCount(usage.total_tokens);

  if (inputTokens === null || outputTokens === null) return null;
  return usageRecord({
    inputTokens,
    outputTokens,
    totalTokens: totalTokens ?? inputTokens + outputTokens,
    source: 'openai-compatible',
  });
}

export function mergeProviderUsage(current, incoming) {
  if (current === null || current === undefined) return incoming;
  if (incoming === null || incoming === undefined) return current;
  if (!current || !incoming || current.source !== incoming.source) {
    throw new TypeError('Provider usage source mismatch');
  }

  const inputTokens = incoming.inputTokens ?? current.inputTokens;
  const outputTokens = incoming.outputTokens ?? current.outputTokens;
  const totalTokens = inputTokens !== null && outputTokens !== null
    ? inputTokens + outputTokens
    : incoming.totalTokens ?? current.totalTokens;

  const merged = usageRecord({
    inputTokens,
    outputTokens,
    totalTokens,
    source: current.source,
  });
  if (!merged) throw new TypeError('Invalid merged provider usage');
  return merged;
}

export function isCompleteProviderUsage(usage) {
  return Boolean(usage &&
    validCount(usage.inputTokens) !== null &&
    validCount(usage.outputTokens) !== null &&
    validCount(usage.totalTokens) !== null &&
    usage.totalTokens === usage.inputTokens + usage.outputTokens &&
    ['anthropic', 'openai-compatible'].includes(usage.source));
}
