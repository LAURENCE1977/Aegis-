import { getCapabilityManifest } from '../../functions/lib/capability-registry.mjs';
import { runSentinelInvocation } from '../../functions/lib/sentinel.mjs';

const REQUEST_KEYS = new Set(['capabilityId', 'actionId', 'resourceId', 'input']);
const ID_PATTERN = /^[a-z][a-z0-9-]{0,79}$/;
const RESOURCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/;

function isPlainRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertJsonSafe(value, seen = new WeakSet(), depth = 0) {
  if (depth > 16) throw new TypeError('Input nesting is too deep.');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (typeof value !== 'object') throw new TypeError('Input contains a non-JSON value.');
  if (seen.has(value)) throw new TypeError('Input contains a circular or repeated reference.');
  seen.add(value);
  if (Array.isArray(value)) {
    if (value.length > 256) throw new TypeError('Input array is too large.');
    for (const item of value) assertJsonSafe(item, seen, depth + 1);
    return;
  }
  if (!isPlainRecord(value)) throw new TypeError('Input must contain plain JSON objects.');
  const keys = Object.keys(value);
  if (keys.length > 128) throw new TypeError('Input object has too many fields.');
  for (const key of keys) {
    if (!key || key.length > 128 || /[\u0000-\u001f\u007f]/.test(key)) {
      throw new TypeError('Input contains an invalid field name.');
    }
    assertJsonSafe(value[key], seen, depth + 1);
  }
}

function canonicalJson(value) {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (isPlainRecord(value)) {
    return '{' + Object.keys(value).sort().map((key) =>
      JSON.stringify(key) + ':' + canonicalJson(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

async function digestInput(input) {
  const canonical = canonicalJson(input);
  const bytes = new TextEncoder().encode(canonical);
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  const hex = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return 'sha256:' + hex;
}

/**
 * Trusted server-side bridge from an agent's proposed capability call to Sentinel.
 * Principal identity, registry manifest, adapter and all policy loaders are supplied
 * by the trusted composition root; none can be selected by the agent request.
 */
export async function runAgentCapabilityRequest(agentRequest, principalContext, dependencies = {}) {
  if (!isPlainRecord(agentRequest) ||
      Object.keys(agentRequest).some((key) => !REQUEST_KEYS.has(key)) ||
      !ID_PATTERN.test(agentRequest.capabilityId || '') ||
      !ID_PATTERN.test(agentRequest.actionId || '') ||
      typeof agentRequest.resourceId !== 'string' ||
      !RESOURCE_PATTERN.test(agentRequest.resourceId) ||
      agentRequest.resourceId.includes('..') ||
      !isPlainRecord(agentRequest.input) ||
      !isPlainRecord(principalContext) ||
      typeof principalContext.principalId !== 'string' ||
      !principalContext.principalId.trim() ||
      principalContext.principalId.length > 512) {
    return { allowed: false, reasonCode: 'INVALID_AGENT_CAPABILITY_REQUEST' };
  }

  let manifest;
  try {
    manifest = getCapabilityManifest(agentRequest.capabilityId);
  } catch {
    manifest = null;
  }
  if (!manifest) return { allowed: false, reasonCode: 'CAPABILITY_NOT_REGISTERED' };
  if (!manifest.actions.some((action) => action.id === agentRequest.actionId)) {
    return { allowed: false, reasonCode: 'ACTION_NOT_FOUND' };
  }

  let inputDigest;
  try {
    assertJsonSafe(agentRequest.input);
    inputDigest = await digestInput(agentRequest.input);
    if (new TextEncoder().encode(canonicalJson(agentRequest.input)).byteLength > manifest.limits.maxRequestBytes) {
      return { allowed: false, reasonCode: 'INPUT_TOO_LARGE' };
    }
  } catch {
    return { allowed: false, reasonCode: 'INPUT_NOT_JSON_SAFE' };
  }

  const required = ['loadGrant', 'loadConnection', 'loadApproval', 'recordAudit', 'execute'];
  if (required.some((name) => typeof dependencies[name] !== 'function')) {
    return { allowed: false, reasonCode: 'POLICY_CONTEXT_UNAVAILABLE' };
  }

  return runSentinelInvocation({
    invocationId: globalThis.crypto.randomUUID(),
    principalId: principalContext.principalId,
    manifest,
    actionId: agentRequest.actionId,
    resourceId: agentRequest.resourceId,
    inputDigest,
    input: agentRequest.input,
    now: Date.now(),
  }, {
    ...dependencies,
    registryLookup: getCapabilityManifest,
  });
}
