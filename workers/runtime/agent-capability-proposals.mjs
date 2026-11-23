import { getCapabilityManifest } from '../../functions/lib/capability-registry.mjs';
import { canonicalizeInput, digestCanonicalInput } from '../../functions/lib/canonical-input.mjs';

const REQUEST_KEYS = new Set(['capabilityId', 'actionId', 'resourceId', 'input']);
const RESOURCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/;
const RUN_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRINCIPAL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function isPlainRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Build a metadata-only proposal for a future Sentinel-mediated action.
 *
 * This function deliberately does not load grants, consume approvals, access
 * adapters, enqueue work or execute anything. The raw input is represented
 * only by its canonical digest so callers cannot mistake this descriptor for
 * an executable command or use it as a substitute for protected persistence.
 */
export async function createAgentCapabilityProposal(agentRequest, trustedContext) {
  if (!isPlainRecord(agentRequest) ||
      Object.keys(agentRequest).some((key) => !REQUEST_KEYS.has(key)) ||
      typeof agentRequest.capabilityId !== 'string' ||
      !/^[a-z][a-z0-9-]{0,79}$/.test(agentRequest.capabilityId) ||
      typeof agentRequest.actionId !== 'string' ||
      !/^[a-z][a-z0-9-]{0,79}$/.test(agentRequest.actionId) ||
      typeof agentRequest.resourceId !== 'string' ||
      !RESOURCE_PATTERN.test(agentRequest.resourceId) ||
      agentRequest.resourceId.includes('..') ||
      agentRequest.resourceId.includes('*') ||
      !isPlainRecord(agentRequest.input)) {
    throw new TypeError('Invalid agent capability proposal');
  }

  if (!isPlainRecord(trustedContext) ||
      !RUN_ID_PATTERN.test(trustedContext.runId || '') ||
      !PRINCIPAL_PATTERN.test(trustedContext.principalId || '')) {
    throw new TypeError('Invalid trusted context');
  }

  const manifest = getCapabilityManifest(agentRequest.capabilityId);
  const action = manifest?.actions?.find((item) => item.id === agentRequest.actionId);
  if (!manifest || manifest.status !== 'approved' || !action || action.effect !== 'read') {
    throw new TypeError('Capability action is not approved for read-only proposal');
  }

  let inputDigest;
  try {
    const canonicalInput = canonicalizeInput(agentRequest.input);
    if (new TextEncoder().encode(canonicalInput).byteLength > manifest.limits.maxRequestBytes) {
      throw new TypeError('Input exceeds capability request limit');
    }
    inputDigest = await digestCanonicalInput(agentRequest.input);
  } catch {
    throw new TypeError('Invalid proposal input');
  }

  return Object.freeze({
    proposalId: crypto.randomUUID(),
    runId: trustedContext.runId,
    principalId: trustedContext.principalId,
    capabilityId: manifest.id,
    capabilityVersion: manifest.version,
    actionId: action.id,
    resourceId: agentRequest.resourceId,
    inputDigest,
    requiredScopes: Object.freeze([...action.requiredScopes]),
    effect: action.effect,
    risk: action.risk,
    approval: action.approval,
    status: 'proposed',
    execution: 'disabled',
    createdAt: new Date().toISOString(),
  });
}
