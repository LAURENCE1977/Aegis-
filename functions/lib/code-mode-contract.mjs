const MAX_CODE_BYTES = 16 * 1024;
const MAX_METHODS = 8;
const MAX_CALLS = 20;
const MAX_OUTPUT_BYTES = 16 * 1024;
const MAX_WALL_TIME_MS = 5_000;

export const CODE_MODE_LIMITS = Object.freeze({
  maxCodeBytes: MAX_CODE_BYTES,
  maxMethods: MAX_METHODS,
  maxCalls: MAX_CALLS,
  maxOutputBytes: MAX_OUTPUT_BYTES,
  maxWallTimeMs: MAX_WALL_TIME_MS,
});

const RUN_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const ID_PATTERN = /^[a-z][a-z0-9-]{0,79}$/;
const METHOD_PATTERN = /^[a-z][a-z0-9-]{0,39}\.[a-z][a-z0-9-]{0,49}$/;
const REQUEST_KEYS = new Set(['enabled', 'runId', 'code', 'methods', 'resolveCapability']);

function isRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

/**
 * Builds a deliberately narrow hand-off envelope for a separately isolated
 * Code Mode executor. This function does not evaluate or execute generated code.
 *
 * Capability metadata is resolved from the trusted server registry. Only
 * approved, built-in, internal, low-risk read actions with no egress are eligible
 * for the synthetic proof of concept. The sandbox receives method identifiers,
 * never manifests, credentials, endpoints, grants, approvals or runtime bindings.
 */
export function prepareCodeModeRun(input) {
  if (!isRecord(input) ||
      Object.keys(input).some((key) => !REQUEST_KEYS.has(key))) {
    return { ok: false, reasonCode: 'INVALID_REQUEST' };
  }

  if (input.enabled !== true) {
    return { ok: false, reasonCode: 'CODE_MODE_DISABLED' };
  }
  if (typeof input.runId !== 'string' || !RUN_ID_PATTERN.test(input.runId)) {
    return { ok: false, reasonCode: 'INVALID_RUN_ID' };
  }
  if (typeof input.code !== 'string' || !input.code.trim() ||
      input.code.includes('\u0000')) {
    return { ok: false, reasonCode: 'INVALID_CODE' };
  }
  if (new TextEncoder().encode(input.code).byteLength > MAX_CODE_BYTES) {
    return { ok: false, reasonCode: 'CODE_TOO_LARGE' };
  }
  if (!Array.isArray(input.methods) || input.methods.length < 1 ||
      input.methods.length > MAX_METHODS ||
      typeof input.resolveCapability !== 'function') {
    return { ok: false, reasonCode: 'INVALID_METHOD_SELECTION' };
  }

  const selected = [];
  const seen = new Set();

  for (const selection of input.methods) {
    if (!isRecord(selection) ||
        Object.keys(selection).length !== 2 ||
        Object.keys(selection).some((key) => !['capabilityId', 'actionId'].includes(key)) ||
        typeof selection.capabilityId !== 'string' || !ID_PATTERN.test(selection.capabilityId) ||
        typeof selection.actionId !== 'string' || !ID_PATTERN.test(selection.actionId)) {
      return { ok: false, reasonCode: 'INVALID_METHOD_SELECTION' };
    }

    const selectionKey = selection.capabilityId + ':' + selection.actionId;
    if (seen.has(selectionKey)) {
      return { ok: false, reasonCode: 'INVALID_METHOD_SELECTION' };
    }
    seen.add(selectionKey);

    let manifest;
    try {
      manifest = input.resolveCapability(selection.capabilityId);
    } catch {
      return { ok: false, reasonCode: 'CAPABILITY_LOOKUP_FAILED' };
    }
    if (!manifest || manifest.id !== selection.capabilityId) {
      return { ok: false, reasonCode: 'CAPABILITY_NOT_REGISTERED' };
    }

    const action = Array.isArray(manifest.actions)
      ? manifest.actions.find((candidate) => candidate?.id === selection.actionId)
      : null;
    if (!action) return { ok: false, reasonCode: 'ACTION_NOT_FOUND' };

    const sandboxEligible =
      manifest.status === 'approved' &&
      manifest.provider?.kind === 'builtin' &&
      manifest.interface?.kind === 'internal' &&
      manifest.interface?.method === 'GET' &&
      manifest.data &&
      ['public', 'internal'].includes(manifest.data.classification) &&
      Array.isArray(manifest.data.writes) &&
      manifest.data.writes.length === 0 &&
      Array.isArray(manifest.network?.egressHosts) &&
      manifest.network.egressHosts.length === 0;

    if (!sandboxEligible) {
      return { ok: false, reasonCode: 'CAPABILITY_NOT_SANDBOX_ELIGIBLE' };
    }

    if (action.effect !== 'read' || action.risk !== 'low' ||
        action.approval !== 'none' || typeof action.capability !== 'string' ||
        !METHOD_PATTERN.test(action.capability)) {
      return { ok: false, reasonCode: 'METHOD_NOT_READ_ONLY' };
    }

    selected.push(Object.freeze({
      capabilityId: manifest.id,
      actionId: action.id,
      method: action.capability,
    }));
  }

  const envelope = deepFreeze({
    runId: input.runId,
    code: input.code,
    methods: selected,
    limits: { ...CODE_MODE_LIMITS },
  });

  return { ok: true, envelope };
}
