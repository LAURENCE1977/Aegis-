const API_ORIGIN = 'https://backend.composio.dev';
const SESSION_ID_PATTERN = /^trs_[A-Za-z0-9_-]{6,128}$/;
const ACCOUNT_ID_PATTERN = /^ca_[A-Za-z0-9_-]{6,128}$/;
const TOOL_SLUG = 'GITHUB_GET_A_REPOSITORY';
const MAX_API_KEY_LENGTH = 4096;
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_MAX_RESPONSE_BYTES = 64 * 1024;

function requireText(value, label, maxLength = 256) {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength ||
      /[\u0000-\u001f\u007f]/.test(value)) {
    throw new TypeError('Invalid Composio ' + label);
  }
}

function requireSessionId(value) {
  if (typeof value !== 'string' || !SESSION_ID_PATTERN.test(value)) {
    throw new TypeError('Invalid Composio session ID');
  }
}

function validateRepositoryPart(value, label, pattern) {
  if (typeof value !== 'string' || !pattern.test(value)) {
    throw new TypeError('Invalid GitHub ' + label);
  }
}

async function readBoundedJson(response, maxBytes) {
  const contentType = response.headers?.get?.('content-type') || '';
  if (!/application\/json(?:\s*;|$)/i.test(contentType)) {
    await response.body?.cancel();
    throw new Error('Composio returned a non-JSON response');
  }

  const declaredLength = Number(response.headers?.get?.('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    await response.body?.cancel();
    throw new Error('Composio response exceeds the configured size limit');
  }
  if (!response.body) throw new Error('Composio response body is unavailable');

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error('Composio response exceeds the configured size limit');
      }
      chunks.push(value);
    }
  } catch (error) {
    try { await reader.cancel(); } catch {}
    throw error;
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error('Composio returned invalid UTF-8');
  }
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Invalid JSON object');
    }
    return parsed;
  } catch {
    throw new Error('Composio returned invalid JSON');
  }
}

function validateRedirectUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new TypeError('Invalid Composio redirect URL'); }
  if (url.protocol !== 'https:' ||
      !['app.composio.dev', 'connect.composio.dev'].includes(url.hostname) ||
      url.port || url.username || url.password) {
    throw new TypeError('Composio redirect URL is not allowlisted');
  }
  return url.toString();
}

/**
 * Small server-side Composio Sessions API client.
 *
 * It deliberately exposes one fixed, read-only GitHub tool. It does not
 * expose arbitrary API paths, tool slugs, MCP URLs, headers or provider errors.
 * Call it only from trusted server code after AEGIS Sentinel has authorised
 * the exact resource and action.
 */
