import test from 'node:test';
import assert from 'node:assert/strict';
import { createModelStream } from '../functions/lib/model-provider.mjs';

function readable(text='data: [DONE]\n\n'){
  return new Response(new ReadableStream({
    start(controller){controller.enqueue(new TextEncoder().encode(text));controller.close();}
  }),{status:200,headers:{'Content-Type':'text/event-stream'}});
}

test('Workers AI remains the default provider and preserves existing streaming contract',async()=>{
  let call;
  const stream=new ReadableStream({start(controller){controller.close();}});
  const result=await createModelStream({
    env:{AI:{async run(model,options){call={model,options};return stream;}}},
    messages:[{role:'user',content:'hello'}],
  });
  assert.equal(result,stream);
  assert.equal(call.model,'@cf/meta/llama-3.3-70b-instruct');
  assert.equal(call.options.stream,true);
});

test('Qwen provider requires a server-side key and workspace before any network request',async()=>{
  let called=false;
  await assert.rejects(()=>createModelStream({
    env:{AEGIS_FREE_ONLY:'false',AEGIS_MODEL_PROVIDER:'alibaba-qwen',AEGIS_QWEN_WORKSPACE_ID:'workspace-1'},
    messages:[{role:'user',content:'hello'}],
    fetchImpl:async()=>{called=true;return readable();},
  }),/not configured/i);
  assert.equal(called,false);
});

test('Qwen provider builds a fixed regional endpoint and streams OpenAI-compatible chat completions',async()=>{
  let call;
  const stream=new ReadableStream({start(controller){controller.close();}});
  const result=await createModelStream({
    env:{
      AEGIS_FREE_ONLY:'false',AEGIS_MODEL_PROVIDER:'alibaba-qwen',
      AEGIS_QWEN_API_KEY:'server-secret-not-returned',
      AEGIS_QWEN_WORKSPACE_ID:'workspace-123',
      AEGIS_QWEN_REGION:'ap-southeast-1',
      AEGIS_QWEN_MODEL:'qwen3.8-flash',
    },
    messages:[{role:'user',content:'hello'}],
    fetchImpl:async(url,options)=>{call={url,options};return new Response(stream,{status:200,headers:{'Content-Type':'text/event-stream'}});},
  });
  assert.equal(result,stream);
  assert.equal(call.url,'https://workspace-123.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions');
  assert.equal(call.options.method,'POST');
  assert.equal(call.options.redirect,'error');
  assert.equal(call.options.headers.Authorization,'Bearer server-secret-not-returned');
  const body=JSON.parse(call.options.body);
  assert.equal(body.model,'qwen3.8-flash');
  assert.equal(body.stream,true);
  assert.deepEqual(body.messages,[{role:'user',content:'hello'}]);
});

test('Qwen provider rejects arbitrary hosts, unsupported regions and invalid model names',async()=>{
  const base={AEGIS_FREE_ONLY:'false',AEGIS_MODEL_PROVIDER:'alibaba-qwen',AEGIS_QWEN_API_KEY:'test-api-key-long-enough',AEGIS_QWEN_WORKSPACE_ID:'workspace-123',AEGIS_QWEN_REGION:'ap-southeast-1'};
  await assert.rejects(()=>createModelStream({env:{...base,AEGIS_QWEN_WORKSPACE_ID:'evil.example'},messages:[{role:'user',content:'hello'}]}),/workspace/i);
  await assert.rejects(()=>createModelStream({env:{...base,AEGIS_QWEN_REGION:'evil-region'},messages:[{role:'user',content:'hello'}]}),/region/i);
  await assert.rejects(()=>createModelStream({env:{...base,AEGIS_QWEN_MODEL:'qwen;drop'},messages:[{role:'user',content:'hello'}]}),/model/i);
});

test('unknown providers fail closed and provider errors are not surfaced to callers',async()=>{
  await assert.rejects(()=>createModelStream({env:{AEGIS_MODEL_PROVIDER:'unknown'},messages:[{role:'user',content:'hello'}]}),/unsupported/i);
  await assert.rejects(()=>createModelStream({
    env:{AEGIS_FREE_ONLY:'false',AEGIS_MODEL_PROVIDER:'alibaba-qwen',AEGIS_QWEN_API_KEY:'test-api-key-long-enough',AEGIS_QWEN_WORKSPACE_ID:'workspace-123',AEGIS_QWEN_REGION:'ap-southeast-1'},
    messages:[{role:'user',content:'hello'}],fetchImpl:async()=>new Response('sensitive provider diagnostic',{status:401}),
  }),/provider request failed/i);
});
const serverTools = [{
  type: 'function',
  function: {
    name: 'aegis_list_modules',
    description: 'List AEGIS modules.',
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
  },
}];

