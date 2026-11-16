import {
  authorizeOwner,
  isOwnerWriteRequest,
  jsonResponse,
  readJsonRequest,
} from '../../lib/owner-api.mjs';
import {
  createConnection,
  loadConnection,
  revokeConnection,
} from '../../lib/capability-connections.mjs';
import {
  storeVaultSecret,
  resolveVaultSecret,
  revokeVaultSecret,
} from '../../lib/secret-vault.mjs';
import { createComposioClient } from '../../lib/composio-client.mjs';

const OWNER_ID = 'owner';
const PROVIDER_ID = 'composio';
const CONNECTION_SCOPE = 'composio:github-repository:read';

function exactKeys(value, keys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    Object.keys(value).every((key) => keys.includes(key));
}

function publicConnection(connection) {
  return {
    id: connection.id,
    providerId: connection.providerId,
    scopes: connection.scopes,
    status: connection.status,
    createdAt: connection.createdAt,
    expiresAt: connection.expiresAt,
  };
}

function configured(env) {
  return Boolean(
    env?.AEGIS_DB && typeof env.AEGIS_DB.prepare === 'function' &&
    typeof env.COMPOSIO_API_KEY === 'string' && env.COMPOSIO_API_KEY.trim() &&
    typeof env.AEGIS_VAULT_KEYRING === 'string' &&
    typeof env.AEGIS_VAULT_ACTIVE_KEY_VERSION === 'string',
  );
}

async function loadSession(db, env, connection) {
  const stored = await resolveVaultSecret(db, {
    principalId: OWNER_ID,
    providerId: PROVIDER_ID,
    secretRef: connection.secretRef,
  }, env);
  let session;
  try { session = JSON.parse(stored || ''); } catch {
    throw new Error('Composio session reference is unavailable');
  }
  if (!exactKeys(session, ['sessionId', 'connectedAccountId'])) {
    throw new Error('Composio session reference is invalid');
  }
  return session;
}

export async function onRequestGet({ request, env }) {
  const denied = await authorizeOwner(request, env);
  if (denied) return denied;
  if (!configured(env)) {
    return jsonResponse({ error: 'Composio connection storage or server secret is not configured.' }, 503);
  }

  try {
    const connection = await loadConnection(env.AEGIS_DB, {
      principalId: OWNER_ID,
      providerId: PROVIDER_ID,
    });
    if (!connection) return jsonResponse({ configured: false, connected: false });

    const session = await loadSession(env.AEGIS_DB, env, connection);
    const client = createComposioClient({ apiKey: env.COMPOSIO_API_KEY });
    const connected = await client.getGitHubConnectionStatus(session);
    return jsonResponse({
      configured: true,
      connected,
      connection: publicConnection(connection),
    });
  } catch {
    return jsonResponse({ error: 'Composio connection status is temporarily unavailable.' }, 503);
  }
}

export async function onRequestPost({ request, env }) {
  const denied = await authorizeOwner(request, env);
  if (denied) return denied;
  if (!isOwnerWriteRequest(request)) {
    return jsonResponse({ error: 'Invalid request origin.' }, 403);
  }
  if (!configured(env)) {
    return jsonResponse({ error: 'Composio API key, vault and connection storage must be configured server-side.' }, 503);
  }

  const parsed = await readJsonRequest(request, 512);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status);
  if (!exactKeys(parsed.body, []) ) {
    return jsonResponse({ error: 'This setup endpoint accepts an empty JSON object only.' }, 400);
  }

  let sessionId = null;
  let secretRef = null;
  const callbackOrigin = new URL(request.url).origin;
  const callbackUrl = new URL('/?composio=connected', request.url).toString();
  const client = createComposioClient({
    apiKey: env.COMPOSIO_API_KEY,
    callbackOrigin,
  });
  try {
    const existing = await loadConnection(env.AEGIS_DB, {
      principalId: OWNER_ID,
      providerId: PROVIDER_ID,
    });
    if (existing) {
      return jsonResponse({ error: 'A Composio GitHub connection already exists.' }, 409);
    }

    const session = await client.createReadOnlyGitHubSession({ userId: OWNER_ID });
    sessionId = session.sessionId;
    const link = await client.createGitHubLink({ sessionId, callbackUrl });

    const stored = await storeVaultSecret(env.AEGIS_DB, {
      principalId: OWNER_ID,
      providerId: PROVIDER_ID,
      secret: JSON.stringify({
        sessionId,
        connectedAccountId: link.connectedAccountId,
      }),
    }, env);
    secretRef = stored.secretRef;

    const connection = await createConnection(env.AEGIS_DB, {
      principalId: OWNER_ID,
      providerId: PROVIDER_ID,
      secretRef,
      scopes: [CONNECTION_SCOPE],
      createdBy: OWNER_ID,
    });

    return jsonResponse({
      connection: publicConnection(connection),
      redirectUrl: link.redirectUrl,
      connected: false,
    }, 201);
  } catch (error) {
    if (secretRef) {
      try {
        await revokeVaultSecret(env.AEGIS_DB, {
          principalId: OWNER_ID,
          providerId: PROVIDER_ID,
          secretRef,
        });
      } catch {}
    }
    if (sessionId) {
      try { await client.deleteSession({ sessionId }); } catch {}
    }
    if (/already exists|unique constraint/i.test(error?.message || '')) {
      return jsonResponse({ error: 'A Composio GitHub connection already exists.' }, 409);
    }
    return jsonResponse({ error: 'Composio GitHub connection setup failed.' }, 502);
  }
}

export async function onRequestDelete({ request, env }) {
  const denied = await authorizeOwner(request, env);
  if (denied) return denied;
  if (!isOwnerWriteRequest(request)) {
    return jsonResponse({ error: 'Invalid request origin.' }, 403);
  }
  if (!configured(env)) {
    return jsonResponse({ error: 'Composio connection storage or server secret is not configured.' }, 503);
  }

  try {
    const connection = await loadConnection(env.AEGIS_DB, {
      principalId: OWNER_ID,
      providerId: PROVIDER_ID,
    });
    if (!connection) return jsonResponse({ error: 'Active Composio connection was not found.' }, 404);

    let session = null;
    try { session = await loadSession(env.AEGIS_DB, env, connection); } catch {}
    if (session) {
      const client = createComposioClient({ apiKey: env.COMPOSIO_API_KEY });
      try { await client.deleteSession({ sessionId: session.sessionId }); } catch {}
    }

    const revoked = await revokeConnection(env.AEGIS_DB, connection.id, OWNER_ID);
    if (!revoked) return jsonResponse({ error: 'Composio connection could not be revoked.' }, 409);
    await revokeVaultSecret(env.AEGIS_DB, {
      principalId: OWNER_ID,
      providerId: PROVIDER_ID,
      secretRef: connection.secretRef,
    });

    return jsonResponse({
      revoked: true,
      id: connection.id,
      note: 'AEGIS access and its Composio session were revoked. The GitHub OAuth grant itself may remain in Composio until separately disconnected there.',
    });
  } catch {
    return jsonResponse({ error: 'Composio connection could not be revoked.' }, 503);
  }
}
