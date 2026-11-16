const ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const TASKS = new Set(['simple', 'chat', 'coding', 'research', 'reasoning']);
const PROVIDER_KEYS = new Set(['id', 'adapterId', 'displayName', 'status', 'termsUrl', 'verifiedAt', 'models']);
const MODEL_KEYS = new Set(['id', 'contextTokens', 'maxOutputTokens', 'tasks', 'inputCost', 'outputCost']);

function exactKeys(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some(key => !allowed.has(key))) {
    throw new TypeError('Invalid ' + label + ' fields');
  }
}

function positiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) throw new TypeError('Invalid ' + label);
}

function validTimestamp(value, label) {
  const time = Date.parse(value);
  if (typeof value !== 'string' || !Number.isFinite(time) ||
      new Date(time).toISOString() !== value) {
    throw new TypeError('Invalid verifiedAt ' + label + ' timestamp');
  }
  return time;
}

function validateModel(model, ids) {
  exactKeys(model, MODEL_KEYS, 'model');
  if (typeof model.id !== 'string' || !ID.test(model.id) || ids.has(model.id)) {
    throw new TypeError('Invalid or duplicate model identifier');
  }
  ids.add(model.id);
  positiveInteger(model.contextTokens, 'model context window');
  positiveInteger(model.maxOutputTokens, 'model output limit');
  if (!Array.isArray(model.tasks) || model.tasks.length < 1 ||
      model.tasks.some(task => !TASKS.has(task)) ||
      new Set(model.tasks).size !== model.tasks.length) {
    throw new TypeError('Invalid model task capabilities');
  }
  for (const key of ['inputCost', 'outputCost']) {
    if (model[key] !== undefined &&
        (typeof model[key] !== 'number' || !Number.isFinite(model[key]) || model[key] < 0)) {
      throw new TypeError('Invalid model cost');
    }
  }
}

export function validateProviderRegistry(registry) {
  if (!registry || typeof registry !== 'object' || Array.isArray(registry) ||
      Object.keys(registry).some(key => !['version', 'providers'].includes(key)) ||
      registry.version !== 1 || !Array.isArray(registry.providers) ||
      registry.providers.length < 1 || registry.providers.length > 100) {
    throw new TypeError('Invalid provider registry: providers must be a non-empty array');
  }
  const providerIds = new Set();
  const modelIds = new Set();
  for (const provider of registry.providers) {
    exactKeys(provider, PROVIDER_KEYS, 'provider');
    if (typeof provider.id !== 'string' || !ID.test(provider.id) || providerIds.has(provider.id)) {
      throw new TypeError('Invalid or duplicate provider identifier');
    }
    providerIds.add(provider.id);
    if (typeof provider.adapterId !== 'string' || !ID.test(provider.adapterId)) {
      throw new TypeError('Invalid provider adapter identifier');
    }
    if (typeof provider.displayName !== 'string' || !provider.displayName.trim() || provider.displayName.length > 100) {
      throw new TypeError('Invalid provider display name');
    }
    if (!['enabled', 'disabled', 'review'].includes(provider.status)) {
      throw new TypeError('Invalid provider status');
    }
    if (typeof provider.termsUrl !== 'string') throw new TypeError('Provider terms URL is required');
    let terms;
    try { terms = new URL(provider.termsUrl); } catch { throw new TypeError('Invalid provider terms URL'); }
    if (terms.protocol !== 'https:' || terms.username || terms.password) {
      throw new TypeError('Provider terms URL must use HTTPS');
    }
    validTimestamp(provider.verifiedAt, 'provider verification');
    if (!Array.isArray(provider.models) || provider.models.length < 1 || provider.models.length > 500) {
      throw new TypeError('Invalid provider models');
    }
    for (const model of provider.models) validateModel(model, modelIds);
  }
  return registry;
}

export function listEligibleModels(registry, { task, now, maxAgeMs = 86400000 } = {}) {
  validateProviderRegistry(registry);
  if (!TASKS.has(task)) throw new TypeError('Invalid model task');
  const nowMs = validTimestamp(now, 'current');
  positiveInteger(maxAgeMs, 'verification age');
  const result = [];
  for (const provider of registry.providers) {
    if (provider.status !== 'enabled') continue;
    const verifiedMs = Date.parse(provider.verifiedAt);
    if (verifiedMs > nowMs || nowMs - verifiedMs > maxAgeMs) continue;
    for (const model of provider.models) {
      if (!model.tasks.includes(task)) continue;
      result.push(Object.freeze({
        id: model.id,
        providerId: provider.id,
        adapterId: provider.adapterId,
        contextTokens: model.contextTokens,
        maxOutputTokens: model.maxOutputTokens,
        tasks: [...model.tasks],
        inputCost: model.inputCost,
        outputCost: model.outputCost,
        costKnown: model.inputCost !== undefined && model.outputCost !== undefined,
        verifiedAt: provider.verifiedAt,
      }));
    }
  }
  return result;
}


function optionalPositiveInteger(value, label) {
  if (value !== undefined && (!Number.isSafeInteger(value) || value < 1)) {
    throw new TypeError('Invalid ' + label);
  }
}

function optionalNonNegativeCost(value, label) {
  if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) {
    throw new TypeError('Invalid ' + label);
  }
}

export function rankEligibleModels(registry, {
  task,
  now,
  maxAgeMs = 86400000,
  requiredContextTokens,
  requiredOutputTokens,
  maxInputCost,
  maxOutputCost,
  preferredProviderIds = [],
} = {}) {
  optionalPositiveInteger(requiredContextTokens, 'required context tokens');
  optionalPositiveInteger(requiredOutputTokens, 'required output tokens');
  optionalNonNegativeCost(maxInputCost, 'maximum input cost');
  optionalNonNegativeCost(maxOutputCost, 'maximum output cost');
  if (!Array.isArray(preferredProviderIds) || preferredProviderIds.length > 100 ||
      preferredProviderIds.some(id => typeof id !== 'string' || !ID.test(id)) ||
      new Set(preferredProviderIds).size !== preferredProviderIds.length) {
    throw new TypeError('Invalid preferred provider identifiers');
  }

  const preference = new Map(preferredProviderIds.map((id, index) => [id, index]));
  return listEligibleModels(registry, { task, now, maxAgeMs })
    .filter(model => requiredContextTokens === undefined || model.contextTokens >= requiredContextTokens)
    .filter(model => requiredOutputTokens === undefined || model.maxOutputTokens >= requiredOutputTokens)
    .filter(model => {
      if ((maxInputCost !== undefined || maxOutputCost !== undefined) && !model.costKnown) return false;
      if (maxInputCost !== undefined && model.inputCost > maxInputCost) return false;
      if (maxOutputCost !== undefined && model.outputCost > maxOutputCost) return false;
      return true;
    })
    .sort((left, right) => {
      const leftPreference = preference.get(left.providerId) ?? Number.MAX_SAFE_INTEGER;
      const rightPreference = preference.get(right.providerId) ?? Number.MAX_SAFE_INTEGER;
      if (leftPreference !== rightPreference) return leftPreference - rightPreference;
      if (left.costKnown !== right.costKnown) return left.costKnown ? -1 : 1;
      if (left.costKnown) {
        const costDifference = (left.inputCost + left.outputCost) - (right.inputCost + right.outputCost);
        if (costDifference !== 0) return costDifference;
      }
      return left.id.localeCompare(right.id);
    });
}
