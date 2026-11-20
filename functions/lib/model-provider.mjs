import { isSupportedProviderAdapter, listEligibleModels } from './provider-registry.mjs';

const WORKERS_AI_MODEL = '@cf/meta/llama-3.3-70b-instruct';
const QWEN_REGIONS = new Set([
  'ap-southeast-1',
  'us-east-1',
  'cn-beijing',
  'cn-hongkong',
  'eu-central-1',
  'ap-northeast-1',
]);
const MAX_MESSAGES = 14;
const MAX_MESSAGE_CHARS = 4000;
const MAX_OUTPUT_TOKENS = 1024;
const MAX_PROVIDER_REGISTRY_BYTES = 16 * 1024;

function configuredModelId(provider, env) {
  if (provider === 'workers-ai') return WORKERS_AI_MODEL;
  if (provider === 'anthropic') return env.AEGIS_ANTHROPIC_MODEL;
  if (provider === 'alibaba-qwen') return env.AEGIS_QWEN_MODEL || 'qwen3.8-flash';
  return null;
}

function resolveRegistryModel(env, provider, modelId) {
  const source = env.AEGIS_PROVIDER_REGISTRY_JSON;
  if (source === undefined) return null;
  if (typeof source !== 'string' || !source.trim() ||
      new TextEncoder().encode(source).byteLength > MAX_PROVIDER_REGISTRY_BYTES) {
    throw new Error('Provider registry configuration is invalid.');
  }
  let registry;
  try {
    registry = JSON.parse(source);
  } catch {
    throw new Error('Provider registry configuration is invalid.');
  }
  let eligible;
  try {
    eligible = listEligibleModels(registry, {
      task: 'chat',
      now: new Date().toISOString(),
      maxAgeMs: 24 * 60 * 60 * 1000,
    });
  } catch {
    throw new Error('Provider registry configuration is invalid.');
  }
  const match = eligible.find(model =>
    model.adapterId === provider &&
    typeof model.providerModelId === 'string' &&
    model.providerModelId === modelId
  );
  if (!match) throw new Error('Configured provider model is not eligible in the AEGIS registry.');
  return match;
}

function enforceRegistryLimits(messages, model) {
  if (!model) return MAX_OUTPUT_TOKENS;
  const maxOutputTokens = Math.min(MAX_OUTPUT_TOKENS, model.maxOutputTokens);
  // UTF-8 bytes are a conservative upper bound for text tokens; add per-message
  // framing headroom rather than relying on an unavailable provider tokenizer.
  const inputUpperBound = new TextEncoder().encode(JSON.stringify(messages)).byteLength +
    (messages.length * 16);
  if (inputUpperBound + maxOutputTokens > model.contextTokens) {
    throw new Error('Model input exceeds the verified provider context limit.');
  }
  return maxOutputTokens;
}

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > MAX_MESSAGES) {
    throw new TypeError('Invalid model message list');
  }
  for (const message of messages) {
    if (!message || typeof message !== 'object' || Array.isArray(message) ||
        typeof message.content !== 'string' || message.content.length > MAX_MESSAGE_CHARS) {
      throw new TypeError('Invalid model message');
    }
    if (message.role === 'tool') {
      if (Object.keys(message).some(key => !['role', 'content', 'tool_call_id', 'name'].includes(key)) ||
          typeof message.tool_call_id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(message.tool_call_id) ||
          typeof message.name !== 'string' || !/^aegis_[a-z0-9_]{1,64}$/.test(message.name) ||
          !message.content.trim()) {
        throw new TypeError('Invalid model tool result message');
      }
      continue;
    }
    if (!['system', 'user', 'assistant'].includes(message.role)) {
      throw new TypeError('Invalid model message role');
    }
    if (message.role === 'assistant' && message.tool_calls !== undefined) {
      if (Object.keys(message).some(key => !['role', 'content', 'tool_calls'].includes(key)) ||
          !Array.isArray(message.tool_calls) || message.tool_calls.length !== 1) {
        throw new TypeError('Invalid assistant tool-call message');
      }
      const call = message.tool_calls[0];
      if (!call || typeof call !== 'object' || Array.isArray(call) ||
          Object.keys(call).some(key => !['id', 'type', 'function'].includes(key)) ||
          typeof call.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(call.id) ||
          call.type !== 'function' || !call.function || typeof call.function !== 'object' ||
          Object.keys(call.function).some(key => !['name', 'arguments'].includes(key)) ||
          typeof call.function.name !== 'string' || !/^aegis_[a-z0-9_]{1,64}$/.test(call.function.name) ||
          typeof call.function.arguments !== 'string' || call.function.arguments.length > 4096) {
        throw new TypeError('Invalid assistant tool-call payload');
      }
      continue;
    }
    if (Object.keys(message).some(key => !['role', 'content'].includes(key)) || !message.content.trim()) {
      throw new TypeError('Invalid model message');
    }
  }
}

