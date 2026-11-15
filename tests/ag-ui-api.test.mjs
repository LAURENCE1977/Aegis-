import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken } from '../functions/lib/auth.mjs';
import { onRequestPost } from '../functions/api/ag-ui.js';

const secret='ag-ui-api-test-session-secret-long-enough';
const envBase={AEGIS_PASSWORD:'test-password-long-enough',AEGIS_SESSION_SECRET:secret};

async function request(body,{authenticated=true,origin='https://aegis.example'}={}){
  const headers={'Content-Type':'application/json',Origin:origin};
  if(authenticated) headers.Cookie='__Host-aegis_session='+await createSessionToken(secret);
  return new Request('https://aegis.example/api/ag-ui',{method:'POST',headers,body:JSON.stringify(body)});
}
const input=(overrides={})=>({
  threadId:'thread-123',runId:'run-123',protocolVersion:'1.0',
  messages:[{id:'user-1',role:'user',content:'Hello AEGIS.'}],
  tools:[],context:[],...overrides,
});

test('AG-UI endpoint requires a configured signed session before model access',async()=>{
  const noConfig=await onRequestPost({request:await request(input()),env:{}});
  assert.equal(noConfig.status,503);
  const noSession=await onRequestPost({request:await request(input(),{authenticated:false}),env:envBase});
  assert.equal(noSession.status,401);
});

test('AG-UI endpoint rejects cross-origin writes',async()=>{
  const response=await onRequestPost({
    request:await request(input(),{origin:'https://attacker.example'}),
    env:envBase,
  });
  assert.equal(response.status,403);
});

test('AG-UI endpoint rejects frontend tools and ambient context until Sentinel mediation is connected',async()=>{
  const toolResponse=await onRequestPost({
    request:await request(input({tools:[{name:'dangerous-tool'}]})),
    env:envBase,
  });
  assert.equal(toolResponse.status,400);
  const contextResponse=await onRequestPost({
    request:await request(input({context:[{description:'untrusted',value:'inject'}]})),
    env:envBase,
  });
  assert.equal(contextResponse.status,400);
});

