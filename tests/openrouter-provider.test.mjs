import test from 'node:test';
import assert from 'node:assert/strict';
import { createModelStream } from '../functions/lib/model-provider.mjs';

const messages = [
  { role: 'system', content: 'You are AEGIS.' },
  { role: 'user', content: 'Check the OpenRouter connection.' },
];

function streamResponse(contentType = 'text/event-stream') {
  const stream = new ReadableStream({ start(controller) { controller.close(); } });
  return { stream, response: new Response(stream, {
    status: 200,
    headers: { 'Content-Type': contentType },
  }) };
}

test('OpenRouter uses its fixed endpoint, explicit model and server-side key', async () => {
  const { stream, response } = streamResponse();
  let captured;
  const result = await createModelStream({
    env: {
      AEGIS_MODEL_PROVIDER: 'openrouter',
      OPENROUTER_API_KEY: 'test-openrouter-api-key-long-enough',
      AEGIS_OPENROUTER_MODEL: 'openai/gpt-4o-mini',
    },
    messages,
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return response;
    },
  });

  assert.equal(result, stream);
  assert.equal(captured.url, 'https://openrouter.ai/api/v1/chat/completions');
  assert.equal(captured.options.method, 'POST');
  assert.equal(captured.options.redirect, 'error');
  assert.equal(captured.options.headers.Authorization, 'Bearer test-openrouter-api-key-long-enough');
  assert.equal(captured.options.headers.Accept, 'text/event-stream');
  const body = JSON.parse(captured.options.body);
  assert.equal(body.model, 'openai/gpt-4o-mini');
  assert.equal(body.stream, true);
  assert.equal(body.max_tokens, 1024);
  assert.deepEqual(body.messages, messages);
  assert.equal(Object.hasOwn(body, 'tools'), false);
});

test('OpenRouter fails closed without a key or explicit model and makes no network request', async () => {
  let called = false;
  await assert.rejects(() => createModelStream({
    env: { AEGIS_MODEL_PROVIDER: 'openrouter', AEGIS_OPENROUTER_MODEL: 'openai/gpt-4o-mini' },
    messages,
    fetchImpl: async () => { called = true; throw new Error('unexpected network call'); },
  }), /OpenRouter API key is not configured/i);

  await assert.rejects(() => createModelStream({
    env: { AEGIS_MODEL_PROVIDER: 'openrouter', OPENROUTER_API_KEY: 'test-openrouter-api-key-long-enough' },
    messages,
    fetchImpl: async () => { called = true; throw new Error('unexpected network call'); },
  }), /OpenRouter model is not configured/i);
  assert.equal(called, false);
});

test('OpenRouter rejects tool use until provider-specific tool support is verified', async () => {
  await assert.rejects(() => createModelStream({
    env: {
      AEGIS_MODEL_PROVIDER: 'openrouter',
      OPENROUTER_API_KEY: 'test-openrouter-api-key-long-enough',
      AEGIS_OPENROUTER_MODEL: 'openai/gpt-4o-mini',
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
  }), /OpenRouter tool calling is not enabled/i);
});

test('OpenRouter rejects invalid model identifiers and hides upstream errors', async () => {
  const base = {
    AEGIS_MODEL_PROVIDER: 'openrouter',
    OPENROUTER_API_KEY: 'test-openrouter-api-key-long-enough',
  };
  await assert.rejects(() => createModelStream({
    env: { ...base, AEGIS_OPENROUTER_MODEL: 'https://attacker.example/model' },
    messages,
  }), /OpenRouter model/i);

  await assert.rejects(() => createModelStream({
    env: { ...base, AEGIS_OPENROUTER_MODEL: 'openai/gpt-4o-mini' },
    messages,
    fetchImpl: async () => new Response('sensitive upstream diagnostic', { status: 401 }),
  }), /OpenRouter provider request failed/i);
});

test('OpenRouter rejects non-SSE responses', async () => {
  const { response } = streamResponse('application/json');
  await assert.rejects(() => createModelStream({
    env: {
      AEGIS_MODEL_PROVIDER: 'openrouter',
      OPENROUTER_API_KEY: 'test-openrouter-api-key-long-enough',
      AEGIS_OPENROUTER_MODEL: 'openai/gpt-4o-mini',
    },
    messages,
    fetchImpl: async () => response,
  }), /unsupported response type/i);
});
