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
}) {
  validateModels(models);
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


const TASK_SIGNALS = Object.freeze({
  simple: Object.freeze(['calculate', 'compute', 'convert', 'count', 'sort', 'format', 'extract', 'validate']),
  chat: Object.freeze(['explain', 'describe', 'answer', 'discuss', 'draft', 'rewrite', 'summarise', 'summarize', 'translate']),
  coding: Object.freeze(['debug', 'code', 'implement', 'program', 'refactor', 'compile', 'typescript', 'javascript', 'python', 'function', 'test']),
  research: Object.freeze(['research', 'investigate', 'sources', 'source', 'evidence', 'latest', 'compare', 'survey', 'findings']),
  reasoning: Object.freeze(['reason', 'prove', 'derive', 'solve', 'strategy', 'plan', 'design', 'evaluate', 'assess', 'analyse', 'analyze', 'decision', 'tradeoff']),
});
const ALLOWED_TASK_TYPES = new Set(Object.keys(TASK_SIGNALS));

function validateTaskTranslationInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      (Object.getPrototypeOf(input) !== Object.prototype && Object.getPrototypeOf(input) !== null)) {
    throw new TypeError('Task translation input must be a plain object');
  }
  const allowed = new Set(['objective', 'explicitType', 'requestedOutputTokens']);
  for (const key of Reflect.ownKeys(input)) {
    if (typeof key !== 'string' || !allowed.has(key)) {
      throw new TypeError('Task translation input contains an unknown field');
    }
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) {
      throw new TypeError('Task translation input must not contain accessors');
    }
  }
  if (typeof input.objective !== 'string' || !input.objective.trim() ||
      input.objective.length > 2000 || /[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f]/.test(input.objective)) {
    throw new TypeError('Task objective must contain 1–2000 safe characters');
  }
  if (input.explicitType !== undefined && !ALLOWED_TASK_TYPES.has(input.explicitType)) {
    throw new TypeError('Unsupported explicit task type');
  }
  if (input.requestedOutputTokens !== undefined) {
    requirePositiveInteger(input.requestedOutputTokens, 'requested output tokens');
    if (input.requestedOutputTokens > 1000000) {
      throw new RangeError('Requested output token budget is too large');
    }
  }
}

function freezeTaskEvidence(evidence) {
  return Object.freeze(evidence.map(item => Object.freeze({
    task: item.task,
    signals: Object.freeze([...item.signals]),
    score: item.score,
  })));
}

/**
 * Translate a bounded objective into a conservative task descriptor.
 * This is lexical planning only: it does not invoke models, tools or executors.
 * Ambiguous requests remain unknown rather than being guessed.
 */
export function translateTask(input) {
  validateTaskTranslationInput(input);
  const objective = input.objective.trim();
  const tokens = new Set(objective.toLocaleLowerCase().match(/[a-z0-9]+/g) ?? []);
  let task = input.explicitType ?? 'unknown';
  let classificationSource = input.explicitType === undefined ? 'lexical' : 'explicit';
  let evidence = [];

  if (input.explicitType !== undefined) {
    evidence = [{ task, signals: [], score: null }];
  } else {
    const scores = Object.entries(TASK_SIGNALS).map(([candidate, signals]) => ({
      task: candidate,
      signals: signals.filter(signal => tokens.has(signal)),
    })).map(item => ({ ...item, score: item.signals.length }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score || a.task.localeCompare(b.task));
    if (scores.length) {
      const topScore = scores[0].score;
      const leaders = scores.filter(item => item.score === topScore);
      evidence = leaders;
      if (leaders.length === 1) task = leaders[0].task;
    }
  }

  const routeStrategy = task === 'unknown' ? 'clarify'
    : task === 'simple' ? 'deterministic_first' : 'model_candidate';
  const result = {
    schemaVersion: 'aegis.task-translation.v1',
    objective,
    task,
    classificationSource,
    evidence: freezeTaskEvidence(evidence),
    routeStrategy,
    modelRequired: task === 'unknown' ? null : task !== 'simple',
    resources: Object.freeze({
      inputBytes: new TextEncoder().encode(objective).byteLength,
      estimatedInputTokens: estimateTokenCount(objective),
      requestedOutputTokens: input.requestedOutputTokens ?? null,
      cpuEstimate: null,
      memoryEstimateBytes: null,
      latencyEstimateMs: null,
    }),
    execution: 'not_authorised',
    toolsInvoked: false,
  };
  return Object.freeze(result);
}
