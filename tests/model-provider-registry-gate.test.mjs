import test from 'node:test';
import assert from 'node:assert/strict';
import { createModelStream } from '../functions/lib/model-provider.mjs';

function registry({ adapterId = 'workers-ai', displayName = 'Cloudflare Workers AI', termsUrl = 'https://developers.cloudflare.com/workers-ai/', sourceUrl = 'https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/', status = 'enabled', verifiedAt = new Date(Date.now() - 1000).toISOString(), contextTokens = 8192, maxOutputTokens = 512, providerModelId = '@cf/meta/llama-3.3-70b-instruct', inputCost, outputCost } = {}) {
  const model = {
    id: 'cloudflare-llama-chat',
    providerModelId,
    sourceUrl,
    verifiedAt,
    contextTokens,
    maxOutputTokens,
    tasks: ['chat'],
  };
  if (inputCost !== undefined) model.inputCost = inputCost;
  if (outputCost !== undefined) model.outputCost = outputCost;
  return JSON.stringify({
    version: 1,
    providers: [{
      id: 'cloudflare-workers-ai',
      adapterId,
      displayName,
      status,
      termsUrl,
      verifiedAt,
      models: [model],
    }],
  });
}

function messages(content = 'Hello AEGIS') {
  return [{ role: 'user', content }];
}

test('configured server registry must contain the exact enabled, fresh model before Workers AI is called', async () => {
  let called = false;
  await assert.rejects(() => createModelStream({
    env: {
      AEGIS_PROVIDER_REGISTRY_JSON: registry({ providerModelId: '@cf/meta/not-the-configured-model' }),
      AI: { async run() { called = true; throw new Error('must not run'); } },
    },
    messages: messages(),
  }), /not eligible/i);
  assert.equal(called, false);
});

test('configured server registry rejects disabled providers before any provider call', async () => {
  let called = false;
  await assert.rejects(() => createModelStream({
    env: {
      AEGIS_PROVIDER_REGISTRY_JSON: registry({ status: 'disabled' }),
      AI: { async run() { called = true; throw new Error('must not run'); } },
    },
    messages: messages(),
  }), /not eligible/i);
  assert.equal(called, false);
});

test('configured server registry rejects stale model evidence before any provider call', async () => {
  let called = false;
  const stale = new Date(Date.now() - 2 * 86400000).toISOString();
  await assert.rejects(() => createModelStream({
    env: {
      AEGIS_PROVIDER_REGISTRY_JSON: registry({ verifiedAt: stale }),
      AI: { async run() { called = true; throw new Error('must not run'); } },
    },
    messages: messages(),
  }), /not eligible/i);
  assert.equal(called, false);
});

test('eligible registry model caps output tokens to its verified model limit', async () => {
  let captured;
  const stream = new ReadableStream({ start(controller) { controller.close(); } });
  const result = await createModelStream({
    env: {
      AEGIS_PROVIDER_REGISTRY_JSON: registry({ maxOutputTokens: 512 }),
      AI: { async run(model, options) { captured = { model, options }; return stream; } },
    },
    messages: messages(),
  });
  assert.equal(result, stream);
  assert.equal(captured.options.max_tokens, 512);
});

test('eligible registry model rejects input that cannot fit alongside the bounded output', async () => {
  let called = false;
  await assert.rejects(() => createModelStream({
    env: {
      AEGIS_PROVIDER_REGISTRY_JSON: registry({ contextTokens: 128, maxOutputTokens: 64 }),
      AI: { async run() { called = true; throw new Error('must not run'); } },
    },
    messages: messages('x'.repeat(100)),
  }), /context limit/i);
  assert.equal(called, false);
});

test('malformed configured registry fails closed rather than falling back to an unverified provider', async () => {
  let called = false;
  await assert.rejects(() => createModelStream({
    env: {
      AEGIS_PROVIDER_REGISTRY_JSON: '{not-json',
      AI: { async run() { called = true; throw new Error('must not run'); } },
    },
    messages: messages(),
  }), /registry configuration/i);
  assert.equal(called, false);
});

test('legacy explicit provider configuration remains compatible when no registry is configured', async () => {
  let called = false;
  const stream = new ReadableStream({ start(controller) { controller.close(); } });
  const result = await createModelStream({
    env: { AI: { async run() { called = true; return stream; } } },
    messages: messages(),
  });
  assert.equal(result, stream);
  assert.equal(called, true);
});

test('Qwen registry entry must match the configured Qwen model and applies its output limit', async () => {
  let captured;
  const stream = new ReadableStream({ start(controller) { controller.close(); } });
  const result = await createModelStream({
    env: {
      AEGIS_MODEL_PROVIDER: 'alibaba-qwen',
      AEGIS_QWEN_API_KEY: 'test-qwen-api-key-long-enough',
      AEGIS_QWEN_WORKSPACE_ID: 'workspace-123',
      AEGIS_QWEN_REGION: 'ap-southeast-1',
      AEGIS_PROVIDER_REGISTRY_JSON: registry({
        adapterId: 'alibaba-qwen',
        displayName: 'Alibaba Qwen',
        termsUrl: 'https://www.alibabacloud.com/help/en/model-studio/',
        sourceUrl: 'https://help.aliyun.com/en/model-studio/list-models',
        providerModelId: 'qwen3.8-flash',
        maxOutputTokens: 256,
      }),
    },
    messages: messages(),
    fetchImpl: async (_url, options) => {
      captured = JSON.parse(options.body);
      return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    },
  });
  assert.equal(result, stream);
  assert.equal(captured.model, 'qwen3.8-flash');
  assert.equal(captured.max_tokens, 256);
});

test('Anthropic registry entry must match the explicitly configured Anthropic model and applies its output limit', async () => {
  let captured;
  const stream = new ReadableStream({ start(controller) { controller.close(); } });
  const result = await createModelStream({
    env: {
      AEGIS_MODEL_PROVIDER: 'anthropic',
      ANTHROPIC_API_KEY: 'test-anthropic-api-key-long-enough',
      AEGIS_ANTHROPIC_MODEL: 'claude-opus-5-5',
      AEGIS_PROVIDER_REGISTRY_JSON: registry({
        adapterId: 'anthropic',
        displayName: 'Anthropic',
        termsUrl: 'https://www.anthropic.com/legal/consumer-terms',
        sourceUrl: 'https://docs.anthropic.com/en/docs/about-claude/models/overview',
        providerModelId: 'claude-opus-5-5',
        maxOutputTokens: 256,
      }),
    },
    messages: messages(),
    fetchImpl: async (_url, options) => {
      captured = JSON.parse(options.body);
      return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    },
  });
  assert.equal(result, stream);
  assert.equal(captured.model, 'claude-opus-5-5');
  assert.equal(captured.max_tokens, 256);
});
