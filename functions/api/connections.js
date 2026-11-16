import { authConfigAvailable, isAuthorized, isSameOriginRequest } from '../lib/auth.mjs';
import { jsonResponse, readJsonRequest } from '../lib/owner-api.mjs';
import { getCapabilityManifest } from '../lib/capability-registry.mjs';
import {
  createConnection,
  listConnections,
  loadConnectionById,
  revokeConnection,
} from '../lib/capability-connections.mjs';
import { storeVaultSecret, revokeVaultSecret } from '../lib/secret-vault.mjs';

const OWNER_ID = 'owner';
const ALLOWED_PROVIDERS = new Set(['github']);
const MAX_BODY_BYTES = 20 * 1024;
const MAX_TTL_MS = 365 * 24 * 60 * 60 * 1000;

function exactKeys(value, keys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}

function safeConnection(connection) {
  if (!connection) return null;
  const { secretRef: _secretRef, ...safe } = connection;
  return safe;
}

function deriveScopes({ providerId, capabilityId, actionIds, expiresAt, secret }, now) {
  if (typeof providerId !== 'string' || !ALLOWED_PROVIDERS.has(providerId)) {
    throw new TypeError('This provider is not enabled for connections.');
  }
  const manifest = getCapabilityManifest(capabilityId);
  if (!manifest || manifest.status !== 'approved' || manifest.auth.mode !== 'oauth2' ||
      manifest.provider.id !== providerId) {
    throw new TypeError('Select an approved capability that requires this provider connection.');
  }
  if (!Array.isArray(actionIds) || actionIds.length < 1 || actionIds.length > 10 ||
      actionIds.some(id => typeof id !== 'string') || new Set(actionIds).size !== actionIds.length) {
    throw new TypeError('Select one or more valid capability actions.');
  }
  const scopes = [];
  for (const actionId of actionIds) {
    const action = manifest.actions.find(item => item.id === actionId);
    if (!action || !action.requiredScopes.length) {
      throw new TypeError('The selected action does not declare connection scopes.');
    }
    scopes.push(...action.requiredScopes);
  }
  const uniqueScopes = [...new Set(scopes)];
  if (!uniqueScopes.length) throw new TypeError('The selected actions do not require provider scopes.');

  if (typeof expiresAt !== 'string' || !Number.isFinite(Date.parse(expiresAt))) {
    throw new TypeError('A valid connection expiry is required.');
  }
  const expiry = Date.parse(expiresAt);
  if (expiry <= now || expiry > now + MAX_TTL_MS) {
    throw new TypeError('Connection expiry must be within the next 365 days.');
  }
  if (typeof secret !== 'string' || !secret.trim() || new TextEncoder().encode(secret).byteLength > 16 * 1024) {
    throw new TypeError('The provider credential must be non-empty and no larger than 16 KiB.');
  }
  return { scopes: uniqueScopes, manifest };
}

export async function onRequestGet({ request, env }) {
  if (!authConfigAvailable(env)) return jsonResponse({ error: 'Authentication is not configured.' }, 503);
  if (!(await isAuthorized(request, env))) return jsonResponse({ error: 'Authentication required.' }, 401);
  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== 'function') {
    return jsonResponse({ error: 'Connection storage is not configured.' }, 503);
  }
  try {
    const connections = await listConnections(env.AEGIS_DB, OWNER_ID, 50);
    return jsonResponse({ connections });
  } catch {
    return jsonResponse({ error: 'Connections could not be loaded.' }, 503);
  }
}