test('Qwen receives only server-provided function tools and automatic tool choice', async () => {
  let captured;
  const stream = new ReadableStream({ start(controller) { controller.close(); } });
  await createModelStream({
    env: {
      AEGIS_FREE_ONLY: 'false',
      AEGIS_MODEL_PROVIDER: 'alibaba-qwen',
      AEGIS_QWEN_API_KEY: 'test-qwen-api-key-long-enough',
      AEGIS_QWEN_WORKSPACE_ID: 'workspace-123',
      AEGIS_QWEN_REGION: 'ap-southeast-1',
      AEGIS_QWEN_MODEL: 'qwen3.8-flash',
    },
    messages: [{ role: 'user', content: 'List my modules.' }],
    tools: serverTools,
    fetchImpl: async (_url, options) => {
      captured = JSON.parse(options.body);
      return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    },
  });
  assert.deepEqual(captured.tools, serverTools);
  assert.equal(captured.tool_choice, 'auto');
});

test('model provider rejects tool definitions from unsupported providers and malformed server tool schemas', async () => {
  await assert.rejects(() => createModelStream({
    env: { AI: { async run() { throw new Error('must not run'); } } },
    messages: [{ role: 'user', content: 'List my modules.' }],
    tools: serverTools,
  }), /tool calling is not enabled/i);

  await assert.rejects(() => createModelStream({
    env: {
      AEGIS_FREE_ONLY: 'false',
      AEGIS_MODEL_PROVIDER: 'alibaba-qwen',
      AEGIS_QWEN_API_KEY: 'test-qwen-api-key-long-enough',
      AEGIS_QWEN_WORKSPACE_ID: 'workspace-123',
      AEGIS_QWEN_REGION: 'ap-southeast-1',
    },
    messages: [{ role: 'user', content: 'List my modules.' }],
    tools: [{ type: 'function', function: { name: 'run_shell', parameters: {} } }],
    fetchImpl: async () => { throw new Error('must not fetch'); },
  }), /invalid model tool/i);
});

test('Qwen follow-up accepts one bounded assistant tool call and matching tool result', async () => {
  const stream = new ReadableStream({ start(controller) { controller.close(); } });
  let captured;
  await createModelStream({
    env: {
      AEGIS_FREE_ONLY: 'false',
      AEGIS_MODEL_PROVIDER: 'alibaba-qwen',
      AEGIS_QWEN_API_KEY: 'test-qwen-api-key-long-enough',
      AEGIS_QWEN_WORKSPACE_ID: 'workspace-123',
      AEGIS_QWEN_REGION: 'ap-southeast-1',
    },
    messages: [
      { role: 'user', content: 'List my modules.' },
      { role: 'assistant', content: '', tool_calls: [{
        id: 'call_123', type: 'function',
        function: { name: 'aegis_list_modules', arguments: '{}' },
      }] },
      { role: 'tool', tool_call_id: 'call_123', name: 'aegis_list_modules', content: '{"ok":true}' },
    ],
    fetchImpl: async (_url, options) => {
      captured = JSON.parse(options.body);
      return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    },
  });
  assert.equal(captured.messages[1].tool_calls[0].function.name, 'aegis_list_modules');
  assert.equal(captured.messages[2].role, 'tool');
});
test('Qwen tool calling is restricted to the model with verified tool-call support', async () => {
  await assert.rejects(() => createModelStream({
    env: {
      AEGIS_FREE_ONLY: 'false',
      AEGIS_MODEL_PROVIDER: 'alibaba-qwen',
      AEGIS_QWEN_API_KEY: 'test-qwen-api-key-long-enough',
      AEGIS_QWEN_WORKSPACE_ID: 'workspace-123',
      AEGIS_QWEN_REGION: 'ap-southeast-1',
      AEGIS_QWEN_MODEL: 'qwen2.5-14b-instruct',
    },
    messages: [{ role: 'user', content: 'List my modules.' }],
    tools: serverTools,
    fetchImpl: async () => { throw new Error('must not fetch'); },
  }), /tool calling is not enabled for this qwen model/i);
});

