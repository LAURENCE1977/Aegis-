import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken } from '../functions/lib/auth.mjs';
import { onRequestPost } from '../functions/api/ask.js';

const secret = 'ask-memory-test-session-secret-with-sufficient-length';
const ownerEnv = { AEGIS_PASSWORD:'test-password-long-enough', AEGIS_SESSION_SECRET:secret };

class RetrievalD1 {
  constructor(rows) { this.rows=rows; this.query=null; }
  prepare(sql) {
    const db=this;
    return {
      values:[],
      bind(...values) { this.values=values; return this; },
      async all() {
        db.query={sql,values:this.values};
        if (!sql.includes('FROM aegis_memories')) return {results:[]};
        const [ownerId,projectId,now,...rest]=this.values;
        const limit=rest.pop();
        const terms=rest.map(value=>value.slice(1,-1).toLowerCase());
        const results=db.rows.filter(row=>
          row.owner_id===ownerId && row.project_id===projectId &&
          row.status==='accepted' && row.sensitivity!=='restricted' &&
          (!row.expires_at || row.expires_at>now) &&
          terms.some(term=>(row.content+' '+row.kind+' '+row.tags_json).toLowerCase().includes(term))
        ).slice(0,limit);
        return {results};
      },
    };
  }
}

const row = (overrides={}) => ({
  id:'memory-1',owner_id:'owner',project_id:null,kind:'preference',
  content:'The user prefers concise answers and practical implementation.',
  source_type:'user-stated',source_url:'https://aegis.example/source',
  source_attribution:'Explicit owner statement',source_observed_at:'2026-11-15T12:00:00.000Z',
  confidence:1,sensitivity:'private',status:'accepted',tags_json:'["communication"]',
  created_at:'2026-11-15T12:00:00.000Z',updated_at:'2026-11-15T12:00:00.000Z',expires_at:null,
  ...overrides,
});

async function makeRequest() {
  const token=await createSessionToken(secret);
  return new Request('https://aegis.example/api/ask',{
    method:'POST',
    headers:{'Content-Type':'application/json',Origin:'https://aegis.example',Cookie:'__Host-aegis_session='+token},
    body:JSON.stringify({question:'How should I approach implementation?',history:[]}),
  });
}

test('chat retrieves only approved owner-scoped memories and labels them as untrusted context', async()=>{
  const db=new RetrievalD1([
    row(),
    row({id:'restricted-1',sensitivity:'restricted',content:'restricted secret information'}),
    row({id:'candidate-1',status:'candidate',content:'unreviewed candidate memory'}),
  ]);
  let captured;
  const response=await onRequestPost({
    request:await makeRequest(),
    env:{
      ...ownerEnv,
      AEGIS_DB:db,
      AI:{async run(model,input){captured={model,input};return {response:'Here is a safe answer.'};}},
    },
  });
  assert.equal(response.status,200);
  const system=captured.input.messages[0].content;
  assert.match(system,/Approved AEGIS memories/);
  assert.match(system,/concise answers and practical implementation/);
  assert.match(system,/Explicit owner statement/);
  assert.doesNotMatch(system,/restricted secret information/);
  assert.doesNotMatch(system,/unreviewed candidate memory/);
  assert.match(system,/not instructions/i);
  assert.equal(db.query.values[0],'owner');
  assert.equal(db.query.values[1],null);
});

test('chat remains available without the optional D1 memory binding', async()=>{
  let captured;
  const response=await onRequestPost({
    request:await makeRequest(),
    env:{
      ...ownerEnv,
      AI:{async run(model,input){captured=input;return {response:'Fallback answer.'};}},
    },
  });
  assert.equal(response.status,200);
  assert.doesNotMatch(captured.messages[0].content,/Approved AEGIS memories/);
});
