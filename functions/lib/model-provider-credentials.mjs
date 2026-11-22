import { loadConnection } from './capability-connections.mjs';
import { resolveVaultSecret } from './secret-vault.mjs';

const OWNER_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const VAULT_BACKED_CHAT_PROVIDERS = new Set(['anthropic', 'alibaba-qwen', 'apinex']);

/**
 * Resolve one owner-owned provider key for the trusted model gateway.
 * This module is server-only: never return its result to an API response,
 * browser state, model prompt, tool input or audit record.
 */
export async function resolveConnectedProviderCredential({
  db,
  env,
  principalId = 'owner',
  providerId,
  now = Date.now(),
} = {}) {
  if (!db || typeof db.prepare !== 'function') {
    throw new TypeError('Provider credential database is required');
  }
  if (!env || typeof env !== 'object' || Array.isArray(env)) {
    throw new TypeError('Provider credential environment is required');
  }
  if (typeof principalId !== 'string' || !OWNER_ID_PATTERN.test(principalId)) {
    throw new TypeError('Invalid provider credential principal');
  }
  if (!VAULT_BACKED_CHAT_PROVIDERS.has(providerId)) {
    throw new TypeError('Provider does not have a vault-backed chat adapter');
  }
  if (!Number.isFinite(now)) throw new TypeError('Invalid provider credential clock');

  const connection = await loadConnection(db, { principalId, providerId }, now);
  if (!connection) {
    // Once the owner has created a connection, revocation/expiry must not
    // silently reactivate a legacy environment credential for this provider.
    const historical = await db.prepare(`
      SELECT id, status, revoked_at, expires_at
      FROM capability_connections
      WHERE principal_id = ? AND provider_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `).bind(principalId, providerId).first();
    if (historical) {
      throw new Error('Provider connection is inactive; legacy environment fallback is disabled');
    }
    return null;
  }

  const requiredScope = providerId + ':inference:chat';
  if (!Array.isArray(connection.scopes) || !connection.scopes.includes(requiredScope)) {
    throw new Error('Provider connection does not grant the required chat inference scope');
  }
  if (typeof connection.secretRef !== 'string' || !connection.secretRef.startsWith('vault://connections/')) {
    throw new Error('Provider connection has no valid vault reference');
  }

  let apiKey;
  try {
    apiKey = await resolveVaultSecret(db, {
      principalId,
      providerId,
      secretRef: connection.secretRef,
    }, env);
  } catch {
    throw new Error('Connected provider credential could not be resolved from the vault');
  }
  if (typeof apiKey !== 'string' || apiKey.length < 16 || apiKey.length > 4096 ||
      /[\r\n\u0000]/.test(apiKey)) {
    throw new Error('Connected provider credential is unavailable or invalid');
  }

  return Object.freeze({
    connectionId: connection.id,
    apiKey,
  });
}