export async function onRequestPost({ request, env }) {
  if (!authConfigAvailable(env)) return jsonResponse({ error: 'Authentication is not configured.' }, 503);
  if (!(await isAuthorized(request, env))) return jsonResponse({ error: 'Authentication required.' }, 401);
  if (!isSameOriginRequest(request)) return jsonResponse({ error: 'Cross-origin request rejected.' }, 403);
  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== 'function') {
    return jsonResponse({ error: 'Connection storage is not configured.' }, 503);
  }

  const parsed = await readJsonRequest(request, MAX_BODY_BYTES);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status);
  const body = parsed.body;
  if (!exactKeys(body, ['providerId', 'capabilityId', 'actionIds', 'secret', 'expiresAt'])) {
    return jsonResponse({ error: 'Provide only providerId, capabilityId, actionIds, secret and expiresAt.' }, 400);
  }

  const now = Date.now();
  let derived;
  try { derived = deriveScopes(body, now); }
  catch (error) { return jsonResponse({ error: error.message }, 400); }

  let stored;
  try {
    stored = await storeVaultSecret(env.AEGIS_DB, {
      principalId: OWNER_ID,
      providerId: body.providerId,
      secret: body.secret,
    }, env, now);
  } catch {
    return jsonResponse({ error: 'The encrypted vault is not configured or could not store this credential.' }, 503);
  }

  try {
    const connection = await createConnection(env.AEGIS_DB, {
      principalId: OWNER_ID,
      providerId: body.providerId,
      secretRef: stored.secretRef,
      scopes: derived.scopes,
      createdBy: OWNER_ID,
      expiresAt: body.expiresAt,
    }, now);
    return jsonResponse({ connection: safeConnection(connection) }, 201);
  } catch (error) {
    try {
      await revokeVaultSecret(env.AEGIS_DB, {
        principalId: OWNER_ID,
        providerId: body.providerId,
        secretRef: stored.secretRef,
      }, Date.now());
    } catch {}
    if (String(error?.message || '').includes('active connection already exists')) {
      return jsonResponse({ error: 'An active connection already exists for this provider.' }, 409);
    }
    return jsonResponse({ error: 'Connection metadata could not be created.' }, 503);
  }
}

export async function onRequestDelete({ request, env }) {
  if (!authConfigAvailable(env)) return jsonResponse({ error: 'Authentication is not configured.' }, 503);
  if (!(await isAuthorized(request, env))) return jsonResponse({ error: 'Authentication required.' }, 401);
  if (!isSameOriginRequest(request)) return jsonResponse({ error: 'Cross-origin request rejected.' }, 403);
  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== 'function') {
    return jsonResponse({ error: 'Connection storage is not configured.' }, 503);
  }

  const parsed = await readJsonRequest(request, 1024);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status);
  if (!exactKeys(parsed.body, ['id']) || typeof parsed.body.id !== 'string') {
    return jsonResponse({ error: 'Provide only the connection ID.' }, 400);
  }

  let connection;
  try {
    connection = await loadConnectionById(env.AEGIS_DB, { id: parsed.body.id, principalId: OWNER_ID });
  } catch {
    return jsonResponse({ error: 'Connection could not be verified.' }, 503);
  }
  if (!connection) return jsonResponse({ error: 'Connection not found.' }, 404);

  let vaultErased = false;
  try {
    vaultErased = await revokeVaultSecret(env.AEGIS_DB, {
      principalId: OWNER_ID,
      providerId: connection.providerId,
      secretRef: connection.secretRef,
    }, Date.now());
  } catch {}

  let connectionRevoked = false;
  try {
    connectionRevoked = await revokeConnection(env.AEGIS_DB, connection.id, OWNER_ID, Date.now());
  } catch {}
  if (!connectionRevoked && connection.status === 'active') {
    try {
      const current = await loadConnectionById(env.AEGIS_DB, { id: connection.id, principalId: OWNER_ID });
      connectionRevoked = current?.status === 'revoked';
    } catch {}
  }
  if (!connectionRevoked && connection.status !== 'revoked') {
    return jsonResponse({ error: 'Connection revocation could not be confirmed.' }, 503);
  }

  return jsonResponse({
    revoked: true,
    vaultErased,
    ...(vaultErased ? {} : { warning: 'The connection is disabled, but vault erasure could not be confirmed.' }),
  });
}
