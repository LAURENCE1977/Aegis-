const WORKERS_AI_MODEL = '@cf/meta/llama-3.3-70b-instruct';
const QWEN_REGIONS = new Set([
  'ap-southeast-1',
  'us-east-1',
  'cn-beijing',
  'cn-hongkong',
  'eu-central-1',
  'ap-northeast-1',
]);
const MAX_MESSAGES = 11;
const MAX_MESSAGE_CHARS = 4000;
const MAX_OUTPUT_TOKENS = 1024;

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > MAX_MESSAGES) {
    throw new TypeError('Invalid model message list');
  }
  for (const message of messages) {
    if (!message || typeof message !== 'object' || Array.isArray(message) ||
        !['system','user','assistant'].includes(message.role) ||
        typeof message.content !== 'string' || !message.content.trim() ||
        message.content.length > MAX_MESSAGE_CHARS) {
      throw new TypeError('Invalid model message');
    }
  }
}

function resolveQwenEndpoint(env) {
  const workspace = env.AEGIS_QWEN_WORKSPACE_ID;
  const region = env.AEGIS_QWEN_REGION;
  if (typeof workspace !== 'string' || workspace.length < 3 || workspace.length > 100 ||
      !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(workspace)) {
    throw new Error('Qwen workspace is not configured correctly.');
  }
  if (typeof region !== 'string' || !QWEN_REGIONS.has(region)) {
    throw new Error('Qwen region is not configured correctly.');
  }
  const key = env.AEGIS_QWEN_API_KEY;
  if (typeof key !== 'string' || key.length < 16 || key.length > 4096 ||
      /[\r\n\u0000]/.test(key)) {
    throw new Error('Qwen API key is not configured.');
  }
  const model = env.AEGIS_QWEN_MODEL || 'qwen3.8-flash';
  if (typeof model !== 'string' || model.length > 120 ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(model)) {
    throw new TypeError('Invalid Qwen model identifier');
  }
  return {
    endpoint: 'https://' + workspace + '.' + region +
      '.maas.aliyuncs.com/compatible-mode/v1/chat/completions',
    key,
    model,
  };
}

export async function createModelStream({ env, messages, fetchImpl = fetch }) {
  if (!env || typeof env !== 'object') throw new TypeError('Model environment is required');
  validateMessages(messages);
  const provider = env.AEGIS_MODEL_PROVIDER || 'workers-ai';

  if (provider === 'workers-ai') {
    if (!env.AI || typeof env.AI.run !== 'function') {
      throw new Error('Workers AI is not configured.');
    }
    const stream = await env.AI.run(WORKERS_AI_MODEL, {
      messages,
      max_tokens: MAX_OUTPUT_TOKENS,
      stream: true,
    });
    if (!stream || typeof stream.getReader !== 'function') {
      throw new Error('Workers AI did not return a readable stream.');
    }
    return stream;
  }

  if (provider !== 'alibaba-qwen') {
    throw new Error('Unsupported AEGIS model provider.');
  }

  const { endpoint, key, model } = resolveQwenEndpoint(env);
  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: 'POST',
      redirect: 'error',
      headers: {
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: MAX_OUTPUT_TOKENS,
        stream: true,
      }),
      signal: AbortSignal.timeout(60000),
    });
  } catch {
    throw new Error('Qwen provider request failed.');
  }
  if (!response || !response.ok || !response.body ||
      typeof response.body.getReader !== 'function') {
    throw new Error('Qwen provider request failed.');
  }
  const contentType = response.headers?.get?.('content-type') || '';
  if (!contentType.toLowerCase().includes('text/event-stream')) {
    throw new Error('Qwen provider returned an unsupported response type.');
  }
  return response.body;
}

export const MODEL_PROVIDER_LIMITS = Object.freeze({
  maxMessages: MAX_MESSAGES,
  maxMessageChars: MAX_MESSAGE_CHARS,
  maxOutputTokens: MAX_OUTPUT_TOKENS,
});
