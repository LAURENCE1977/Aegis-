import { getCapabilityManifest } from './capability-registry.mjs';
import { loadCapabilityGrant } from './capability-grants.mjs';
import { loadConnection } from './capability-connections.mjs';
import {
  loadApproval,
  consumeApproval,
} from './capability-approvals.mjs';
import { recordCapabilityAudit } from './capability-audit.mjs';
import { reserveCapabilityInvocation } from './capability-rate-limits.mjs';

const ADAPTER_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*$/;

function buildAdapterMap(adapters) {
  if (!adapters || typeof adapters !== 'object' || Array.isArray(adapters)) {
    throw new TypeError('An explicit adapter registry is required');
  }

  const entries = Object.entries(adapters);
  if (entries.length === 0) throw new TypeError('At least one fixed adapter is required');

  const registry = new Map();
  for (const [key, handler] of entries) {
    if (!ADAPTER_KEY_PATTERN.test(key) || typeof handler !== 'function') {
      throw new TypeError('Invalid fixed adapter registry entry');
    }
    const separator = key.lastIndexOf(':');
    const manifest = getCapabilityManifest(key.slice(0, separator));
    const actionId = key.slice(separator + 1);
    if (!manifest || manifest.status !== 'approved' ||
        !manifest.actions.some((action) => action.id === actionId)) {
      throw new TypeError('Adapter must target an approved, registered capability action');
    }
    registry.set(key, handler);
  }
  return registry;
}

/**
 * Trusted composition root for Sentinel's persistent D1 stores.
 *
 * Adapter handlers are supplied by server-side code, keyed by the exact
 * capability/action pair. Manifest URLs, paths and request fields are never
 * interpreted as adapter destinations. This function does not resolve vault
 * secrets or create a public endpoint.
 */
export function createSentinelDependencies({ db, adapters, clock = Date.now } = {}) {
  if (!db || typeof db.prepare !== 'function') {
    throw new TypeError('A D1-compatible database binding is required');
  }
  if (typeof clock !== 'function') throw new TypeError('A trusted clock function is required');

  const adapterRegistry = buildAdapterMap(adapters);

  function currentTime() {
    const value = clock();
    if (!Number.isFinite(value)) throw new TypeError('Trusted clock returned an invalid time');
    return value;
  }

  return Object.freeze({
    registryLookup: getCapabilityManifest,
    loadGrant: (binding) => loadCapabilityGrant(db, binding, currentTime()),
    loadConnection: (binding) => loadConnection(db, binding, currentTime()),
    loadApproval: (binding) => loadApproval(db, binding, currentTime()),
    reserveRateLimit: (binding) => reserveCapabilityInvocation(db, { ...binding, now: currentTime() }),
    consumeApproval: (binding) => consumeApproval(db, { ...binding, now: currentTime() }),
    recordAudit: (event) => recordCapabilityAudit(db, event),
    execute: async (input, context) => {
      const key = context?.capabilityId + ':' + context?.actionId;
      const handler = adapterRegistry.get(key);
      if (!handler) throw new Error('Capability adapter is not registered');
      const safeContext = Object.freeze({
        invocationId: context.invocationId,
        principalId: context.principalId,
        capabilityId: context.capabilityId,
        capabilityVersion: context.capabilityVersion,
        actionId: context.actionId,
        resourceId: context.resourceId,
        scopes: Object.freeze([...(context.scopes || [])]),
        connectionId: context.connectionId ?? null,
        inputDigest: context.inputDigest,
      });
      return handler(input, safeContext);
    },
  });
}
