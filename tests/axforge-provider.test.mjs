import test from 'node:test';
import assert from 'node:assert/strict';
import { createModelStream } from '../functions/lib/model-provider.mjs';

const messages = [
  { role: 'system', content: 'You are AEGIS.' },
  { role: 'user', content: 'Check the AxForge connection.' },
];

function streamResponse() {
  const stream = new ReadableStream({ start(controller) { controller.close(); } });
  return { stream, response: new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  }) };
}

test('AxForge uses its fixed OpenAI-compatible endpoint and a server-side key', async () => {
  const { stream, response } = streamResponse();
  let captured;
  const result = await createModelStream({
    env: {
      AEGIS_MODEL_PROVIDER: 'axforge',
      AEGIS_AXFORGE_API_KEY: 'test-axforge-api-key-long-enough',
      AEGIS_AXFORGE_MODEL: 'qwen3.8-27b-nvfp4',
    },
    messages,
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return response;
    },
  });

  assert.equal(result, stream);
  assert.equal(captured.url, 'https://api.axforge.ai/v1/chat/completions');
  assert.equal(captured.options.method, 'POST');
  assert.equal(captured.options.redirect, 'error');
  assert.equal(captured.options.headers.Authorization, 'Bearer test-axforge-api-key-long-enough');
  assert.equal(captured.options.headers.Accept, 'text/event-stream');
  const body = JSON.parse(captured.options.body);
  assert.equal(body.model, 'qwen3.8-27b-nvfp4');
  assert.equal(body.stream, true);
  assert.equal(body.max_tokens, 1024);
  assert.deepEqual(body.messages, messages);
});

test('AxForge fails closed without a key or explicit model and makes no network request', async () => {
  let called = false;
  await assert.rejects(() => createModelStream({
    env: { AEGIS_MODEL_PROVIDER: 'axforge', AEGIS_AXFORGE_MODEL: 'qwen3.8-27b-nvfp4' },
    messages,
    fetchImpl: async () => { called = true; throw new Error('unexpected network call'); },
  }), /AxForge API key is not configured/i);

  await assert.rejects(() => createModelStream({
    env: { AEGIS_MODEL_PROVIDER: 'axforge', AEGIS_AXFORGE_API_KEY: 'test-axforge-api-key-long-enough' },
    messages,
    fetchImpl: async () => { called = true; throw new Error('unexpected network call'); },
  }), /AxForge model is not configured/i);
  assert.equal(called, false);
});

test('AxForge rejects tool use until model-specific tool support is verified', async () => {
  await assert.rejects(() => createModelStream({
    env: {
      AEGIS_MODEL_PROVIDER: 'axforge',
      AEGIS_AXFORGE_API_KEY: 'test-axforge-api-key-long-enough',
      AEGIS_AXFORGE_MODEL: 'qwen3.8-27b-nvfp4',
    },
    messages,
    tools: [{
      type: 'function',
      function: {
        name: 'aegis_list_modules',
        description: 'List modules',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
      },
    }],
    fetchImpl: async () => { throw new Error('must not fetch'); },
  }), /AxForge tool calling is not enabled/i);
});

test('AxForge rejects invalid model identifiers and hides upstream errors', async () => {
  const base = {
    AEGIS_MODEL_PROVIDER: 'axforge',
    AEGIS_AXFORGE_API_KEY: 'test-axforge-api-key-long-enough',
  };
  await assert.rejects(() => createModelStream({
    env: { ...base, AEGIS_AXFORGE_MODEL: 'https://attacker.example/model' },
    messages,
  }), /AxForge model/i);

  await assert.rejects(() => createModelStream({
    env: { ...base, AEGIS_AXFORGE_MODEL: 'qwen3.8-27b-nvfp4' },
    messages,
    fetchImpl: async () => new Response('sensitive upstream diagnostic', { status: 401 }),
  }), /AxForge provider request failed/i);
});
