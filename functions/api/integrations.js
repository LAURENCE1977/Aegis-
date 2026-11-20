import { authorizeOwner, jsonResponse } from '../lib/owner-api.mjs';
import {
  listIntegrationConnections,
  listIntegrationDefinitions,
  listIntegrationProviders,
} from '../lib/integration-inventory.mjs';

const OWNER_ID = 'owner';

function publicProvider(provider) {
  return {
    id: provider.id,
    displayName: provider.displayName,
    sourceUrl: provider.sourceUrl,
    verifiedAt: provider.verifiedAt,
    status: provider.status,
  };
}

function publicIntegration(integration) {
  return {
    id: integration.id,
    providerId: integration.providerId,
    slug: integration.slug,
    displayName: integration.displayName,
    description: integration.description,
    authMode: integration.authMode,
    sourceUrl: integration.sourceUrl,
    schemaVersion: integration.schemaVersion,
    schemaHash: integration.schemaHash,
    status: integration.status,
  };
}

function publicConnection(connection) {
  return {
    id: connection.id,
    integrationId: connection.integrationId,
    connectionKey: connection.connectionKey,
    connectionType: connection.connectionType,
    authMode: connection.authMode,
    accountAlias: connection.accountAlias,
    allowedToolSlugs: connection.allowedToolSlugs,
    scopes: connection.scopes,
    status: connection.status,
    lastObservedAt: connection.lastObservedAt,
    healthState: connection.healthState,
    healthCheckedAt: connection.healthCheckedAt,
  };
}

export async function onRequestGet({ request, env }) {
  const denied = await authorizeOwner(request, env);
  if (denied) return denied;
  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== 'function') {
    return jsonResponse({ error: 'Integration inventory storage is not configured.' }, 503);
  }

  try {
    const [providers, integrations, connections] = await Promise.all([
      listIntegrationProviders(env.AEGIS_DB, 100),
      listIntegrationDefinitions(env.AEGIS_DB, 200),
      listIntegrationConnections(env.AEGIS_DB, OWNER_ID, 100),
    ]);
    return jsonResponse({
      providers: providers.map(publicProvider),
      integrations: integrations.map(publicIntegration),
      connections: connections.map(publicConnection),
      total: {
        providers: providers.length,
        integrations: integrations.length,
        connections: connections.length,
      },
    });
  } catch {
    return jsonResponse({ error: 'Integration inventory is temporarily unavailable.' }, 503);
  }
}
