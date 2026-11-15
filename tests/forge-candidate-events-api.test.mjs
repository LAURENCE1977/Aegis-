import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken } from '../functions/lib/auth.mjs';
import { onRequestGet } from '../functions/api/forge/candidates/[id]/events.js';

const secret='forge-candidate-events-test-session-secret-long-enough';
const envBase={AEGIS_PASSWORD:'test-password-long-enough',AEGIS_SESSION_SECRET:secret};

class EventD1 {
  constructor(){this.events=[
    {id:'e2',candidate_id:'candidate-1',owner_id:'owner',event_type:'status_changed',from_status:'inspected',to_status:'approved',from_decision:'adapt',to_decision:'adapt',occurred_at:'2026-11-15T12:02:00.000Z'},
    {id:'e1',candidate_id:'candidate-1',owner_id:'owner',event_type:'created',from_status:null,to_status:'inspected',from_decision:null,to_decision:'unassessed',occurred_at:'2026-11-15T12:00:00.000Z'},
  ];}
  prepare(sql){
    const db=this;
    return {
      values:[],bind(...values){this.values=values;return this;},
      async all(){const [candidateId,ownerId,limit]=this.values;return {results:db.events.filter(e=>e.candidate_id===candidateId&&e.owner_id===ownerId).slice(0,limit)};},
    };
  }
}

async function req(path,{authenticated=true}={}){
  const headers={Origin:'https://aegis.example'};
  if(authenticated)headers.Cookie='__Host-aegis_session='+await createSessionToken(secret);
  return new Request('https://aegis.example'+path,{method:'GET',headers});
}

test('Forge candidate event history is authenticated, owner-scoped and ordered',async()=>{
  const db=new EventD1();
  const response=await onRequestGet({
    request:await req('/api/forge/candidates/candidate-1/events'),
    env:{...envBase,AEGIS_DB:db},params:{id:'candidate-1'},
  });
  assert.equal(response.status,200);
  const data=await response.json();
  assert.deepEqual(data.events.map(e=>e.id),['e2','e1']);
  assert.equal(data.events[0].type,'status_changed');
});

test('Forge candidate event history rejects unauthenticated and malformed identifiers',async()=>{
  const db=new EventD1();
  const unauth=await onRequestGet({request:await req('/api/forge/candidates/candidate-1/events',{authenticated:false}),env:{...envBase,AEGIS_DB:db},params:{id:'candidate-1'}});
  assert.equal(unauth.status,401);
  const malformed=await onRequestGet({request:await req('/api/forge/candidates/../events'),env:{...envBase,AEGIS_DB:db},params:{id:'..'}});
  assert.equal(malformed.status,404);
});
