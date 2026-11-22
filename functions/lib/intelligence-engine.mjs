const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const TASKS = new Set(['simple', 'chat', 'coding', 'research', 'reasoning']);

function requirePositiveInteger(value, label, { allowZero = false } = {}) {
  if (!Number.isSafeInteger(value) || value < (allowZero ? 0 : 1)) {
    throw new TypeError('Invalid ' + label);
  }
}

function validateModels(models) {
  if (!Array.isArray(models) || models.length < 1 || models.length > 500) {
    throw new TypeError('Invalid model catalogue');
  }
  const ids = new Set();
  for (const model of models) {
    if (!model || typeof model !== 'object' || Array.isArray(model) ||
        typeof model.id !== 'string' || !ID_PATTERN.test(model.id) ||
        typeof model.providerId !== 'string' || !ID_PATTERN.test(model.providerId) ||
        ids.has(model.id)) {
      throw new TypeError('Invalid model catalogue entry');
    }
    requirePositiveInteger(model.contextTokens, 'model context window');
    requirePositiveInteger(model.maxOutputTokens, 'model output limit');
    requirePositiveInteger(model.priority ?? 100, 'model priority');
    for (const key of ['inputCost', 'outputCost']) {
      const value = model[key] ?? 0;
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        throw new TypeError('Invalid model cost');
      }
    }
    if (model.tasks !== undefined &&
        (!Array.isArray(model.tasks) || model.tasks.length === 0 ||
         model.tasks.some(task => !TASKS.has(task)))) {
      throw new TypeError('Invalid model task capabilities');
    }
    ids.add(model.id);
  }
}

export function estimateTokenCount(text) {
  if (typeof text !== 'string') throw new TypeError('Token estimation requires text');
  if (!text.length) return 0;
  // A deliberately conservative planning heuristic, not a provider tokenizer.
  return Math.ceil(new TextEncoder().encode(text).byteLength / 4);
}

export function selectModelRoute({
  models,
  task,
  estimatedInputTokens,
  requestedOutputTokens,
  providerState,
  costMode = 'free-only',
}) {
  validateModels(models);
  if (!['free-only', 'allow-paid'].includes(costMode)) {
    throw new TypeError('Invalid model cost mode');
  }
  if (!TASKS.has(task)) throw new TypeError('Invalid model task');
  requirePositiveInteger(estimatedInputTokens, 'estimated input tokens', { allowZero: true });
  requirePositiveInteger(requestedOutputTokens, 'requested output tokens');
  if (providerState !== undefined &&
      (!providerState || typeof providerState !== 'object' || Array.isArray(providerState))) {
    throw new TypeError('Invalid provider state');
  }

  const eligible = models.filter(model => {
    if (model.tasks && !model.tasks.includes(task)) return false;
    if (model.contextTokens < estimatedInputTokens + requestedOutputTokens ||
        model.maxOutputTokens < requestedOutputTokens) return false;

    // Missing cost metadata is unknown, never implicitly free.
    if (!Number.isFinite(model.inputCost) || !Number.isFinite(model.outputCost)) return false;
    const isPaid = model.inputCost > 0 || model.outputCost > 0;
    if (isPaid && costMode !== 'allow-paid') return false;

    if (providerState !== undefined || isPaid) {
      const provider = providerState?.[model.providerId];
      const state = provider?.models === undefined
        ? provider
        : provider.models?.[model.id];
      if (!provider || provider.enabled !== true || !state ||
          state.enabled === false ||
          !Number.isSafeInteger(state.remainingTokens) ||
          state.remainingTokens < estimatedInputTokens + requestedOutputTokens) return false;
      if (isPaid && provider.paidFallbackApproved !== true &&
          state.paidFallbackApproved !== true) return false;
    }
    return true;
  });

  if (!eligible.length) throw new Error('No eligible model route satisfies context, output and provider quota limits');
  eligible.sort((a, b) => {
    const costA = (a.inputCost ?? 0) * estimatedInputTokens +
      (a.outputCost ?? 0) * requestedOutputTokens;
    const costB = (b.inputCost ?? 0) * estimatedInputTokens +
      (b.outputCost ?? 0) * requestedOutputTokens;
    return costA - costB ||
      (a.priority ?? 100) - (b.priority ?? 100) ||
      a.contextTokens - b.contextTokens ||
      a.id.localeCompare(b.id);
  });

  const selected = eligible[0];
  return Object.freeze({
    modelId: selected.id,
    providerId: selected.providerId,
    estimatedInputTokens,
    reservedOutputTokens: requestedOutputTokens,
    contextTokens: selected.contextTokens,
    maxOutputTokens: selected.maxOutputTokens,
    estimatedCost: (selected.inputCost ?? 0) * estimatedInputTokens +
      (selected.outputCost ?? 0) * requestedOutputTokens,
    alternatives: eligible.slice(1).map(model => model.id),
  });
}

export function fitMessagesToContext(messages, maxInputTokens) {
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > 100) {
    throw new TypeError('Invalid model message list');
  }
  requirePositiveInteger(maxInputTokens, 'input token budget');
  for (const message of messages) {
    if (!message || typeof message !== 'object' || Array.isArray(message) ||
        !['system', 'user', 'assistant'].includes(message.role) ||
        typeof message.content !== 'string' || !message.content.trim()) {
      throw new TypeError('Invalid model message');
    }
  }

  const systemIndex = messages.findIndex(message => message.role === 'system');
  const system = systemIndex >= 0 ? messages[systemIndex] : null;
  const candidates = messages.filter((_, index) => index !== systemIndex);
  const estimate = message => 4 + estimateTokenCount(message.content);
  let used = system ? estimate(system) : 0;
  if (used > maxInputTokens) throw new RangeError('System instruction exceeds input token budget');

  const kept = [];
  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const message = candidates[index];
    const cost = estimate(message);
    if (used + cost > maxInputTokens) {
      if (kept.length === 0 && index === candidates.length - 1) {
        throw new RangeError('Latest message exceeds input token budget');
      }
      continue;
    }
    kept.push(message);
    used += cost;
  }
  kept.reverse();
  return system ? [system, ...kept] : kept;
}
