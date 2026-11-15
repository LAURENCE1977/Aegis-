import test from 'node:test';
import assert from 'node:assert/strict';
import { createTextRunEvents, createTextRunFinishEvents, encodeAgUiSse } from '../functions/lib/ag-ui.mjs';

test('text run emits the AG-UI 1.0 start, text and finish lifecycle in order', () => {
  const events=createTextRunEvents({
    threadId:'thread-1',runId:'run-1',message:'Hello from AEGIS.',
    now:1234,
  });
  assert.deepEqual(events.map(event=>event.type),[
    'RUN_STARTED','TEXT_MESSAGE_START','TEXT_MESSAGE_CONTENT',
    'TEXT_MESSAGE_END','RUN_FINISHED',
  ]);
  assert.deepEqual(events[0],{
    type:'RUN_STARTED',threadId:'thread-1',runId:'run-1',
    protocolVersion:'1.0',timestamp:1234,
  });
  assert.equal(events[2].delta,'Hello from AEGIS.');
  assert.equal(events[4].threadId,'thread-1');
  assert.equal(events[4].runId,'run-1');
});

test('empty assistant messages are represented without invalid missing deltas',()=>{
  const events=createTextRunEvents({threadId:'t',runId:'r',message:'',now:1});
  assert.equal(events[2].delta,'');
});

test('run identifiers and message size are bounded and validated',()=>{
  assert.throws(()=>createTextRunEvents({threadId:'',runId:'r',message:'x'}),/thread/i);
  assert.throws(()=>createTextRunEvents({threadId:'t',runId:'r',message:'x'.repeat(12001)}),/message/i);
});

test('SSE encoding emits one JSON data frame per event and rejects invalid events',()=>{
  const events=createTextRunEvents({threadId:'t',runId:'r',message:'line 1\nline 2',now:1});
  const encoded=encodeAgUiSse(events);
  const frames=encoded.trim().split('\n\n');
  assert.equal(frames.length,5);
  assert.ok(frames.every(frame=>frame.startsWith('data: ')));
  assert.deepEqual(JSON.parse(frames[2].slice(6)),events[2]);
  assert.throws(()=>encodeAgUiSse([{type:'RUN_STARTED'}]),/event/i);
});

test('run finish can explicitly report a producer-cancelled outcome', () => {
  const finish=createTextRunFinishEvents({threadId:'t',runId:'r',now:1,outcome:'cancelled'});
  const encoded=encodeAgUiSse(finish);
  assert.match(encoded, /"outcome":"cancelled"/);
  assert.throws(()=>createTextRunFinishEvents({threadId:'t',runId:'r',outcome:'mystery'}),/outcome/i);
});
