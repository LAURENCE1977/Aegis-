import { authorizeOwner, jsonResponse } from '../../lib/owner-api.mjs';
import { listConnections } from '../../lib/capability-connections.mjs';
import { buildConnectorDiagnostics } from '../../lib/connector-diagnostics.mjs';

const OWNER_ID = 'owner';
const REGISTRY_PROVIDER_IDS = Object.freeze({
  instagram: 'instagram',
  facebook_pages: 'facebook-pages',
  github: 'github',
  cloudflare: 'cloudflare',
  composio: 'composio',
  krystal: 'krystal',
  oracle_cloud: 'oracle-cloud',
});

function isDatabaseAvailable(env) {
  return Boolean(env?.AEGIS_DB && typeof env.AEGIS_DB.prepare === 'function');
}

function registryObservations(connections, now) {
  const byProvider = new Map();
  for (const connection of connections) {
    const providerId = Object.entries(REGISTRY_PROVIDER_IDS)
      .find(([, registryId]) => registryId === connection.providerId)?.[0];
    if (!providerId || byProvider.has(providerId)) continue;
    const expired = connection.expiresAt && Date.parse(connection.expiresAt) <= now;
    byProvider.set(providerId, {
      credentialStored: true,
      revoked: connection.status === 'revoked',
      expiresAt: connection.expiresAt,
      // Vault storage is not proof of a provider health check. Keep it pending
      // until a provider-specific adapter verifies identity, role and scopes.
      configurationValid: connection.status === 'active' && !expired ? false : undefined,
      lastErrorCode: connection.status === 'active' && !expired ? 'INVALID_CONFIGURATION' : null,
    });
  }
  return Object.fromEntries(byProvider);
}

/**
 * Owner-only, read-only diagnostics catalogue. It reports vault metadata as
 * pending configuration, never as a verified provider connection.
 */
export async function onRequestGet({ request, env }) {
  const denied = await authorizeOwner(request, env);
  if (denied) return denied;

  const now = Date.now();
  let observations = {};
  const storageConfigured = isDatabaseAvailable(env);

  if (storageConfigured) {
    try {
      const connections = await listConnections(env.AEGIS_DB, OWNER_ID, 100);
      observations = registryObservations(connections, now);
    } catch {
      return jsonResponse({ error: 'Connector diagnostics are temporarily unavailable.' }, 503);
    }
  }

  return jsonResponse({
    connectors: buildConnectorDiagnostics(observations, now),
    storageConfigured,
    liveChecksEnabled: false,
    executionEnabled: false,
    writesEnabled: false,
  });
}