function validateTools(tools) {
  if (tools === undefined) return [];
  if (!Array.isArray(tools) || tools.length < 1 || tools.length > 4) {
    throw new TypeError('Invalid model tool list');
  }
  for (const tool of tools) {
    if (!tool || typeof tool !== 'object' || Array.isArray(tool) ||
        Object.keys(tool).some(key => !['type', 'function'].includes(key)) ||
        tool.type !== 'function' || !tool.function || typeof tool.function !== 'object' ||
        Object.keys(tool.function).some(key => !['name', 'description', 'parameters'].includes(key)) ||
        typeof tool.function.name !== 'string' || !/^aegis_[a-z0-9_]{1,64}$/.test(tool.function.name) ||
        typeof tool.function.description !== 'string' || tool.function.description.length > 512 ||
        !tool.function.parameters || typeof tool.function.parameters !== 'object' ||
        tool.function.parameters.type !== 'object' ||
        tool.function.parameters.additionalProperties !== false ||
        !tool.function.parameters.properties || typeof tool.function.parameters.properties !== 'object') {
      throw new TypeError('Invalid model tool definition');
    }
  }
  return JSON.parse(JSON.stringify(tools));
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

function resolveAnthropicConfig(env) {
  const key = env.ANTHROPIC_API_KEY;
  if (typeof key !== 'string' || key.length < 16 || key.length > 4096 ||
      /[\r\n\u0000]/.test(key)) {
    throw new Error('Anthropic API key is not configured.');
  }
  const model = env.AEGIS_ANTHROPIC_MODEL;
  if (typeof model !== 'string' || !model.trim() || model.length > 120 ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(model)) {
    throw new Error('Anthropic model is not configured.');
  }
  return { key, model };
}

function toAnthropicMessages(messages) {
  if (messages.some(message => message.role === 'tool' || message.tool_calls !== undefined)) {
    throw new Error('Anthropic tool calling is not enabled.');
  }
  const system = messages
    .filter(message => message.role === 'system')
    .map(message => message.content)
    .join('\n\n');
  const conversation = messages
    .filter(message => message.role !== 'system')
    .map(message => ({ role: message.role, content: message.content }));
  if (!conversation.length) throw new TypeError('Anthropic requires at least one conversation message.');
  return { ...(system ? { system } : {}), messages: conversation };
}

async function createAnthropicStream({ env, messages, tools, fetchImpl, maxOutputTokens }) {
  if (tools.length) throw new Error('Anthropic tool calling is not enabled.');
  const { key, model } = resolveAnthropicConfig(env);
  const input = toAnthropicMessages(messages);
  let response;
  try {
    response = await fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      redirect: 'error',
      headers: {
        Authorization: 'Bearer ' + key,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxOutputTokens,
        stream: true,
        ...input,
      }),
      signal: AbortSignal.timeout(60000),
    });
  } catch {
    throw new Error('Anthropic provider request failed.');
  }
  if (!response || !response.ok || !response.body ||
      typeof response.body.getReader !== 'function') {
    throw new Error('Anthropic provider request failed.');
  }
  const contentType = response.headers?.get?.('content-type') || '';
  if (!contentType.toLowerCase().includes('text/event-stream')) {
    throw new Error('Anthropic provider returned an unsupported response type.');
  }
  return response.body;
}

export async function createModelStream({ env, messages, tools, fetchImpl = fetch }) {
  if (!env || typeof env !== 'object') throw new TypeError('Model environment is required');
  validateMessages(messages);
  const safeTools = validateTools(tools);
  const provider = env.AEGIS_MODEL_PROVIDER || 'workers-ai';
  if (!isSupportedProviderAdapter(provider)) {
    throw new Error('Unsupported AEGIS model provider.');
  }
  const modelId = configuredModelId(provider, env);
  const registryModel = resolveRegistryModel(env, provider, modelId);
  const maxOutputTokens = enforceRegistryLimits(messages, registryModel);

  if (provider === 'workers-ai') {
    if (safeTools.length) throw new Error('Tool calling is not enabled for this Workers AI model.');
    if (!env.AI || typeof env.AI.run !== 'function') {
      throw new Error('Workers AI is not configured.');
    }
    const stream = await env.AI.run(WORKERS_AI_MODEL, {
      messages,
      max_tokens: maxOutputTokens,
      stream: true,
    });
    if (!stream || typeof stream.getReader !== 'function') {
      throw new Error('Workers AI did not return a readable stream.');
    }
    return stream;
  }

  if (provider === 'anthropic') {
    return createAnthropicStream({ env, messages, tools: safeTools, fetchImpl, maxOutputTokens });
  }

  if (provider !== 'alibaba-qwen') {
    throw new Error('Unsupported AEGIS model provider.');
  }

  const { endpoint, key, model } = resolveQwenEndpoint(env);
  if (safeTools.length && model !== 'qwen3.8-flash') {
    throw new Error('Tool calling is not enabled for this Qwen model.');
  }
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
        max_tokens: maxOutputTokens,
        stream: true,
        ...(safeTools.length ? { tools: safeTools, tool_choice: 'auto' } : {}),
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
