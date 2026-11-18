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
      const value = model[key];
      if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) {
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
  maxInputCost,
  maxOutputCost,
}) {
  validateModels(models);
  if (!TASKS.has(task)) throw new TypeError('Invalid model task');
  requirePositiveInteger(estimatedInputTokens, 'estimated input tokens', { allowZero: true });
  requirePositiveInteger(requestedOutputTokens, 'requested output tokens');
  for (const [value, label] of [[maxInputCost, 'maximum input cost'], [maxOutputCost, 'maximum output cost']]) {
    if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) {
      throw new TypeError('Invalid ' + label);
    }
  }
  if (providerState !== undefined &&
      (!providerState || typeof providerState !== 'object' || Array.isArray(providerState))) {
    throw new TypeError('Invalid provider state');
  }

  const eligible = models.filter(model => {
    if (model.tasks && !model.tasks.includes(task)) return false;
    if (model.contextTokens < estimatedInputTokens + requestedOutputTokens ||
        model.maxOutputTokens < requestedOutputTokens) return false;
    if ((maxInputCost !== undefined || maxOutputCost !== undefined) &&
        (model.inputCost === undefined || model.outputCost === undefined)) return false;
    if (maxInputCost !== undefined && model.inputCost > maxInputCost) return false;
    if (maxOutputCost !== undefined && model.outputCost > maxOutputCost) return false;
    if (providerState !== undefined) {
      const state = providerState[model.providerId];
      if (!state || state.enabled !== true ||
          !Number.isSafeInteger(state.remainingTokens) ||
          state.remainingTokens < estimatedInputTokens + requestedOutputTokens) return false;
    }
    return true;
  });

  if (!eligible.length) throw new Error('No eligible model route satisfies context, output and provider quota limits');
  eligible.sort((a, b) => {
    const knownA = a.inputCost !== undefined && a.outputCost !== undefined;
    const knownB = b.inputCost !== undefined && b.outputCost !== undefined;
    if (knownA !== knownB) return knownA ? -1 : 1;
    const costA = knownA ? a.inputCost * estimatedInputTokens + a.outputCost * requestedOutputTokens : null;
    const costB = knownB ? b.inputCost * estimatedInputTokens + b.outputCost * requestedOutputTokens : null;
    return (knownA ? costA - costB : 0) ||
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
    estimatedCost: selected.inputCost === undefined || selected.outputCost === undefined
      ? null
      : selected.inputCost * estimatedInputTokens + selected.outputCost * requestedOutputTokens,
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
