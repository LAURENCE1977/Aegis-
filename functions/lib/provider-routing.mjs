const ROUTE_MODES = new Set(['free-only', 'allow-paid']);
const COST_CLASSES = new Set(['free', 'paid', 'unknown']);
const QUOTA_STATES = new Set(['available', 'exhausted', 'unknown']);
const CANDIDATE_KEYS = new Set([
  'provider',
  'model',
  'priority',
  'enabled',
  'healthy',
  'quotaState',
  'costClass',
  'paidFallbackApproved',
  'capabilities',
]);

function validateRouteInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).some(key => !['mode', 'candidates', 'requiredCapabilities'].includes(key))) {
    throw new TypeError('Invalid model route policy');
  }
  if (!ROUTE_MODES.has(input.mode)) {
    throw new TypeError('Invalid model route mode');
  }
  if (!Array.isArray(input.candidates) || input.candidates.length > 16) {
    throw new TypeError('Invalid model route candidates');
  }
  const required = input.requiredCapabilities ?? [];
  if (!Array.isArray(required) || required.length > 12 ||
      required.some(value => typeof value !== 'string' || !/^[a-z][a-z0-9-]{0,31}$/.test(value)) ||
      new Set(required).size !== required.length) {
    throw new TypeError('Invalid required model capabilities');
  }

  const identities = new Set();
  for (const candidate of input.candidates) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate) ||
        Object.keys(candidate).some(key => !CANDIDATE_KEYS.has(key)) ||
        Object.keys(candidate).length !== CANDIDATE_KEYS.size ||
        typeof candidate.provider !== 'string' || !/^[a-z][a-z0-9-]{0,39}$/.test(candidate.provider) ||
        typeof candidate.model !== 'string' || candidate.model.length > 160 ||
        !/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(candidate.model) ||
        !Number.isInteger(candidate.priority) || candidate.priority < 0 || candidate.priority > 1000 ||
        typeof candidate.enabled !== 'boolean' || typeof candidate.healthy !== 'boolean' ||
        !QUOTA_STATES.has(candidate.quotaState) || !COST_CLASSES.has(candidate.costClass) ||
        typeof candidate.paidFallbackApproved !== 'boolean' ||
        !Array.isArray(candidate.capabilities) || candidate.capabilities.length > 12 ||
        candidate.capabilities.some(value => typeof value !== 'string' || !/^[a-z][a-z0-9-]{0,31}$/.test(value)) ||
        new Set(candidate.capabilities).size !== candidate.capabilities.length) {
      throw new TypeError('Invalid model route candidate');
    }
    const identity = candidate.provider + ':' + candidate.model;
    if (identities.has(identity)) throw new TypeError('Duplicate model route candidate');
    identities.add(identity);
  }
  return { mode: input.mode, candidates: input.candidates, requiredCapabilities: required };
}

/**
 * Selects from a server-authored provider catalogue.
 *
 * Free-only is a hard stop: it never selects a paid or unknown-cost provider.
 * Paid candidates require allow-paid mode AND an explicit per-candidate approval.
 * No network calls, credentials, model output or external provider data are used here.
 */
export function selectModelRoute(input) {
  const { mode, candidates, requiredCapabilities } = validateRouteInput(input);
  const eligible = candidates.filter(candidate => {
    if (!candidate.enabled || !candidate.healthy || candidate.quotaState !== 'available') return false;
    if (!requiredCapabilities.every(capability => candidate.capabilities.includes(capability))) return false;
    if (candidate.costClass === 'free') return true;
    return mode === 'allow-paid' &&
      candidate.costClass === 'paid' &&
      candidate.paidFallbackApproved === true;
  });

  eligible.sort((a, b) =>
    a.priority - b.priority ||
    (a.costClass === 'free' ? 0 : 1) - (b.costClass === 'free' ? 0 : 1) ||
    a.provider.localeCompare(b.provider) ||
    a.model.localeCompare(b.model)
  );

  const selected = eligible[0];
  if (!selected) return null;
  return {
    provider: selected.provider,
    model: selected.model,
    costClass: selected.costClass,
    priority: selected.priority,
    decision: 'eligible',
  };
}
