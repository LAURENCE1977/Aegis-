const MAX_OUTPUT_TOKENS = 1024;
const REQUEST_TIMEOUT_MS = 60_000;
const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,179}$/;
const HOSTNAME = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const BLOCKED_SUFFIXES = ['localhost', 'local', 'internal', 'lan', 'home', 'test', 'invalid'];

function validateEndpoint(endpoint) {
  if (typeof endpoint !== 'string' || endpoint.length > 2048) {
    throw new TypeError('Invalid OpenAI-compatible provider endpoint.');
  }

  let url;
  try {
    url = new URL(endpoint);
  } catch {
    throw new TypeError('Invalid OpenAI-compatible provider endpoint.');
  }

  const hostname = url.hostname.toLowerCase();
  const hostnameIsSafe = HOSTNAME.test(hostname) &&
    !BLOCKED_SUFFIXES.some(suffix => hostname === suffix || hostname.endsWith('.' + suffix));

  if (url.protocol !== 'https:' || !hostnameIsSafe ||
      url.username || url.password || (url.port && url.port !== '443') ||
      !url.pathname.endsWith('/chat/completions') || url.search || url.hash) {
    throw new TypeError('Unsafe OpenAI-compatible provider endpoint.');
  }

  return url.toString();
}

function validateCredentials(apiKey, model) {
  if (typeof apiKey !== 'string' || apiKey.length < 16 || apiKey.length > 4096 ||
      /[\r\n\u0000]/.test(apiKey)) {
    throw new TypeError('Invalid OpenAI-compatible provider credential.');
  }
  if (typeof model !== 'string' || !MODEL_ID.test(model) ||
      model.includes('..') || model.includes('//') || model.endsWith('/') || model.includes('/.')) {
    throw new TypeError('Invalid OpenAI-compatible model identifier.');
  }
}

function validateProviderName(providerName) {
  if (typeof providerName !== 'string' || !/^[A-Za-z][A-Za-z0-9 -]{0,31}$/.test(providerName)) {
    throw new TypeError('Invalid provider name.');
  }
}

/**
 * Shared OpenAI-compatible Chat Completions transport.
 *
 * Callers must resolve endpoint, credential and model from trusted server-side
 * provider configuration. Never pass browser-controlled URLs or secrets here.
 * Tool forwarding is opt-in per provider/model and remains a proposal only:
 * this function never executes a tool.
 */
export async function createOpenAICompatibleStream({
  providerName,
  endpoint,
  apiKey,
  model,
  messages,
  tools = [],
  allowTools = false,
  fetchImpl = fetch,
}) {
  validateProviderName(providerName);
  const safeEndpoint = validateEndpoint(endpoint);
  validateCredentials(apiKey, model);

  if (!Array.isArray(messages) || messages.length < 1 || messages.length > 14) {
    throw new TypeError('Invalid OpenAI-compatible message list.');
  }
  if (!Array.isArray(tools)) {
    throw new TypeError('Invalid OpenAI-compatible tool list.');
  }
  if (tools.length && allowTools !== true) {
    throw new Error(providerName + ' tool calling is not enabled.');
  }
  if (typeof fetchImpl !== 'function') {
    throw new TypeError('OpenAI-compatible fetch implementation is required.');
  }

  const body = {
    model,
    messages,
    max_tokens: MAX_OUTPUT_TOKENS,
    stream: true,
    ...(tools.length ? { tools, tool_choice: 'auto' } : {}),
  };

  let response;
  try {
    response = await fetchImpl(safeEndpoint, {
      method: 'POST',
      redirect: 'error',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new Error(providerName + ' provider request failed.');
  }

  if (!response || !response.ok || !response.body ||
      typeof response.body.getReader !== 'function') {
    throw new Error(providerName + ' provider request failed.');
  }

  const contentType = response.headers?.get?.('content-type') || '';
  if (!contentType.toLowerCase().includes('text/event-stream')) {
    throw new Error(providerName + ' provider returned an unsupported response type.');
  }

  return response.body;
}
