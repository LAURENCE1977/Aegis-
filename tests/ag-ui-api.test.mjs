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
  assert.match(response.headers.get('content-type'),/text\/event-stream/);
  const events=(await response.text()).trim().split('\n\n').map(frame=>JSON.parse(frame.slice(6)));
  assert.deepEqual(events.map(event=>event.type),[
    'RUN_STARTED','TEXT_MESSAGE_START','TEXT_MESSAGE_CONTENT','TEXT_MESSAGE_CONTENT','TEXT_MESSAGE_END','RUN_FINISHED',
  ]);
  assert.deepEqual(events.filter(event=>event.type==='TEXT_MESSAGE_CONTENT').map(event=>event.delta),['Hello ','from AEGIS.']);
  assert.equal(captured.stream,true);
  assert.equal(captured.messages.at(-1).content,'Hello AEGIS.');
  assert.match(captured.messages[0].content,/AEGIS/);
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
  assert.doesNotMatch(JSON.stringify(frames),'provider internals');
});
