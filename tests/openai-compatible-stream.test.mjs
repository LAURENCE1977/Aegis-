import test from 'node:test';
import assert from 'node:assert/strict';
import { createOpenAICompatibleStream } from '../functions/lib/openai-compatible-stream.mjs';

const base = {
  providerName: 'example',
  endpoint: 'https://api.provider.com/v1/chat/completions',
  apiKey: 'server-side-test-key-long-enough',
  model: 'provider/model-v1',
  messages: [{ role: 'user', content: 'hello' }],
};

function streamResponse(contentType = 'text/event-stream') {
  const stream = new ReadableStream({ start(controller) { controller.close(); } });
  return { stream, response: new Response(stream, { status: 200, headers: { 'Content-Type': contentType } }) };
}

test('generic OpenAI-compatible stream sends bounded server-authenticated streaming chat request', async () => {
  const { stream, response } = streamResponse();
  let captured;
  const result = await createOpenAICompatibleStream({
    ...base,
    fetchImpl: async (url, options) => { captured = { url, options }; return response; },
  });

  assert.equal(result, stream);
  assert.equal(captured.url, base.endpoint);
  assert.equal(captured.options.method, 'POST');
  assert.equal(captured.options.redirect, 'error');
  assert.equal(captured.options.headers.Authorization, 'Bearer ' + base.apiKey);
  assert.equal(captured.options.headers.Accept, 'text/event-stream');
  const body = JSON.parse(captured.options.body);
  assert.equal(body.model, base.model);
  assert.equal(body.stream, true);
  assert.equal(body.max_tokens, 1024);
  assert.deepEqual(body.messages, base.messages);
  assert.equal(Object.hasOwn(body, 'tools'), false);
});

test('generic OpenAI-compatible stream forwards only explicitly permitted server tools', async () => {
  const { response } = streamResponse();
  const tools = [{
    type: 'function',
    function: {
      name: 'aegis_list_modules',
      description: 'List modules',
      parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
    },
  }];
  let body;
  await createOpenAICompatibleStream({
    ...base,
    tools,
    allowTools: true,
    fetchImpl: async (_url, options) => {
      body = JSON.parse(options.body);
      return response;
    },
  });
  assert.deepEqual(body.tools, tools);
  assert.equal(body.tool_choice, 'auto');
});

test('generic OpenAI-compatible stream refuses tools unless the provider adapter explicitly enables them', async () => {
  let called = false;
  await assert.rejects(() => createOpenAICompatibleStream({
    ...base,
    tools: [{ type: 'function', function: { name: 'aegis_list_modules' } }],
    fetchImpl: async () => { called = true; throw new Error('must not fetch'); },
  }), /tool calling is not enabled/i);
  assert.equal(called, false);
});

test('generic OpenAI-compatible stream rejects unsafe endpoint forms before network access', async () => {
  const unsafe = [
    'http://api.provider.com/v1/chat/completions',
    'https://localhost/v1/chat/completions',
    'https://127.0.0.1/v1/chat/completions',
    'https://api.provider.local/v1/chat/completions',
    'https://user:pass@api.provider.com/v1/chat/completions',
    'https://api.provider.com:8443/v1/chat/completions',
    'https://api.provider.com/v1/chat/completions?next=evil',
    'https://api.provider.com/v1/chat/completions#fragment',
  ];
  for (const endpoint of unsafe) {
    let called = false;
    await assert.rejects(() => createOpenAICompatibleStream({
      ...base,
      endpoint,
      fetchImpl: async () => { called = true; throw new Error('must not fetch'); },
    }), /endpoint/i, endpoint);
    assert.equal(called, false, endpoint);
  }
});

test('generic OpenAI-compatible stream hides network and upstream errors', async () => {
  await assert.rejects(() => createOpenAICompatibleStream({
    ...base,
    fetchImpl: async () => { throw new Error('secret upstream detail'); },
  }), /example provider request failed/i);

  await assert.rejects(() => createOpenAICompatibleStream({
    ...base,
    fetchImpl: async () => new Response('secret upstream detail', { status: 401 }),
  }), /example provider request failed/i);
});

test('generic OpenAI-compatible stream rejects non-SSE and bodyless responses', async () => {
  const { response } = streamResponse('application/json');
  await assert.rejects(() => createOpenAICompatibleStream({
    ...base,
    fetchImpl: async () => response,
  }), /unsupported response type/i);

  await assert.rejects(() => createOpenAICompatibleStream({
    ...base,
    fetchImpl: async () => new Response(null, { status: 204 }),
  }), /provider request failed/i);
});

test('generic OpenAI-compatible stream validates server-side credentials and model identity', async () => {
  let called = false;
  for (const overrides of [
    { apiKey: '' },
    { apiKey: 'bad\nkey' },
    { model: '' },
    { model: '../secret' },
    { providerName: 'bad/provider' },
  ]) {
    await assert.rejects(() => createOpenAICompatibleStream({
      ...base,
      ...overrides,
      fetchImpl: async () => { called = true; throw new Error('must not fetch'); },
    }));
  }
  assert.equal(called, false);
});
