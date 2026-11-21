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
  AEGIS_MODEL_PROVIDER: 'ollama',
  AEGIS_OLLAMA_BASE_URL: 'https://ollama-gateway.example.com',
  AEGIS_OLLAMA_API_KEY: 'test-ollama-gateway-key-long-enough',
  AEGIS_OLLAMA_MODEL: 'qwen2.5:7b',
};

test('Ollama uses a server-configured HTTPS gateway and streams OpenAI-compatible chat completions', async () => {
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
  assert.equal(captured.url, 'https://ollama-gateway.example.com/v1/chat/completions');
  assert.equal(captured.options.method, 'POST');
  assert.equal(captured.options.redirect, 'error');
  assert.equal(captured.options.headers.Authorization, 'Bearer test-ollama-gateway-key-long-enough');
  assert.equal(captured.options.headers.Accept, 'text/event-stream');
  const payload = JSON.parse(captured.options.body);
  assert.equal(payload.model, 'qwen2.5:7b');
  assert.equal(payload.stream, true);
  assert.equal(payload.max_tokens, 1024);
  assert.deepEqual(payload.messages, [{ role: 'user', content: 'hello' }]);
  assert.equal(payload.tools, undefined);
  assert.equal(payload.tool_choice, undefined);
  assert.ok(captured.options.signal instanceof AbortSignal);
});

test('Ollama fails closed unless gateway, gateway key and explicit model are configured', async () => {
  for (const env of [
    { AEGIS_MODEL_PROVIDER: 'ollama' },
    { ...baseEnv, AEGIS_OLLAMA_API_KEY: undefined },
    { ...baseEnv, AEGIS_OLLAMA_MODEL: undefined },
    { ...baseEnv, AEGIS_OLLAMA_BASE_URL: undefined },
  ]) {
    let called = false;
    await assert.rejects(() => createModelStream({
      env,
      messages: [{ role: 'user', content: 'hello' }],
      fetchImpl: async () => { called = true; return eventStream(); },
    }), /Ollama/i);
    assert.equal(called, false);
  }
});

test('Ollama rejects non-HTTPS, credential-bearing, local and path-overridden gateway URLs', async () => {
  for (const endpoint of [
    'http://ollama-gateway.example.com',
    'https://user:pass@ollama-gateway.example.com',
    'https://localhost',
    'https://127.0.0.1',
    'https://ollama.local',
    'https://ollama-gateway.example.com/custom',
    'https://ollama-gateway.example.com?target=internal',
  ]) {
    await assert.rejects(() => createModelStream({
      env: { ...baseEnv, AEGIS_OLLAMA_BASE_URL: endpoint },
      messages: [{ role: 'user', content: 'hello' }],
      fetchImpl: async () => { throw new Error('must not fetch'); },
    }), /Ollama endpoint/i);
  }
});

test('Ollama accepts safe model tags but rejects malformed model identifiers', async () => {
  for (const model of ['llama3.2', 'qwen2.5:7b', 'hf.co/library/model:tag']) {
    await createModelStream({
      env: { ...baseEnv, AEGIS_OLLAMA_MODEL: model },
      messages: [{ role: 'user', content: 'hello' }],
      fetchImpl: async () => eventStream(),
    });
  }
  for (const model of ['../model', 'model;drop', 'https://evil.example/model', 'bad model', '']) {
    await assert.rejects(() => createModelStream({
      env: { ...baseEnv, AEGIS_OLLAMA_MODEL: model },
      messages: [{ role: 'user', content: 'hello' }],
      fetchImpl: async () => { throw new Error('must not fetch'); },
    }), /Ollama model/i);
  }
});

test('Ollama disables provider-originated tools and rejects tool messages before network access', async () => {
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
  }), /Ollama tool calling is not enabled/i);

  await assert.rejects(() => createModelStream({
    env: baseEnv,
    messages: [
      { role: 'user', content: 'hello' },
      { role: 'tool', tool_call_id: 'call_1', name: 'aegis_list_modules', content: '{}' },
    ],
    fetchImpl: async () => { throw new Error('must not fetch'); },
  }), /Ollama tool calling is not enabled/i);
});

test('Ollama maps upstream failures to generic errors and requires SSE responses', async () => {
  await assert.rejects(() => createModelStream({
    env: baseEnv,
    messages: [{ role: 'user', content: 'hello' }],
    fetchImpl: async () => new Response('private upstream diagnostic', { status: 401 }),
  }), (error) => {
    assert.match(error.message, /Ollama provider request failed/i);
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
  }), /Ollama provider returned an unsupported response type/i);
});
