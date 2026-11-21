import test from 'node:test';
import assert from 'node:assert/strict';
import { createModelStream } from '../functions/lib/model-provider.mjs';

function eventStream() {
  return new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"hello"}}]}\n\n'));
      controller.close();
    },
  }), { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

const baseEnv = {
  AEGIS_MODEL_PROVIDER: 'bitnet',
  AEGIS_BITNET_BASE_URL: 'https://bitnet.example.com',
  AEGIS_BITNET_API_KEY: 'test-bitnet-proxy-key-long-enough',
  AEGIS_BITNET_MODEL: 'microsoft/BitNet-b1.58-2B-4T',
};

test('BitNet uses a server-configured HTTPS OpenAI-compatible endpoint and streams chat completions', async () => {
  let captured;
  const stream = eventStream();
  const result = await createModelStream({
    env: baseEnv,
    messages: [{ role: 'user', content: 'hello' }],
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return stream;
    },
  });

  assert.equal(result, stream.body);
  assert.equal(captured.url, 'https://bitnet.example.com/v1/chat/completions');
  assert.equal(captured.options.method, 'POST');
  assert.equal(captured.options.redirect, 'error');
  assert.equal(captured.options.headers.Authorization, 'Bearer test-bitnet-proxy-key-long-enough');
  assert.equal(captured.options.headers.Accept, 'text/event-stream');
  const payload = JSON.parse(captured.options.body);
  assert.equal(payload.model, 'microsoft/BitNet-b1.58-2B-4T');
  assert.equal(payload.stream, true);
  assert.equal(payload.max_tokens, 1024);
  assert.deepEqual(payload.messages, [{ role: 'user', content: 'hello' }]);
  assert.equal(payload.tools, undefined);
  assert.equal(payload.tool_choice, undefined);
  assert.ok(captured.options.signal instanceof AbortSignal);
});

test('BitNet fails closed unless endpoint, proxy key and explicit model are configured', async () => {
  for (const env of [
    { AEGIS_MODEL_PROVIDER: 'bitnet' },
    { ...baseEnv, AEGIS_BITNET_API_KEY: undefined },
    { ...baseEnv, AEGIS_BITNET_MODEL: undefined },
    { ...baseEnv, AEGIS_BITNET_BASE_URL: undefined },
  ]) {
    let called = false;
    await assert.rejects(() => createModelStream({
      env,
      messages: [{ role: 'user', content: 'hello' }],
      fetchImpl: async () => { called = true; return eventStream(); },
    }), /BitNet/i);
    assert.equal(called, false);
  }
});

test('BitNet rejects non-HTTPS, credential-bearing, local and path-overridden endpoints', async () => {
  for (const endpoint of [
    'http://bitnet.example.com',
    'https://user:pass@bitnet.example.com',
    'https://localhost',
    'https://127.0.0.1',
    'https://bitnet.local',
    'https://bitnet.example.com/custom',
    'https://bitnet.example.com?target=internal',
  ]) {
    await assert.rejects(() => createModelStream({
      env: { ...baseEnv, AEGIS_BITNET_BASE_URL: endpoint },
      messages: [{ role: 'user', content: 'hello' }],
      fetchImpl: async () => { throw new Error('must not fetch'); },
    }), /BitNet endpoint/i);
  }
});

test('BitNet accepts a safe local model alias or a namespaced model identifier', async () => {
  for (const model of ['bitnet-local', 'microsoft/BitNet-b1.58-2B-4T']) {
    let payload;
    await createModelStream({
      env: { ...baseEnv, AEGIS_BITNET_MODEL: model },
      messages: [{ role: 'user', content: 'hello' }],
      fetchImpl: async (_url, options) => {
        payload = JSON.parse(options.body);
        return eventStream();
      },
    });
    assert.equal(payload.model, model);
  }
});

test('BitNet rejects malformed model identifiers and tool calling before network access', async () => {
  for (const model of ['../model', 'model;drop', 'https://evil.example/model', 'a/b/c']) {
    await assert.rejects(() => createModelStream({
      env: { ...baseEnv, AEGIS_BITNET_MODEL: model },
      messages: [{ role: 'user', content: 'hello' }],
      fetchImpl: async () => { throw new Error('must not fetch'); },
    }), /BitNet model/i);
  }
  await assert.rejects(() => createModelStream({
    env: baseEnv,
    messages: [{ role: 'user', content: 'hello' }],
    tools: [{
      type: 'function',
      function: {
        name: 'aegis_list_modules',
        description: 'List modules',
        parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
      },
    }],
    fetchImpl: async () => { throw new Error('must not fetch'); },
  }), /BitNet tool calling is not enabled/i);
});

test('BitNet maps upstream failures to generic errors and requires SSE responses', async () => {
  await assert.rejects(() => createModelStream({
    env: baseEnv,
    messages: [{ role: 'user', content: 'hello' }],
    fetchImpl: async () => new Response('private upstream diagnostic', { status: 401 }),
  }), (error) => {
    assert.match(error.message, /BitNet provider request failed/i);
    assert.doesNotMatch(error.message, /private upstream diagnostic/);
    return true;
  });

  await assert.rejects(() => createModelStream({
    env: baseEnv,
    messages: [{ role: 'user', content: 'hello' }],
    fetchImpl: async () => new Response('{}', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  }), /BitNet provider returned an unsupported response type/i);
});
