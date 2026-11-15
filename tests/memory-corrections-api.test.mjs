import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken } from '../functions/lib/auth.mjs';
import { onRequestPost as createMemory } from '../functions/api/memories.js';
import { onRequestPost as correctMemory } from '../functions/api/memories/[id]/corrections.js';
import { onRequestPatch as reviewMemory } from '../functions/api/memories/[id].js';

const secret='memory-correction-test-session-secret-long-enough';
const envBase={AEGIS_PASSWORD:'test-password-long-enough',AEGIS_SESSION_SECRET:secret};

class CorrectionD1 {
  constructor(){this.rows=new Map();this.events=[];}
  prepare(sql){
    const db=this;
    return {
      values:[],
      bind(...values){this.values=values;return this;},
      async run(){
        const v=this.values;
        if(sql.includes('INSERT INTO aegis_memories')){
          const row={
            id:v[0],owner_id:v[1],project_id:v[2],kind:v[3],content:v[4],
            source_type:v[5],source_url:v[6],source_attribution:v[7],
            source_observed_at:v[8],confidence:v[9],sensitivity:v[10],
            status:v[11],tags_json:v[12],created_at:v[13],updated_at:v[14],
            expires_at:v[15],supersedes_id:v[16]??null,
          };
          if(row.supersedes_id){
            const old=db.rows.get(row.supersedes_id);
            if(!old||old.owner_id!==row.owner_id||old.project_id!==row.project_id||old.status!=='accepted')throw new Error('invalid supersession target');
            if([...db.rows.values()].some(x=>x.supersedes_id===row.supersedes_id&&x.status==='candidate'))throw new Error('pending correction exists');
          }
          db.rows.set(row.id,row);
          db.events.push({id:'event-'+db.events.length,memory_id:row.id,owner_id:row.owner_id,project_id:row.project_id,event_type:'created',from_status:null,to_status:row.status,occurred_at:row.created_at});
          return {meta:{changes:1}};
        }
        if(sql.includes('UPDATE aegis_memories')){
          const row=db.rows.get(v[2]);
          if(!row||row.owner_id!==v[3]||row.project_id!==v[4]||!['candidate','accepted'].includes(row.status))return {meta:{changes:0}};
          const previous=row.status;row.status=v[0];row.updated_at=v[1];
          if(previous!==row.status)db.events.push({id:'event-'+db.events.length,memory_id:row.id,owner_id:row.owner_id,project_id:row.project_id,event_type:'status_changed',from_status:previous,to_status:row.status,occurred_at:row.updated_at});
          if(row.status==='accepted'&&row.supersedes_id){
            const old=db.rows.get(row.supersedes_id);
            if(old&&old.owner_id===row.owner_id&&old.project_id===row.project_id&&old.status==='accepted'){
              old.status='superseded';old.updated_at=row.updated_at;
              db.events.push({id:'event-'+db.events.length,memory_id:old.id,owner_id:old.owner_id,project_id:old.project_id,event_type:'status_changed',from_status:'accepted',to_status:'superseded',occurred_at:old.updated_at});
            }
          }
          return {meta:{changes:1}};
        }
        return {meta:{changes:0}};
      },
      async first(){
        const v=this.values;
        if(sql.includes('FROM aegis_memories')){
          const row=db.rows.get(v[0]);
          return row&&row.owner_id===v[1]&&row.project_id===v[2]?{...row}:null;
        }
        if(sql.includes('FROM project_spaces')){
          return {id:v[0],owner_id:v[1],status:'active'};
        }
        return null;
      },
      async all(){
        const v=this.values;
        if(sql.includes('FROM aegis_memory_events'))return {results:db.events.filter(x=>x.memory_id===v[0]&&x.owner_id===v[1]&&x.project_id===v[2]).map(x=>({...x}))};
        return {results:[]};
      }
    };
  }
}

async function req(path,{method='GET',body}={}){
  const token=await createSessionToken(secret);
  return new Request('https://aegis.example'+path,{
    method,headers:{Origin:'https://aegis.example',Cookie:'__Host-aegis_session='+token,'Content-Type':'application/json'},
    ...(body===undefined?{}:{body:JSON.stringify(body)}),
  });
}

test('a correction remains a candidate until accepted, then supersedes the prior memory with audit history',async()=>{
  const db=new CorrectionD1();const env={...envBase,AEGIS_DB:db};
  const created=await createMemory({request:await req('/api/memories',{method:'POST',body:{
    kind:'fact',content:'Old fact to correct.',
    source:{type:'user-stated',url:'https://aegis.example/source',attribution:'Owner statement'},
    confidence:1,sensitivity:'private',
  }}),env});
  const old=(await created.json()).memory;
  await reviewMemory({request:await req('/api/memories/'+old.id,{method:'PATCH',body:{status:'accepted'}}),env,params:{id:old.id}});
  const correction=await correctMemory({
    request:await req('/api/memories/'+old.id+'/corrections',{method:'POST',body:{content:'Corrected fact.'}}),
    env,params:{id:old.id},
  });
  assert.equal(correction.status,201);
  const replacement=(await correction.json()).memory;
  assert.equal(replacement.status,'candidate');
  assert.equal(replacement.supersedesId,old.id);
  assert.equal(db.rows.get(old.id).status,'accepted');

  const accepted=await reviewMemory({
    request:await req('/api/memories/'+replacement.id,{method:'PATCH',body:{status:'accepted'}}),
    env,params:{id:replacement.id},
  });
  assert.equal(accepted.status,200);
  assert.equal(db.rows.get(old.id).status,'superseded');
  assert.equal(db.rows.get(replacement.id).status,'accepted');
  const oldEvents=db.events.filter(event=>event.memory_id===old.id);
  assert.equal(oldEvents.at(-1).to_status,'superseded');
});

test('correction endpoint rejects unauthenticated and unknown-target requests',async()=>{
  const db=new CorrectionD1();const env={...envBase,AEGIS_DB:db};
  const unauth=await correctMemory({
    request:new Request('https://aegis.example/api/memories/missing/corrections',{method:'POST'}),
    env,params:{id:'missing'},
  });
  assert.equal(unauth.status,401);
  const missing=await correctMemory({
    request:await req('/api/memories/missing/corrections',{method:'POST',body:{content:'Replacement'}}),
    env,params:{id:'missing'},
  });
  assert.equal(missing.status,404);
});
