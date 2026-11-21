const MAX_ACTIONS = 20;
const MAX_ACTION_ID_LENGTH = 64;

const READ_ONLY_ACTIONS = new Set(['navigate', 'inspect', 'extract', 'scroll']);
const APPROVAL_ACTIONS = new Set([
  'click',
  'type',
  'select',
  'submit',
  'upload',
  'download',
  'send',
  'purchase',
  'delete',
  'account_change',
]);

const HOST_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z]{2,63}$/;

function failure(error) {
  return { ok: false, error };
}

function normalizeAllowedHosts(allowedHosts) {
  if (!Array.isArray(allowedHosts) || allowedHosts.length === 0 || allowedHosts.length > 100) {
    return null;
  }

  const normalized = [];
  for (const entry of allowedHosts) {
    if (typeof entry !== 'string' || entry !== entry.trim()) return null;
    const host = entry.toLowerCase();
    if (!HOST_PATTERN.test(host) || host.includes('*') || host.endsWith('.')) return null;
    if (normalized.includes(host)) continue;
    normalized.push(host);
  }
  return normalized.length ? normalized : null;
}

function validateTargetUrl(value, allowedHosts) {
  if (typeof value !== 'string' || value.length > 2048) return null;

  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  const hostname = url.hostname.toLowerCase();
  if (
    url.protocol !== 'https:' ||
    !HOST_PATTERN.test(hostname) ||
    url.username ||
    url.password ||
    (url.port && url.port !== '443') ||
    url.search ||
    url.hash ||
    hostname.endsWith('.') ||
    !allowedHosts.includes(hostname)
  ) {
    return null;
  }

  return url.origin + url.pathname;
}

/**
 * Validate a structured browser plan. This module deliberately does not
 * authorize or execute actions; the future runner must obtain action-scoped
 * approval from AEGIS Sentinel before performing any browser interaction.
 */
export function validateBrowserTaskPlan(plan, { allowedHosts } = {}) {
  const hosts = normalizeAllowedHosts(allowedHosts);
  if (!hosts) return failure('Browser host allowlist is not configured.');

  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    return failure('Browser task plan is invalid.');
  }

  const planKeys = Object.keys(plan).sort();
  if (
    planKeys.length !== 3 ||
    planKeys[0] !== 'actions' ||
    planKeys[1] !== 'startUrl' ||
    planKeys[2] !== 'version' ||
    plan.version !== 1
  ) {
    return failure('Browser task plan contains unsupported fields or version.');
  }

  const startUrl = validateTargetUrl(plan.startUrl, hosts);
  if (!startUrl) return failure('Browser start URL is not allowed.');

  if (!Array.isArray(plan.actions) || plan.actions.length === 0) {
    return failure('Browser task must contain at least one action.');
  }
  if (plan.actions.length > MAX_ACTIONS) {
    return failure('Browser task exceeds the action limit.');
  }

  const seenIds = new Set();
  const normalizedActions = [];
  const approvalRequiredActionIds = [];

  for (const action of plan.actions) {
    if (!action || typeof action !== 'object' || Array.isArray(action)) {
      return failure('Browser action is invalid.');
    }

    const keys = Object.keys(action).sort();
    if (
      (keys.length !== 2 && keys.length !== 3) ||
      keys[0] !== 'id' ||
      keys[1] !== 'kind' ||
      (keys.length === 3 && keys[2] !== 'url')
    ) {
      return failure('Browser action contains unsupported fields.');
    }

    if (
      typeof action.id !== 'string' ||
      action.id.length === 0 ||
      action.id.length > MAX_ACTION_ID_LENGTH ||
      !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(action.id)
    ) {
      return failure('Browser action identifier is invalid.');
    }
    if (seenIds.has(action.id)) {
      return failure('Browser action identifiers must be unique.');
    }
    seenIds.add(action.id);

    if (typeof action.kind !== 'string') {
      return failure('Browser action kind is not supported.');
    }

    const normalized = { id: action.id, kind: action.kind };
    if (action.kind === 'navigate') {
      if (keys.length !== 3) return failure('Browser navigation requires an allowed URL.');
      const url = validateTargetUrl(action.url, hosts);
      if (!url) return failure('Browser navigation URL is not allowed.');
      normalized.url = url;
    } else if (READ_ONLY_ACTIONS.has(action.kind)) {
      if (keys.length !== 2) return failure('Browser action contains an unexpected URL.');
    } else if (APPROVAL_ACTIONS.has(action.kind)) {
      if (keys.length !== 2) return failure('Browser action contains an unexpected URL.');
      approvalRequiredActionIds.push(action.id);
    } else {
      return failure('Browser action kind is not supported.');
    }

    normalizedActions.push(normalized);
  }

  return {
    ok: true,
    normalized: {
      version: 1,
      startUrl,
      actions: normalizedActions,
    },
    decision: {
      mode: approvalRequiredActionIds.length ? 'approval_required' : 'read_only',
      approvalRequiredActionIds,
      executionAllowed: false,
      reason: 'Planning only: browser execution requires a separate Sentinel authorization grant.',
    },
  };
}
