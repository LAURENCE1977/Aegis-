import { loadConnection } from './capability-connections.mjs';
import { resolveVaultSecret } from './secret-vault.mjs';
import { createComposioClient } from './composio-client.mjs';

const CAPABILITY_ID = 'aegis-composio-github-readonly';
const ACTION_ID = 'get-repository';
const CONNECTION_SCOPE = 'composio:github:repository:read';
const GRANT_SCOPE = 'github:repository:read';
const TOOL_SLUG = 'GITHUB_GET_A_REPOSITORY';

function exactKeys(value, keys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    Object.keys(value).every((key) => keys.includes(key));
}

function validateRepositoryInput(input) {
  if (!exactKeys(input, ['owner', 'repo'])) {
    throw new TypeError('Composio repository lookup requires exactly owner and repo');
  }
  if (typeof input.owner !== 'string' ||
      !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(input.owner)) {
    throw new TypeError('Invalid GitHub owner');
  }
  if (typeof input.repo !== 'string' || !/^[A-Za-z0-9_.-]{1,100}$/.test(input.repo)) {
    throw new TypeError('Invalid GitHub repository name');
  }
}

function safeString(value, maxLength = 500) {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength
    ? value : undefined;
}

function safeRepositoryResult(data, owner, repo) {
  if (!data || typeof data !== 'object' || Array.isArray(data) ||
      typeof data.full_name !== 'string' ||
      data.full_name.toLowerCase() !== (owner + '/' + repo).toLowerCase() ||
      typeof data.name !== 'string' || data.name.length > 100 ||
      typeof data.private !== 'boolean') {
    throw new Error('Composio returned repository metadata outside the exact requested resource');
  }

  const repository = {
    name: data.name,
    fullName: data.full_name,
    private: data.private,
  };

  if (Number.isSafeInteger(data.id) && data.id > 0) repository.id = data.id;
  const url = safeString(data.html_url, 2048);
  if (url) {
    let parsed;
    try { parsed = new URL(url); } catch { throw new Error('Composio returned an invalid repository URL'); }
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'github.com' ||
        parsed.username || parsed.password || parsed.port) {
      throw new Error('Composio returned an invalid repository URL');
    }
    repository.url = parsed.toString();
  }
  const description = safeString(data.description, 1000);
  if (description !== undefined) repository.description = description;
  if (typeof data.archived === 'boolean') repository.archived = data.archived;
  if (typeof data.fork === 'boolean') repository.fork = data.fork;
  const defaultBranch = safeString(data.default_branch, 128);
  if (defaultBranch !== undefined) repository.defaultBranch = defaultBranch;
  if (Number.isSafeInteger(data.stargazers_count) && data.stargazers_count >= 0) {
    repository.stars = data.stargazers_count;
  }
  const language = safeString(data.language, 100);
  if (language !== undefined) repository.language = language;
  if (data.license && typeof data.license === 'object' && !Array.isArray(data.license)) {
    const name = safeString(data.license.name, 160);
    const spdxId = safeString(data.license.spdx_id, 100);
    if (name || spdxId) {
      repository.licence = {
        ...(name ? { name } : {}),
        ...(spdxId ? { spdxId } : {}),
      };
    }
  }

  return repository;
}

/**
 * Fixed Composio adapter set. This handler is intended to be called only by
 * Sentinel after the exact grant, connection, rate limit and audit checks pass.
 * It reloads the owner connection and resolves the vault secret inside trusted
 * server code; no Composio key, session URL or OAuth credential reaches an agent.
 */
export function createComposioAdapterRegistry({ db, env, fetchImpl = fetch } = {}) {
  if (!db || typeof db.prepare !== 'function') {
    throw new TypeError('Composio adapter requires the AEGIS D1 database');
  }
  if (!env || typeof env !== 'object') {
    throw new TypeError('Composio adapter requires server environment bindings');
  }
  if (typeof fetchImpl !== 'function') throw new TypeError('A fetch implementation is required');

  const handler = async (input, context = {}) => {
    validateRepositoryInput(input);
    if (context.capabilityId !== CAPABILITY_ID || context.actionId !== ACTION_ID ||
        typeof context.principalId !== 'string' || !context.principalId ||
        typeof context.connectionId !== 'string' || !context.connectionId ||
        !Array.isArray(context.scopes) || !context.scopes.includes(GRANT_SCOPE)) {
      throw new Error('Composio invocation context is not authorised');
    }

    const expectedResource = 'github:repository:' + input.owner + '/' + input.repo;
    if (context.resourceId !== expectedResource) {
      throw new Error('Composio invocation resource does not match the exact repository');
    }

    const connection = await loadConnection(db, {
      principalId: context.principalId,
      providerId: 'composio',
    });
    if (!connection || connection.id !== context.connectionId ||
        !connection.scopes.includes(CONNECTION_SCOPE)) {
      throw new Error('The exact active Composio connection is unavailable');
    }

    const stored = await resolveVaultSecret(db, {
      principalId: context.principalId,
      providerId: 'composio',
      secretRef: connection.secretRef,
    }, env);
    let session;
    try { session = JSON.parse(stored || ''); } catch {
      throw new Error('The Composio session reference is unavailable');
    }
    if (!exactKeys(session, ['sessionId', 'connectedAccountId'])) {
      throw new Error('The Composio session reference is invalid');
    }

    const client = createComposioClient({
      apiKey: env.COMPOSIO_API_KEY,
      fetchImpl,
      timeoutMs: 8000,
      maxResponseBytes: 64 * 1024,
    });
    const connected = await client.getGitHubConnectionStatus({
      sessionId: session.sessionId,
      connectedAccountId: session.connectedAccountId,
    });
    if (!connected) throw new Error('The Composio GitHub account is not active');

    const tools = await client.listSessionTools({ sessionId: session.sessionId });
    if (tools.length !== 1 || tools[0] !== TOOL_SLUG) {
      throw new Error('Composio session tool allowlist does not match the approved capability');
    }

    const result = await client.executeGitHubGetRepository({
      sessionId: session.sessionId,
      connectedAccountId: session.connectedAccountId,
      owner: input.owner,
      repo: input.repo,
    });
    return {
      repository: safeRepositoryResult(result.data, input.owner, input.repo),
      provider: 'composio',
      logId: result.logId,
    };
  };

  return Object.freeze({
    [CAPABILITY_ID + ':' + ACTION_ID]: handler,
  });
}
