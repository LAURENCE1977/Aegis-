import { getCapabilityManifest } from './capability-registry.mjs';
import { evaluateCapabilityPolicy } from './capability-policy.mjs';
import { consumeApproval, getApprovalRequest } from './capability-approvals.mjs';

const encoder = new TextEncoder();
const MAX_OPERATION_BYTES = 64 * 1024;
const MAX_DEPTH = 20;
const MAX_NODES = 10_000;

function canonicalize(value, state, depth = 0) {
  state.nodes += 1;
  if (state.nodes > MAX_NODES || depth > MAX_DEPTH) {
    throw new TypeError('Operation input exceeds canonical JSON complexity limits');
  }
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Operation input must contain finite JSON numbers');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    if (state.seen.has(value)) throw new TypeError('Operation input must not contain cycles');
    state.seen.add(value);
    const items = [];
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(value, index)) {
        throw new TypeError('Operation input must not contain sparse arrays');
      }
      items.push(canonicalize(value[index], state, depth + 1));
    }
    state.seen.delete(value);
    return '[' + items.join(',') + ']';
  }
  if (typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError('Operation input must contain only plain JSON objects');
    }
    if (state.seen.has(value)) throw new TypeError('Operation input must not contain cycles');
    state.seen.add(value);
    const keys = Reflect.ownKeys(value);
    if (keys.some((key) => typeof key !== 'string')) {
      throw new TypeError('Operation input must not contain symbol keys');
    }
    const serialized = keys.sort().map((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !descriptor.enumerable || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
        throw new TypeError('Operation input must contain only enumerable data properties');
      }
      return JSON.stringify(key) + ':' + canonicalize(descriptor.value, state, depth + 1);
    });
    state.seen.delete(value);
    return '{' + serialized.join(',') + '}';
  }
  throw new TypeError('Operation input must be valid JSON data');
}

/** Create a deterministic SHA-256 digest for the complete normalized operation input. */
export async function createOperationDigest(input) {
  const canonical = canonicalize(input, { nodes: 0, seen: new Set() });
  const bytes = encoder.encode(canonical);
  if (bytes.byteLength > MAX_OPERATION_BYTES) {
    throw new TypeError('Operation input exceeds the 64 KiB digest limit');
  }
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const hex = Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return 'sha256:' + hex;
}

/**
 * Sentinel is the final policy gate before an adapter is allowed to perform work.
 * It computes the digest itself and atomically consumes a one-time approval for
 * protected actions. It never executes the adapter or performs an external effect.
 */
export async function authorizeSentinelInvocation({
  capabilityId,
  actionId,
  principalId,
  resourceId,
  input,
  grant,
  connection = null,
  approvalId = null,
  approvalDb = null,
  budget,
  now = Date.now(),
  registryLookup = getCapabilityManifest,
} = {}) {
  let manifest;
  try {
    manifest = typeof registryLookup === 'function' ? registryLookup(capabilityId) : null;
  } catch {
    manifest = null;
  }
  if (!manifest) return { allowed: false, reasonCode: 'CAPABILITY_NOT_REGISTERED' };

  let inputDigest;
  try {
    inputDigest = await createOperationDigest(input);
  } catch {
    return { allowed: false, reasonCode: 'OPERATION_INPUT_INVALID' };
  }

  let approval = null;
  if (approvalId !== null && approvalId !== undefined) {
    if (!approvalDb || typeof approvalDb.prepare !== 'function') {
      return { allowed: false, reasonCode: 'APPROVAL_STORE_UNAVAILABLE', inputDigest };
    }
    try {
      approval = await getApprovalRequest(approvalDb, approvalId);
    } catch {
      return { allowed: false, reasonCode: 'APPROVAL_STORE_UNAVAILABLE', inputDigest };
    }
  }

  const decision = evaluateCapabilityPolicy({
    manifest,
    actionId,
    principalId,
    resourceId,
    inputDigest,
    grant,
    connection,
    approval,
    budget,
    now,
    registryLookup,
  });
  if (!decision.allowed) return { ...decision, inputDigest };

  const action = manifest.actions.find((entry) => entry.id === actionId);
  if (action?.approval === 'human-always') {
    if (!approval || !approvalDb) {
      return { allowed: false, reasonCode: 'APPROVAL_REQUIRED', inputDigest };
    }
    const consumed = await consumeApproval(approvalDb, {
      id: approval.id,
      principalId,
      capabilityId: manifest.id,
      capabilityVersion: manifest.version,
      actionId,
      resourceId,
      operationSummary: approval.operationSummary,
      connectionId: connection?.id ?? null,
      inputDigest,
      now,
    });
    if (!consumed) {
      return { allowed: false, reasonCode: 'APPROVAL_CONSUMPTION_FAILED', inputDigest };
    }
    return { allowed: true, reasonCode: 'ALLOW', inputDigest, approvalConsumed: true };
  }

  return { allowed: true, reasonCode: 'ALLOW', inputDigest, approvalConsumed: false };
}