export function createComposioClient({
  apiKey,
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxResponseBytes = DEFAULT_MAX_RESPONSE_BYTES,
} = {}) {
  if (typeof apiKey !== 'string' || !apiKey.trim() ||
      apiKey.length > MAX_API_KEY_LENGTH || /[\r\n\u0000]/.test(apiKey)) {
    throw new TypeError('A server-side Composio API key is required');
  }
  if (typeof fetchImpl !== 'function') throw new TypeError('A fetch implementation is required');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 120000) {
    throw new TypeError('Invalid Composio timeout');
  }
  if (!Number.isInteger(maxResponseBytes) || maxResponseBytes < 1024 || maxResponseBytes > 1024 * 1024) {
    throw new TypeError('Invalid Composio response size limit');
  }

  async function requestJson(path, { method = 'GET', body } = {}) {
    const options = {
      method,
      headers: {
        Accept: 'application/json',
        'x-api-key': apiKey,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
    };
    if (body !== undefined) options.body = JSON.stringify(body);

    let response;
    try {
      response = await fetchImpl(API_ORIGIN + path, options);
    } catch {
      throw new Error('Composio request failed');
    }
    if (!response || !response.ok) {
      await response?.body?.cancel();
      const status = Number.isInteger(response?.status) ? response.status : 0;
      throw new Error('Composio request failed (' + status + ')');
    }
    return readBoundedJson(response, maxResponseBytes);
  }

  return Object.freeze({
    async createReadOnlyGitHubSession({ userId } = {}) {
      requireText(userId, 'user ID', 128);
      const result = await requestJson('/api/v3.1/tool_router/session', {
        method: 'POST',
        body: {
          user_id: userId,
          toolkits: { enable: ['github'] },
          tools: { github: { enable: [TOOL_SLUG] } },
          manage_connections: { enable: false },
          workbench: { enable: false },
          search: { enable: false },
          execute: { enable_multi_execute: false },
          preload: { tools: [TOOL_SLUG] },
        },
      });
      requireSessionId(result.session_id);
      return { sessionId: result.session_id };
    },

    async createGitHubLink({ sessionId } = {}) {
      requireSessionId(sessionId);
      const result = await requestJson(
        '/api/v3.1/tool_router/session/' + encodeURIComponent(sessionId) + '/link',
        { method: 'POST', body: { toolkit: 'github' } },
      );
      const redirectUrl = validateRedirectUrl(result.redirect_url);
      if (typeof result.connected_account_id !== 'string' ||
          !ACCOUNT_ID_PATTERN.test(result.connected_account_id)) {
        throw new Error('Composio returned an invalid connected-account reference');
      }
      return {
        redirectUrl,
        connectedAccountId: result.connected_account_id,
      };
    },

    async getGitHubConnectionStatus({ sessionId, connectedAccountId } = {}) {
      requireSessionId(sessionId);
      if (typeof connectedAccountId !== 'string' ||
          !ACCOUNT_ID_PATTERN.test(connectedAccountId)) {
        throw new TypeError('Invalid Composio connected-account ID');
      }
      const result = await requestJson(
        '/api/v3.1/tool_router/session/' + encodeURIComponent(sessionId) +
          '/toolkits?toolkits=github&limit=10',
      );
      if (!Array.isArray(result.items) || result.items.length > 10) {
        throw new Error('Composio returned an invalid toolkit status');
      }
      const github = result.items.find((item) => item?.slug === 'github');
      const account = github?.connected_account;
      return Boolean(account && account.id === connectedAccountId &&
        typeof account.status === 'string' && account.status.toLowerCase() === 'active');
    },

    async listSessionTools({ sessionId } = {}) {
      requireSessionId(sessionId);
      const result = await requestJson(
        '/api/v3.1/tool_router/session/' + encodeURIComponent(sessionId) + '/tools?limit=100',
      );
      if (!Array.isArray(result.items) || result.items.length > 100) {
        throw new Error('Composio returned an invalid tool catalogue');
      }
      const slugs = result.items.map((item) => {
        if (!item || typeof item.slug !== 'string' ||
            !/^[A-Z0-9]+(?:_[A-Z0-9]+)*$/.test(item.slug)) {
          throw new Error('Composio returned an invalid tool definition');
        }
        return item.slug;
      });
      if (new Set(slugs).size !== slugs.length) {
        throw new Error('Composio returned duplicate tool definitions');
      }
      return slugs;
    },

    async executeGitHubGetRepository({ sessionId, owner, repo, connectedAccountId } = {}) {
      requireSessionId(sessionId);
      validateRepositoryPart(owner, 'owner', /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/);
      validateRepositoryPart(repo, 'repository name', /^[A-Za-z0-9_.-]{1,100}$/);
      if (connectedAccountId !== undefined &&
          (typeof connectedAccountId !== 'string' || !ACCOUNT_ID_PATTERN.test(connectedAccountId))) {
        throw new TypeError('Invalid Composio connected-account ID');
      }
      const result = await requestJson(
        '/api/v3.1/tool_router/session/' + encodeURIComponent(sessionId) + '/execute',
        {
          method: 'POST',
          body: {
            tool_slug: TOOL_SLUG,
            arguments: { owner, repo },
            ...(connectedAccountId === undefined ? {} : { account: connectedAccountId }),
          },
        },
      );
      if (result.error !== undefined && result.error !== null && result.error !== '') {
        throw new Error('Composio GitHub repository lookup failed');
      }
      if (!result.data || typeof result.data !== 'object' || Array.isArray(result.data)) {
        throw new Error('Composio returned an invalid repository result');
      }
      const logId = typeof result.log_id === 'string' &&
        /^[A-Za-z0-9_-]{1,128}$/.test(result.log_id) ? result.log_id : null;
      return { data: result.data, logId };
    },
  });
}