function modelSseStream(chunks) {
  const encoder=new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

test('AG-UI endpoint streams model deltas as ordered protocol 1.0 events',async()=>{
  let captured;
  const response=await onRequestPost({
    request:await request(input({
      messages:[
        {id:'old-user',role:'user',content:'Earlier question'},
        {id:'old-assistant',role:'assistant',content:'Earlier answer'},
        {id:'user-1',role:'user',content:'Hello AEGIS.'},
      ],
    })),
    env:{
      ...envBase,
      AI:{async run(model,payload){captured=payload;return modelSseStream(['data: {"response":"Hello "}\n\n','data: {"response":"from AEGIS."}\n\ndata: [DONE]\n\n']);}},
    },
  });
  assert.equal(response.status,200);
  assert.ok(response.headers.get('content-type').includes('text/event-stream'));
  const events=(await response.text()).trim().split('\n\n').map(frame=>JSON.parse(frame.slice(6)));
  assert.deepEqual(events.map(event=>event.type),[
    'RUN_STARTED','TEXT_MESSAGE_START','TEXT_MESSAGE_CONTENT','TEXT_MESSAGE_CONTENT','TEXT_MESSAGE_END','RUN_FINISHED',
  ]);
  assert.deepEqual(events.filter(event=>event.type==='TEXT_MESSAGE_CONTENT').map(event=>event.delta),['Hello ','from AEGIS.']);
  assert.equal(captured.stream,true);
  assert.equal(captured.messages.at(-1).content,'Hello AEGIS.');
  assert.match(captured.messages[0].content,/AEGIS/);
});


test('AG-UI reports model startup failures as a first-event RUN_ERROR frame',async()=>{
  const response=await onRequestPost({
    request:await request(input()),
    env:{...envBase,AI:{async run(){throw new Error('private provider secret must not leak');}}},
  });
  assert.equal(response.status,502);
  assert.ok(response.headers.get('content-type').includes('text/event-stream'));
  const body=await response.text();
  const firstFrame=body.split(/\\r?\\n\\r?\\n/)[0];
  const event=JSON.parse(firstFrame.slice(6));
  assert.equal(event.type,'RUN_ERROR');
  assert.equal(event.message,'The AI could not start this run. Please try again.');
  assert.doesNotMatch(body,/private provider secret/);
});

test('AG-UI endpoint rejects non-text and malformed runs rather than silently dropping content',async()=>{
  const noQuestion=await onRequestPost({
    request:await request(input({messages:[{id:'x',role:'assistant',content:'not a user turn'}]})),
    env:{...envBase,AI:{async run(){throw new Error('must not run');}}},
  });
  assert.equal(noQuestion.status,400);
  const multimodal=await onRequestPost({
    request:await request(input({messages:[{id:'x',role:'user',content:[{type:'image',source:{type:'url',value:'https://example.com/image.png'}}]}]})),
    env:{...envBase,AI:{async run(){throw new Error('must not run');}}},
  });
  assert.equal(multimodal.status,400);
});


test('AG-UI stream parser handles provider frames split across arbitrary network chunks',async()=>{
  const response=await onRequestPost({
    request:await request(input()),
    env:{
      ...envBase,
      AI:{async run(){return modelSseStream([
        'data: {"res',
        'ponse":"split',
        ' frame"}\n\n',
        'data: [DONE]\n\n',
      ]);}},
    },
  });
  const events=(await response.text()).trim().split('\n\n').map(frame=>JSON.parse(frame.slice(6)));
  assert.deepEqual(events.filter(event=>event.type==='TEXT_MESSAGE_CONTENT').map(event=>event.delta),['split frame']);
});

test('AG-UI reports a safe terminal error if the provider stream breaks mid-run',async()=>{
  let sent = false;
  const brokenStream=new ReadableStream({
    pull(controller) {
      if (!sent) {
        sent = true;
        controller.enqueue(new TextEncoder().encode('data: {"response":"partial"}\n\n'));
      } else {
        controller.error(new Error('provider internals must not leak'));
      }
    },
  });
  const response=await onRequestPost({
    request:await request(input()),
    env:{...envBase,AI:{async run(){return brokenStream;}}},
  });
  const frames=(await response.text()).trim().split('\n\n').map(frame=>JSON.parse(frame.slice(6)));
  assert.equal(frames[2].delta,'partial');
  assert.equal(frames[3].type,'RUN_ERROR');
  assert.doesNotMatch(JSON.stringify(frames),/provider internals/);
});


test('AG-UI endpoint rejects unknown top-level and message fields',async()=>{
  const unknownTop=await onRequestPost({
    request:await request(input({tools:[],experimentalExecution:true})),
    env:{...envBase,AI:{async run(){throw new Error('must not run');}}},
  });
  assert.equal(unknownTop.status,400);
  const unknownMessage=await onRequestPost({
    request:await request(input({messages:[{id:'x',role:'user',content:'hello',toolCalls:[{name:'shell'}]}]})),
    env:{...envBase,AI:{async run(){throw new Error('must not run');}}},
  });
  assert.equal(unknownMessage.status,400);
});

test('AG-UI endpoint bounds and validates run identifiers before model access',async()=>{
  const longRun=await onRequestPost({
    request:await request(input({runId:'r'.repeat(129)})),
    env:{...envBase,AI:{async run(){throw new Error('must not run');}}},
  });
  assert.equal(longRun.status,400);
  const control=await onRequestPost({
    request:await request(input({threadId:'thread\u0000bad'})),
    env:{...envBase,AI:{async run(){throw new Error('must not run');}}},
  });
  assert.equal(control.status,400);
});


test('AG-UI rejects invalid or non-owned Project Space context before model access',async()=>{
  const invalid=await onRequestPost({
    request:await request(input({projectId:'bad project id'})),
    env:{...envBase,AI:{async run(){throw new Error('must not run');}}},
  });
  assert.equal(invalid.status,400);
  const missing=await onRequestPost({
    request:await request(input({projectId:'project-123'})),
    env:{
      ...envBase,
      AEGIS_DB:{prepare(){return {bind(){return this;},async first(){return null;}};}},
      AI:{async run(){throw new Error('must not run');}},
    },
  });
  assert.equal(missing.status,404);
});


test('AG-UI streams Qwen deltas only when the owner explicitly selects the configured provider',async()=>{
  let captured;
  const response=await onRequestPost({
    request:await request(input()),
    env:{
      ...envBase,
      AEGIS_MODEL_PROVIDER:'alibaba-qwen',
      AEGIS_QWEN_API_KEY:'test-qwen-api-key-long-enough',
      AEGIS_QWEN_WORKSPACE_ID:'workspace-123',
      AEGIS_QWEN_REGION:'ap-southeast-1',
      AEGIS_QWEN_MODEL:'qwen3.8-flash',
    },
    fetchImpl:async(url,options)=>{
      captured={url,options};
      return new Response(modelSseStream([
        'data: {"choices":[{"delta":{"content":"Qwen "}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"stream."}}]}\n\n',
        'data: [DONE]\n\n',
      ]),{status:200,headers:{'Content-Type':'text/event-stream'}});
    },
  });
  assert.equal(response.status,200);
  const events=(await response.text()).trim().split('\n\n').map(frame=>JSON.parse(frame.slice(6)));
  assert.deepEqual(events.filter(event=>event.type==='TEXT_MESSAGE_CONTENT').map(event=>event.delta),['Qwen ','stream.']);
  assert.equal(captured.url,'https://workspace-123.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions');
  assert.equal(captured.options.headers.Authorization,'Bearer test-qwen-api-key-long-enough');
});

test('AG-UI marks a response stopped by the output safety cap as cancelled, not successful',async()=>{
  let cancelled=false;
  const largeStream=new ReadableStream({
    start(controller){controller.enqueue(new TextEncoder().encode('data: '+JSON.stringify({response:'x'.repeat(12001)})+'\n\n'));}
    ,cancel(){cancelled=true;}
  });
  const response=await onRequestPost({
    request:await request(input()),
    env:{...envBase,AI:{async run(){return largeStream;}}},
  });
  const events=(await response.text()).trim().split('\n\n').map(frame=>JSON.parse(frame.slice(6)));
  const text=events.filter(event=>event.type==='TEXT_MESSAGE_CONTENT').map(event=>event.delta).join('');
  assert.equal(text.length,12000);
  assert.equal(events.at(-1).type,'RUN_FINISHED');
  assert.equal(events.at(-1).outcome,'cancelled');
  assert.equal(cancelled,true);
});
