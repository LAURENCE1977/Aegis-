function validCount(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function optionalCount(value) {
  return value === undefined || value === null ? null : validCount(value);
}

function usageRecord({
  inputTokens = null,
  outputTokens = null,
  cacheCreationInputTokens = null,
  cacheReadInputTokens = null,
  totalTokens = null,
  source,
}) {
  for (const value of [inputTokens, outputTokens, cacheCreationInputTokens, cacheReadInputTokens, totalTokens]) {
    if (value !== null && validCount(value) === null) return null;
  }
  if (inputTokens !== null && outputTokens !== null &&
      cacheCreationInputTokens !== null && cacheReadInputTokens !== null &&
      totalTokens !== null &&
      totalTokens !== inputTokens + outputTokens + cacheCreationInputTokens + cacheReadInputTokens) {
    return null;
  }
  return Object.freeze({
    inputTokens,
    outputTokens,
    cacheCreationInputTokens,
    cacheReadInputTokens,
    totalTokens,
    source,
  });
}

export function extractProviderUsage(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;

  if (payload.type === 'message_start') {
    const usage = payload.message?.usage;
    const inputTokens = validCount(usage?.input_tokens);
    if (inputTokens === null) return null;
    return usageRecord({
      inputTokens,
      cacheCreationInputTokens: optionalCount(usage.cache_creation_input_tokens),
      cacheReadInputTokens: optionalCount(usage.cache_read_input_tokens),
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

  const inputTokens = validCount(usage.prompt_tokens ?? usage.input_tokens);
  const outputTokens = validCount(usage.completion_tokens ?? usage.output_tokens);
  const totalTokens = validCount(usage.total_tokens);

  if (inputTokens === null || outputTokens === null) return null;
  return usageRecord({
    inputTokens,
    outputTokens,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
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
  const cacheCreationInputTokens = incoming.cacheCreationInputTokens ?? current.cacheCreationInputTokens;
  const cacheReadInputTokens = incoming.cacheReadInputTokens ?? current.cacheReadInputTokens;
  const complete = inputTokens !== null && outputTokens !== null &&
    cacheCreationInputTokens !== null && cacheReadInputTokens !== null;
  const totalTokens = complete
    ? inputTokens + outputTokens + cacheCreationInputTokens + cacheReadInputTokens
    : incoming.totalTokens ?? current.totalTokens;

  const merged = usageRecord({
    inputTokens,
    outputTokens,
    cacheCreationInputTokens,
    cacheReadInputTokens,
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
    validCount(usage.cacheCreationInputTokens) !== null &&
    validCount(usage.cacheReadInputTokens) !== null &&
    validCount(usage.totalTokens) !== null &&
    usage.totalTokens === usage.inputTokens + usage.outputTokens +
      usage.cacheCreationInputTokens + usage.cacheReadInputTokens &&
    ['anthropic', 'openai-compatible'].includes(usage.source));
}


/** Sum complete usage from separate provider requests within one AG-UI run. */
export function addProviderUsage(current, incoming) {
  if (!isCompleteProviderUsage(current) || !isCompleteProviderUsage(incoming)) {
    throw new TypeError('Only complete provider usage can be accumulated');
  }
  if (current.source !== incoming.source) {
    throw new TypeError('Provider usage source mismatch');
  }
  const combined = usageRecord({
    inputTokens: current.inputTokens + incoming.inputTokens,
    outputTokens: current.outputTokens + incoming.outputTokens,
    cacheCreationInputTokens: current.cacheCreationInputTokens + incoming.cacheCreationInputTokens,
    cacheReadInputTokens: current.cacheReadInputTokens + incoming.cacheReadInputTokens,
    totalTokens: current.totalTokens + incoming.totalTokens,
    source: current.source,
  });
  if (!combined || !isCompleteProviderUsage(combined)) {
    throw new RangeError('Accumulated provider usage exceeds safe limits');
  }
  return combined;
}
