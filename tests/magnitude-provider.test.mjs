import test from 'node:test';
import assert from 'node:assert/strict';
import { createModelStream } from '../functions/lib/model-provider.mjs';

function eventStream() {
  return new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"hello"}}]}\\n\\n'));
      controller.close();
    },
  }), { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

const baseEnv = {
  AEGIS_MODEL_PROVIDER: 'magnitude',
  AEGIS_MAGNITUDE_BASE_URL: 'https://magnitude-gateway.example.net',
  AEGIS_MAGNITUDE_API_KEY: 'test-magnitude-network-key-long-enough',
  AEGIS_MAGNITUDE_MODEL: 'qwen3.5-4b:gguf:q4',
};

test('Magnitude uses its fixed inference API path and streams OpenAI-compatible chat completions', async () => {
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
  assert.equal(captured.url, 'https://magnitude-gateway.example.net/inference/v1/chat/completions');
  assert.equal(captured.options.method, 'POST');
  assert.equal(captured.options.redirect, 'error');
  assert.equal(captured.options.headers.Authorization, 'Bearer test-magnitude-network-key-long-enough');
  assert.equal(captured.options.headers.Accept, 'text/event-stream');
  const payload = JSON.parse(captured.options.body);
  assert.equal(payload.model, 'qwen3.5-4b:gguf:q4');
  assert.equal(payload.stream, true);
  assert.equal(payload.max_tokens, 1024);
  assert.deepEqual(payload.messages, [{ role: 'user', content: 'hello' }]);
  assert.equal(payload.tools, undefined);
  assert.ok(captured.options.signal instanceof AbortSignal);
});

test('Magnitude fails closed unless HTTPS gateway, network key and exact model ID are configured', async () => {
  for (const env of [
    { AEGIS_MODEL_PROVIDER: 'magnitude' },
    { ...baseEnv, AEGIS_MAGNITUDE_API_KEY: undefined },
    { ...baseEnv, AEGIS_MAGNITUDE_MODEL: undefined },
    { ...baseEnv, AEGIS_MAGNITUDE_BASE_URL: undefined },
  ]) {
    let called = false;
    await assert.rejects(() => createModelStream({
      env,
      messages: [{ role: 'user', content: 'hello' }],
      fetchImpl: async () => { called = true; return eventStream(); },
    }), /Magnitude/i);
    assert.equal(called, false);
  }
});

test('Magnitude rejects unsafe gateway URLs before network access', async () => {
  for (const endpoint of [
    'http://magnitude-gateway.example.net',
    'https://user:pass@magnitude-gateway.example.net',
    'https://localhost',
    'https://127.0.0.1',
    'https://magnitude.local',
    'https://magnitude-gateway.example.net/custom',
    'https://magnitude-gateway.example.net?target=internal',
    'https://magnitude-gateway.example.net:8443',
  ]) {
    await assert.rejects(() => createModelStream({
      env: { ...baseEnv, AEGIS_MAGNITUDE_BASE_URL: endpoint },
      messages: [{ role: 'user', content: 'hello' }],
      fetchImpl: async () => { throw new Error('must not fetch'); },
    }), /Magnitude gateway/i);
  }
});

test('Magnitude accepts exact catalog-style model IDs and rejects malformed identifiers', async () => {
  for (const model of ['qwen3.5-4b:gguf:q4', 'gemma-4-12b:gguf:q4', 'org/model-v2:q5']) {
    await createModelStream({
      env: { ...baseEnv, AEGIS_MAGNITUDE_MODEL: model },
      messages: [{ role: 'user', content: 'hello' }],
      fetchImpl: async () => eventStream(),
    });
  }
  for (const model of ['../model', 'model;drop', 'https://evil.example/model', 'bad model', '', 'a//b']) {
    await assert.rejects(() => createModelStream({
      env: { ...baseEnv, AEGIS_MAGNITUDE_MODEL: model },
      messages: [{ role: 'user', content: 'hello' }],
      fetchImpl: async () => { throw new Error('must not fetch'); },
    }), /Magnitude model/i);
  }
});

test('Magnitude disables provider-originated tool calls and tool messages', async () => {
  const tools = [{
    type: 'function',
    function: {
      name: 'aegis_list_modules',
      description: 'List modules',
      parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
    },
  }];
  await assert.rejects(() => createModelStream({
    env: baseEnv,
    messages: [{ role: 'user', content: 'hello' }],
    tools,
    fetchImpl: async () => { throw new Error('must not fetch'); },
  }), /Magnitude tool calling is not enabled/i);

  await assert.rejects(() => createModelStream({
    env: baseEnv,
    messages: [
      { role: 'user', content: 'hello' },
      { role: 'tool', tool_call_id: 'call_1', name: 'aegis_list_modules', content: '{}' },
    ],
    fetchImpl: async () => { throw new Error('must not fetch'); },
  }), /Magnitude tool calling is not enabled/i);
});

test('Magnitude redacts upstream failures and requires SSE responses', async () => {
  await assert.rejects(() => createModelStream({
    env: baseEnv,
    messages: [{ role: 'user', content: 'hello' }],
    fetchImpl: async () => new Response('private upstream diagnostic', { status: 401 }),
  }), (error) => {
    assert.match(error.message, /Magnitude provider request failed/i);
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
  }), /Magnitude provider returned an unsupported response type/i);
});
