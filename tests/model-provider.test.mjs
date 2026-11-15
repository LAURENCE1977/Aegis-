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
    env:{AEGIS_MODEL_PROVIDER:'alibaba-qwen',AEGIS_QWEN_WORKSPACE_ID:'workspace-1'},
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
      AEGIS_MODEL_PROVIDER:'alibaba-qwen',
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
  const base={AEGIS_MODEL_PROVIDER:'alibaba-qwen',AEGIS_QWEN_API_KEY:'test-api-key-long-enough',AEGIS_QWEN_WORKSPACE_ID:'workspace-123',AEGIS_QWEN_REGION:'ap-southeast-1'};
  await assert.rejects(()=>createModelStream({env:{...base,AEGIS_QWEN_WORKSPACE_ID:'evil.example'},messages:[]}),/workspace/i);
  await assert.rejects(()=>createModelStream({env:{...base,AEGIS_QWEN_REGION:'evil-region'},messages:[]}),/region/i);
  await assert.rejects(()=>createModelStream({env:{...base,AEGIS_QWEN_MODEL:'qwen;drop'},messages:[]}),/model/i);
});

test('unknown providers fail closed and provider errors are not surfaced to callers',async()=>{
  await assert.rejects(()=>createModelStream({env:{AEGIS_MODEL_PROVIDER:'unknown'},messages:[]}),/unsupported/i);
  await assert.rejects(()=>createModelStream({
    env:{AEGIS_MODEL_PROVIDER:'alibaba-qwen',AEGIS_QWEN_API_KEY:'test-api-key-long-enough',AEGIS_QWEN_WORKSPACE_ID:'workspace-123',AEGIS_QWEN_REGION:'ap-southeast-1'},
    messages:[],fetchImpl:async()=>new Response('sensitive provider diagnostic',{status:401}),
  }),/provider request failed/i);
});
