const TOOL_SLUG_PATTERN = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;
const ACCOUNT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;
const VERSION_PATTERN = /^\\d{8}_\\d{2}$/;
const MAX_ARGUMENT_BYTES = 32 * 1024;

async function readBoundedJson(response, maxBytes) {
  const declaredLength = Number(response.headers?.get?.('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    await response.body?.cancel();
    throw new Error('Composio response exceeds the configured size limit');
  }
  if (!response.body) throw new Error('Composio returned an empty response');

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
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw new Error('Composio returned an invalid response encoding'); }
  try { return JSON.parse(text); }
  catch { throw new Error('Composio returned an invalid JSON response'); }
}

/**
 * Fixed Composio v3.1 tool executor.
 *
 * The caller must invoke this only from Sentinel's authorized adapter path.
 * It accepts a single exact tool slug and a private connected-account ID;
 * neither the API host nor the account selection can be supplied by input.
 * Composio retains custody of the connected provider credentials.
 */
export function createComposioToolAdapter({
  apiKey,
  fetchImpl = fetch,
  timeoutMs = 15000,
  maxResponseBytes = 64 * 1024,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('A fetch implementation is required');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 120000) {
    throw new TypeError('Invalid Composio adapter timeout');
  }
  if (!Number.isInteger(maxResponseBytes) || maxResponseBytes < 1024 || maxResponseBytes > 1024 * 1024) {
    throw new TypeError('Invalid Composio response size limit');
  }

  return async function executeComposioTool(input, context) {
    if (typeof apiKey !== 'string' || !apiKey.trim()) {
      throw new Error('Composio project credentials are unavailable');
    }
    if (!context || context.integrationConnectionType !== 'owner_private' ||
        typeof context.integrationToolSlug !== 'string' ||
        !TOOL_SLUG_PATTERN.test(context.integrationToolSlug) ||
        !Array.isArray(context.integrationAllowedToolSlugs) ||
        !context.integrationAllowedToolSlugs.includes(context.integrationToolSlug) ||
        typeof context.integrationPlatformAccountId !== 'string' ||
        !ACCOUNT_ID_PATTERN.test(context.integrationPlatformAccountId)) {
      throw new Error('Composio execution requires an allowlisted tool and a private owner connection');
    }
    if (!input || typeof input !== 'object' || Array.isArray(input) ||
        Object.keys(input).some(key => !['arguments', 'version'].includes(key)) ||
        !input.arguments || typeof input.arguments !== 'object' || Array.isArray(input.arguments) ||
        typeof input.version !== 'string' || !VERSION_PATTERN.test(input.version)) {
      throw new TypeError('Composio execution requires structured arguments and a pinned tool version');
    }

    let serializedArguments;
    try { serializedArguments = JSON.stringify(input.arguments); }
    catch { throw new TypeError('Composio tool arguments must be JSON serializable'); }
    if (typeof serializedArguments !== 'string' ||
        new TextEncoder().encode(serializedArguments).byteLength > MAX_ARGUMENT_BYTES) {
      throw new TypeError('Composio tool arguments exceed the configured size limit');
    }

    const url = 'https://backend.composio.dev/api/v3.1/tools/execute/' +
      encodeURIComponent(context.integrationToolSlug);
    let response;
    try {
      response = await fetchImpl(url, {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          connected_account_id: context.integrationPlatformAccountId,
          arguments: input.arguments,
          version: input.version,
        }),
      });
    } catch {
      throw new Error('Composio execution request failed');
    }

    if (!response || !response.ok) {
      await response?.body?.cancel();
      throw new Error('Composio upstream request failed');
    }
    const contentType = response.headers?.get?.('content-type') || '';
    if (!/^application\\/json(?:\\s*;|$)/i.test(contentType)) {
      await response.body?.cancel();
      throw new Error('Composio returned an unsupported response type');
    }
    return readBoundedJson(response, maxResponseBytes);
  };
}
