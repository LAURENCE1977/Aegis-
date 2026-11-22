import {
  authorizeOwner,
  isOwnerWriteRequest,
  jsonResponse,
  readJsonRequest,
} from "../lib/owner-api.mjs";
import {
  createConnection,
  listConnections,
  loadConnection,
  revokeConnection,
} from "../lib/capability-connections.mjs";
import {
  storeVaultSecret,
  revokeVaultSecret,
} from "../lib/secret-vault.mjs";

const OWNER_ID = "owner";
const MAX_BODY_BYTES = 8192;
const PROVIDERS = Object.freeze([
  { id: "openrouter", name: "OpenRouter" },
  { id: "anthropic", name: "Anthropic" },
  { id: "openai", name: "OpenAI" },
  { id: "google-ai-studio", name: "Google AI Studio" },
  { id: "xai", name: "xAI" },
  { id: "deepseek", name: "DeepSeek" },
  { id: "nebius", name: "Nebius" },
  { id: "alibaba-qwen", name: "Alibaba Qwen" },
  { id: "axforge", name: "AxForge" },
]);
const PROVIDER_IDS = new Set(PROVIDERS.map(provider => provider.id));
const VAULT_BACKED_CHAT_PROVIDERS = new Set(["anthropic", "alibaba-qwen"]);

function databaseAvailable(env) {
  return Boolean(env?.AEGIS_DB && typeof env.AEGIS_DB.prepare === "function");
}

export async function onRequestGet({ request, env }) {
  const denied = await authorizeOwner(request, env);
  if (denied) return denied;
  if (!databaseAvailable(env)) {
    return jsonResponse({ error: "Provider connection storage is not configured." }, 503);
  }

  try {
    const saved = await listConnections(env.AEGIS_DB, OWNER_ID, 100);
    const byProvider = new Map();
    // listConnections is newest-first; keep the first record for each provider.
    for (const connection of saved) {
      if (PROVIDER_IDS.has(connection.providerId) && !byProvider.has(connection.providerId)) {
        byProvider.set(connection.providerId, connection);
      }
    }
    const providers = PROVIDERS.map(provider => {
      const connection = byProvider.get(provider.id);
      return {
        ...provider,
        connectionStatus: connection?.status === "active" ? "stored" : "not_configured",
        inferenceStatus: VAULT_BACKED_CHAT_PROVIDERS.has(provider.id) ? "vault_backed_chat" : "vault_only",
        createdAt: connection?.createdAt ?? null,
        expiresAt: connection?.expiresAt ?? null,
      };
    });
    return jsonResponse({
      providers,
      connections: saved.filter(connection => PROVIDER_IDS.has(connection.providerId)),
      runtimeStatus: "vault_only",
    });
  } catch {
    return jsonResponse({ error: "Provider connections are temporarily unavailable." }, 503);
  }
}

export async function onRequestPost({ request, env }) {
  const denied = await authorizeOwner(request, env);
  if (denied) return denied;
  if (!isOwnerWriteRequest(request)) {
    return jsonResponse({ error: "Invalid request origin." }, 403);
  }
  if (!databaseAvailable(env)) {
    return jsonResponse({ error: "Provider connection storage is not configured." }, 503);
  }

  const parsed = await readJsonRequest(request, MAX_BODY_BYTES);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status);
  const body = parsed.body;
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).some(key => !["providerId", "apiKey"].includes(key)) ||
      typeof body.providerId !== "string" || !PROVIDER_IDS.has(body.providerId) ||
      typeof body.apiKey !== "string" || body.apiKey.length < 16 ||
      body.apiKey.length > 4096 || body.apiKey !== body.apiKey.trim() ||
      /[\r\n\u0000]/.test(body.apiKey)) {
    return jsonResponse({ error: "A supported provider and valid API key are required." }, 400);
  }

  let stored;
  try {
    stored = await storeVaultSecret(env.AEGIS_DB, {
      principalId: OWNER_ID,
      providerId: body.providerId,
      secret: body.apiKey,
    }, env);
  } catch {
    return jsonResponse({ error: "The encrypted credential vault is unavailable or not configured." }, 503);
  }

  try {
    const connection = await createConnection(env.AEGIS_DB, {
      principalId: OWNER_ID,
      providerId: body.providerId,
      secretRef: stored.secretRef,
      scopes: [body.providerId + ":inference:chat"],
      createdBy: "owner",
    });
    return jsonResponse({
      connection: {
        id: connection.id,
        providerId: connection.providerId,
        status: connection.status,
        createdAt: connection.createdAt,
        expiresAt: connection.expiresAt,
      },
      runtimeStatus: VAULT_BACKED_CHAT_PROVIDERS.has(body.providerId) ? "vault_backed_chat" : "vault_only",
      message: VAULT_BACKED_CHAT_PROVIDERS.has(body.providerId)
        ? "Credential encrypted and stored. The server-side chat adapter can use it when this provider is selected."
        : "Credential encrypted and stored. This provider is not yet connected to live model inference.",
    }, 201);
  } catch (error) {
    try {
      await revokeVaultSecret(env.AEGIS_DB, {
        principalId: OWNER_ID,
        providerId: body.providerId,
        secretRef: stored.secretRef,
      });
    } catch {
      return jsonResponse({ error: "Connection setup failed; vault cleanup needs attention." }, 503);
    }
    if (/already exists|unique constraint|sqlite_constraint/i.test(String(error?.message || ""))) {
      return jsonResponse({ error: "A connection already exists for this provider. Revoke it before replacing the key." }, 409);
    }
    return jsonResponse({ error: "Provider connection could not be saved." }, 503);
  }
}

export async function onRequestDelete({ request, env }) {
  const denied = await authorizeOwner(request, env);
  if (denied) return denied;
  if (!isOwnerWriteRequest(request)) {
    return jsonResponse({ error: "Invalid request origin." }, 403);
  }
  if (!databaseAvailable(env)) {
    return jsonResponse({ error: "Provider connection storage is not configured." }, 503);
  }

  const parsed = await readJsonRequest(request, 2048);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status);
  const body = parsed.body;
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).some(key => key !== "providerId") ||
      typeof body.providerId !== "string" || !PROVIDER_IDS.has(body.providerId)) {
    return jsonResponse({ error: "A supported provider ID is required." }, 400);
  }

  try {
    const connection = await loadConnection(env.AEGIS_DB, {
      principalId: OWNER_ID,
      providerId: body.providerId,
    });
    if (!connection) return jsonResponse({ error: "Provider connection not found." }, 404);

    // Erase the encrypted credential before retiring its metadata reference.
    await revokeVaultSecret(env.AEGIS_DB, {
      principalId: OWNER_ID,
      providerId: body.providerId,
      secretRef: connection.secretRef,
    });
    const revoked = await revokeConnection(env.AEGIS_DB, connection.id, OWNER_ID);
    if (!revoked) return jsonResponse({ error: "Provider connection changed before revocation." }, 409);
    return jsonResponse({ revoked: true, providerId: body.providerId });
  } catch {
    return jsonResponse({ error: "Provider connection could not be revoked." }, 503);
  }
}
