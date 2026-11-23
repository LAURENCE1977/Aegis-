const API_ORIGIN = 'https://backend.composio.dev';
const ACCOUNT_PATH = '/api/v3/connected_accounts';
const EXECUTE_PATH = '/api/v3.1/tools/execute/';
const MAX_RESPONSE_BYTES = 256 * 1024;
const MAX_ACCOUNT_PAGES = 5;

const READ_ONLY_TOOLS = Object.freeze({
  GITHUB_GET_THE_AUTHENTICATED_USER: Object.freeze({
    toolkit: 'github',
    validate: (args) => isRecord(args) && Object.keys(args).length === 0,
  }),
  CLOUDFLARE_API_KEY_LIST_ACCOUNTS: Object.freeze({
    toolkit: 'cloudflare_api_key',
    validate: (args) => isRecord(args) &&
      Object.keys(args).every((key) => ['name', 'page', 'per_page', 'direction'].includes(key)) &&
      (args.name === undefined || validText(args.name, 128)) &&
      (args.page === undefined || (Number.isInteger(args.page) && args.page >= 1 && args.page <= 1000)) &&
      (args.per_page === undefined || (Number.isInteger(args.per_page) && args.per_page >= 5 && args.per_page <= 50)) &&
      (args.direction === undefined || ['asc', 'desc'].includes(args.direction)),
  }),
  CLOUDFLARE_API_KEY_LIST_PAGES_PROJECTS: Object.freeze({
    toolkit: 'cloudflare_api_key',
    validate: (args) => isRecord(args) &&
      Object.keys(args).every((key) => ['account_id', 'page', 'per_page'].includes(key)) &&
      validText(args.account_id, 64) &&
      (args.page === undefined || (Number.isInteger(args.page) && args.page >= 1 && args.page <= 1000)) &&
      (args.per_page === undefined || (Number.isInteger(args.per_page) && args.per_page >= 1 && args.per_page <= 50)),
  }),
});

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validText(value, max = 256) {
  return typeof value === 'string' && value.trim().length > 0 &&
    value.length <= max && !/[\u0000-\u001f\u007f]/.test(value);
}

function safeError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

async function readJson(response) {
  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (declaredLength > MAX_RESPONSE_BYTES) {
    throw safeError('COMPOSIO_RESPONSE_TOO_LARGE', 'Composio response exceeded the size limit.');
  }

  let text = '';
  if (response.body?.getReader) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_RESPONSE_BYTES) {
          await reader.cancel();
          throw safeError('COMPOSIO_RESPONSE_TOO_LARGE', 'Composio response exceeded the size limit.');
        }
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
    } finally {
      reader.releaseLock();
    }
  } else {
    text = await response.text();
    if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) {
      throw safeError('COMPOSIO_RESPONSE_TOO_LARGE', 'Composio response exceeded the size limit.');
    }
  }

  try {
    return JSON.parse(text);
  } catch {
    throw safeError('COMPOSIO_INVALID_RESPONSE', 'Composio returned an invalid response.');
  }
}

function connectionItems(payload) {
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.result?.items)) return payload.result.items;
  return [];
}

function safeConnection(account, expectedUserId) {
  const id = account?.id;
  const toolkit = account?.toolkit?.slug ?? account?.toolkit_slug;
  const status = account?.status;
  if (account?.user_id !== expectedUserId ||
      !validText(id, 160) || !validText(toolkit, 100) || !validText(status, 40)) return null;
  return { id, toolkit, status };
}

/**
 * Server-only Composio adapter. The project API key must come from an encrypted
 * runtime secret; callers never receive it or raw connected-account credentials.
 */
export function createComposioBridge({ apiKey, userId, fetchImpl = fetch } = {}) {
  if (!validText(apiKey, 512) || !validText(userId, 200) ||
      typeof fetchImpl !== 'function') {
    throw new TypeError('Composio bridge configuration is incomplete.');
  }

  async function request(url, init) {
    let response;
    try {
      response = await fetchImpl(url, {
        ...init,
        redirect: 'error',
        signal: init?.signal ?? AbortSignal.timeout(10000),
      });
    } catch {
      throw safeError('COMPOSIO_UNAVAILABLE', 'Composio could not be reached.');
    }
    const payload = await readJson(response);
    if (!response.ok) {
      throw safeError('COMPOSIO_UPSTREAM_ERROR', 'Composio rejected the request.');
    }
    return payload;
  }

  async function listConnectedAccounts() {
    const accounts = [];
    let cursor = null;

    for (let page = 0; page < MAX_ACCOUNT_PAGES; page += 1) {
      const url = new URL(ACCOUNT_PATH, API_ORIGIN);
      url.searchParams.set('user_ids', userId);
      url.searchParams.set('limit', '100');
      if (cursor) url.searchParams.set('cursor', cursor);

      const payload = await request(url, {
        method: 'GET',
        headers: { 'x-api-key': apiKey, Accept: 'application/json' },
      });
      accounts.push(...connectionItems(payload).map((account) => safeConnection(account, userId)).filter(Boolean));
      cursor = typeof payload?.next_cursor === 'string' && payload.next_cursor.length <= 512
        ? payload.next_cursor : null;
      if (!cursor) return accounts;
    }

    throw safeError('COMPOSIO_ACCOUNT_PAGE_LIMIT', 'Composio connection listing exceeded the page limit.');
  }

  async function executeReadOnlyTool({ toolSlug, connectedAccountId, arguments: args = {} } = {}) {
    const definition = READ_ONLY_TOOLS[toolSlug];
    if (!definition) {
      throw safeError('COMPOSIO_TOOL_NOT_ALLOWLISTED', 'Composio tool is not allowlisted for this bridge.');
    }
    if (!validText(connectedAccountId, 160) || !definition.validate(args)) {
      throw safeError('COMPOSIO_INVALID_TOOL_INPUT', 'Composio tool input is invalid.');
    }

    const accounts = await listConnectedAccounts();
    const connection = accounts.find((account) =>
      account.id === connectedAccountId &&
      account.toolkit === definition.toolkit &&
      account.status === 'ACTIVE'
    );
    if (!connection) {
      throw safeError('COMPOSIO_CONNECTION_NOT_ACTIVE', 'An active matching connection is required.');
    }

    const url = new URL(EXECUTE_PATH + encodeURIComponent(toolSlug), API_ORIGIN);
    return request(url, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        connected_account_id: connectedAccountId,
        version: 'latest',
        arguments: args,
      }),
    });
  }

  return Object.freeze({ listConnectedAccounts, executeReadOnlyTool });
}