test('Anthropic provider uses the fixed Messages API with server-side bearer auth and a separate system prompt', async () => {
  const stream = new ReadableStream({ start(controller) { controller.close(); } });
  let capturedUrl;
  let capturedOptions;
  const result = await createModelStream({
    env: {
      AEGIS_FREE_ONLY: 'false',
      AEGIS_MODEL_PROVIDER: 'anthropic',
      ANTHROPIC_API_KEY: 'test-anthropic-api-key-long-enough',
      AEGIS_ANTHROPIC_MODEL: 'claude-opus-5-5',
    },
    messages: [
      { role: 'system', content: 'You are AEGIS.' },
      { role: 'user', content: 'Hello Claude.' },
    ],
    fetchImpl: async (url, options) => {
      capturedUrl = url;
      capturedOptions = options;
      return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    },
  });
  assert.equal(result, stream);
  assert.equal(capturedUrl, 'https://api.anthropic.com/v1/messages');
  assert.equal(capturedOptions.method, 'POST');
  assert.equal(capturedOptions.redirect, 'error');
  assert.equal(capturedOptions.headers.Authorization, 'Bearer test-anthropic-api-key-long-enough');
  assert.equal(capturedOptions.headers['anthropic-version'], '2023-06-01');
  const body = JSON.parse(capturedOptions.body);
  assert.equal(body.model, 'claude-opus-5-5');
  assert.equal(body.max_tokens, 1024);
  assert.equal(body.stream, true);
  assert.equal(body.system, 'You are AEGIS.');
  assert.deepEqual(body.messages, [{ role: 'user', content: 'Hello Claude.' }]);
  assert.equal(body.tools, undefined);
});

test('Anthropic provider fails closed without server-side key or explicit model configuration', async () => {
  const base = { AEGIS_FREE_ONLY: 'false', AEGIS_MODEL_PROVIDER: 'anthropic' };
  await assert.rejects(() => createModelStream({
    env: base,
    messages: [{ role: 'user', content: 'hello' }],
    fetchImpl: async () => { throw new Error('must not fetch'); },
  }), /Anthropic API key is not configured/i);
  await assert.rejects(() => createModelStream({
    env: { ...base, ANTHROPIC_API_KEY: 'test-anthropic-api-key-long-enough' },
    messages: [{ role: 'user', content: 'hello' }],
    fetchImpl: async () => { throw new Error('must not fetch'); },
  }), /Anthropic model is not configured/i);
});

test('Anthropic provider rejects tool calls until its own Sentinel adapter is implemented', async () => {
  await assert.rejects(() => createModelStream({
    env: {
      AEGIS_FREE_ONLY: 'false',
      AEGIS_MODEL_PROVIDER: 'anthropic',
      ANTHROPIC_API_KEY: 'test-anthropic-api-key-long-enough',
      AEGIS_ANTHROPIC_MODEL: 'claude-opus-5-5',
    },
    messages: [{ role: 'user', content: 'hello' }],
    tools: serverTools,
    fetchImpl: async () => { throw new Error('must not fetch'); },
  }), /Anthropic tool calling is not enabled/i);
});


test('free-only mode blocks paid external providers before any network request', async () => {
  for (const env of [
    {
      AEGIS_FREE_ONLY: 'true',
      AEGIS_MODEL_PROVIDER: 'anthropic',
      ANTHROPIC_API_KEY: 'test-anthropic-api-key-long-enough',
      AEGIS_ANTHROPIC_MODEL: 'claude-opus-5-5',
    },
    {
      AEGIS_FREE_ONLY: 'true',
      AEGIS_MODEL_PROVIDER: 'alibaba-qwen',
      AEGIS_QWEN_API_KEY: 'test-qwen-api-key-long-enough',
      AEGIS_QWEN_WORKSPACE_ID: 'workspace-123',
      AEGIS_QWEN_REGION: 'ap-southeast-1',
    },
  ]) {
    await assert.rejects(() => createModelStream({
      env,
      messages: [{ role: 'user', content: 'hello' }],
      fetchImpl: async () => { throw new Error('network must not be called'); },
    }), /disabled in free-only mode/i);
  }
});

test('free-only mode keeps the Cloudflare Workers AI path available without external billing credentials', async () => {
  const stream = new ReadableStream({ start(controller) { controller.close(); } });
  let called = false;
  const result = await createModelStream({
    env: {
      AEGIS_FREE_ONLY: 'true',
      AI: { async run(model, payload) { called = true; assert.equal(model, '@cf/meta/llama-3.3-70b-instruct'); assert.equal(payload.stream, true); return stream; } },
    },
    messages: [{ role: 'user', content: 'hello' }],
  });
  assert.equal(called, true);
  assert.equal(result, stream);
});

test('external providers require an explicit paid-provider opt-in when free-only policy is unset', async () => {
  for (const env of [
    { AEGIS_MODEL_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'test-anthropic-api-key-long-enough', AEGIS_ANTHROPIC_MODEL: 'claude-opus-5-5' },
    { AEGIS_MODEL_PROVIDER: 'alibaba-qwen', AEGIS_QWEN_API_KEY: 'test-qwen-api-key-long-enough', AEGIS_QWEN_WORKSPACE_ID: 'workspace-123', AEGIS_QWEN_REGION: 'ap-southeast-1' },
  ]) {
    let called = false;
    await assert.rejects(() => createModelStream({
      env,
      messages: [{ role: 'user', content: 'hello' }],
      fetchImpl: async () => { called = true; throw new Error('network must not be called'); },
    }), error => error.code === 'PROVIDER_DISABLED');
    assert.equal(called, false);
  }
});
