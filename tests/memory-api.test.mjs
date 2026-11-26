import test from 'node:test';
import assert from 'node:assert/strict';
import { createRevocableSessionToken } from '../functions/lib/auth.mjs';
import { onRequestGet, onRequestPost } from '../functions/api/memories.js';
import { onRequestGet as memoryEventsGet } from '../functions/api/memories/[id]/events.js';
import {
  onRequestGet as memoryGet,
  onRequestPatch as memoryPatch,
} from '../functions/api/memories/[id].js';

const secret = 'memory-api-test-session-secret-with-enough-entropy';
const envBase = { AEGIS_PASSWORD: 'test-password-long-enough', AEGIS_SESSION_SECRET: secret };
const sessions = new Map();

class MemoryD1 {
  constructor() { this.memories = new Map(); this.projects = new Map(); this.events = []; }
  prepare(sql) {
    const db = this;
    if (sql.includes('FROM auth_sessions')) return { bind(sid, now) { return { first: async () => { const row = sessions.get(sid); return row && row.expires_at > now && !row.revoked_at ? { session_id: sid, ...row } : null; } }; } };
    return {
      values: [],
      bind(...values) { this.values = values; return this; },
      async run() {
        const v = this.values;
        if (sql.includes('INSERT INTO aegis_memories')) {
          db.memories.set(v[0], {
            id:v[0], owner_id:v[1], principal_id:v[2], tenant_id:v[3], project_id:v[4], kind:v[5], content:v[6],
            source_type:v[7], source_url:v[8], source_attribution:v[9],
            source_observed_at:v[10], confidence:v[11], sensitivity:v[12],
            status:v[13], tags_json:v[14], created_at:v[15], updated_at:v[16], expires_at:v[17],
          });
          db.events.push({id:'event-'+db.events.length,memory_id:v[0],owner_id:v[1],principal_id:v[2],tenant_id:v[3],project_id:v[4],event_type:'created',from_status:null,to_status:v[13],occurred_at:v[15]});
          return {meta:{changes:1}};
        }
        if (sql.includes('UPDATE aegis_memories')) {
          const row=db.memories.get(v[2]);
          if (!row || row.tenant_id!==v[3] || row.principal_id!==v[4] || row.project_id!==v[5] ||
              !['candidate','accepted'].includes(row.status)) return {meta:{changes:0}};
          const previous=row.status;
          row.status=v[0]; row.updated_at=v[1];
          if (previous!==v[0]) db.events.push({id:'event-'+db.events.length,memory_id:row.id,owner_id:row.owner_id,principal_id:row.principal_id,tenant_id:row.tenant_id,project_id:row.project_id,event_type:'status_changed',from_status:previous,to_status:v[0],occurred_at:v[1]});
          return {meta:{changes:1}};
        }
        return {meta:{changes:0}};
      },
      async first() {
        const v=this.values;
        if (sql.includes('FROM aegis_memories')) {
          const row=db.memories.get(v[0]);
          return row && row.tenant_id===v[1] && row.principal_id===v[2] && row.project_id===v[3] ? {...row} : null;
        }
        if (sql.includes('FROM project_spaces')) {
          const row=db.projects.get(v[0]);
          return row && row.tenant_id===v[1] && row.principal_id===v[2] ? {...row} : null;
        }
        return null;
      },
      async all() {
        const v=this.values;
        if (sql.includes('FROM aegis_memory_events')) return {results:db.events.filter(event=>event.memory_id===v[0] && event.tenant_id===v[1] && event.principal_id===v[2] && event.project_id===v[3]).slice(0,v[4]).map(event=>({...event}))};
        if (!sql.includes('FROM aegis_memories')) return {results:[]};
        let rows=[...db.memories.values()].filter(row=>
          row.tenant_id===v[0] && row.principal_id===v[1] && row.project_id===v[2] && (row.status==='accepted' || (sql.includes("'accepted', 'candidate'") && row.status==='candidate')) && row.sensitivity!=='restricted' &&
          (!row.expires_at || row.expires_at>v[3]));
        if (sql.includes('LIKE')) {
          const terms=v.slice(4,-1);
          rows=rows.filter(row=>terms.some(term=>
            (row.content+' '+row.kind+' '+row.tags_json).toLowerCase()
              .includes(term.slice(1,-1).toLowerCase())));
          rows.sort((a,b)=>b.confidence-a.confidence || b.updated_at.localeCompare(a.updated_at));
          return {results:rows.slice(0,v[v.length-1]).map(row=>({...row}))};
        }
        rows.sort((a,b)=>b.updated_at.localeCompare(a.updated_at));
        return {results:rows.slice(0,v[4]).map(row=>({...row}))};
      },
    };
  }
}

async function request(path, {method='GET',body,origin='https://aegis.example'}={}) {
  const session=await createRevocableSessionToken(secret);
  sessions.set(session.sessionId,{expires_at:session.expiresAt,revoked_at:null,principal_id:'usr-root',tenant_id:'org-root',roles_json:'[\"owner\"]'});
  const token=session.token;
  const headers={Cookie:'__Host-aegis_session='+token};
  if (origin!==null) headers.Origin=origin;
  if (body!==undefined) headers['Content-Type']='application/json';
  return new Request('https://aegis.example'+path,{
    method,headers,...(body===undefined?{}:{body:JSON.stringify(body)}),
  });
}

const memoryInput = {
  kind:'preference',
  content:'Prefer concise human storytelling and clear emotional hooks.',
  source:{type:'user-stated',url:'https://aegis.example/conversation/1',attribution:'Explicit owner statement'},
  confidence:1,
  sensitivity:'private',
  tags:['writing','storytelling'],
};

test('memory API rejects unauthenticated reads before touching D1', async()=>{
  const response=await onRequestGet({
    request:new Request('https://aegis.example/api/memories'),
    env:{...envBase,AEGIS_DB:{prepare(){throw new Error('must not access D1');}}},
  });
  assert.equal(response.status,401);
});

test('new memories enter candidate review and become searchable only after owner acceptance', async()=>{
  const db=new MemoryD1();
  const created=await onRequestPost({
    request:await request('/api/memories',{method:'POST',body:memoryInput}),
    env:{...envBase,AEGIS_DB:db},
  });
  assert.equal(created.status,201,await created.clone().text());
  const {memory,reviewRequired}=await created.json();
  assert.equal(reviewRequired,true);
  assert.equal(memory.status,'candidate');

  const hidden=await onRequestGet({
    request:await request('/api/memories?q=storytelling'),
    env:{...envBase,AEGIS_DB:db},
  });
  assert.equal((await hidden.json()).total,0);

  const reviewed=await memoryPatch({
    request:await request('/api/memories/'+memory.id,{method:'PATCH',body:{status:'accepted'}}),
    env:{...envBase,AEGIS_DB:db},
    params:{id:memory.id},
  });
  assert.equal(reviewed.status,200);
  assert.equal((await reviewed.json()).memory.status,'accepted');

  const found=await onRequestGet({
    request:await request('/api/memories?q=concise%20storytelling'),
    env:{...envBase,AEGIS_DB:db},
  });
  assert.equal(found.status,200);
  assert.equal((await found.json()).memories[0].id,memory.id);
});

test('memory writes and lifecycle changes require same-origin requests', async()=>{
  const db=new MemoryD1();
  const response=await onRequestPost({
    request:await request('/api/memories',{method:'POST',origin:'https://attacker.example',body:memoryInput}),
    env:{...envBase,AEGIS_DB:db},
  });
  assert.equal(response.status,403);
  assert.equal(db.memories.size,0);
});

test('project memories require an existing active owner workspace', async()=>{
  const db=new MemoryD1();
  const invalid=await onRequestPost({
    request:await request('/api/memories',{method:'POST',body:{...memoryInput,projectId:'missing-project'}}),
    env:{...envBase,AEGIS_DB:db},
  });
  assert.equal(invalid.status,404);
  assert.equal(db.memories.size,0);

  db.projects.set('project-a',{
    id:'project-a',owner_id:'usr-root',principal_id:'usr-root',tenant_id:'org-root',name:'Project A',description:'',
    status:'active',created_at:new Date().toISOString(),updated_at:new Date().toISOString(),
  });
  const valid=await onRequestPost({
    request:await request('/api/memories',{method:'POST',body:{...memoryInput,projectId:'project-a'}}),
    env:{...envBase,AEGIS_DB:db},
  });
  assert.equal(valid.status,201);
  assert.equal((await valid.json()).memory.projectId,'project-a');
});

test('memory review rejects unknown fields and cannot change another owner scope', async()=>{
  const db=new MemoryD1();
  const created=await onRequestPost({
    request:await request('/api/memories',{method:'POST',body:memoryInput}),
    env:{...envBase,AEGIS_DB:db},
  });
  const {memory}=await created.json();
  const invalid=await memoryPatch({
    request:await request('/api/memories/'+memory.id,{method:'PATCH',body:{status:'accepted',ownerId:'attacker'}}),
    env:{...envBase,AEGIS_DB:db},params:{id:memory.id},
  });
  assert.equal(invalid.status,400);
  const wrongScope=await memoryGet({
    request:await request('/api/memories/'+memory.id+'?projectId=project-a'),
    env:{...envBase,AEGIS_DB:db},params:{id:memory.id},
  });
  assert.equal(wrongScope.status,404);
});

test('retracted memories cannot be retrieved through the collection search', async()=>{
  const db=new MemoryD1();
  const created=await onRequestPost({
    request:await request('/api/memories',{method:'POST',body:memoryInput}),
    env:{...envBase,AEGIS_DB:db},
  });
  const {memory}=await created.json();
  await memoryPatch({
    request:await request('/api/memories/'+memory.id,{method:'PATCH',body:{status:'accepted'}}),
    env:{...envBase,AEGIS_DB:db},params:{id:memory.id},
  });
  await memoryPatch({
    request:await request('/api/memories/'+memory.id,{method:'PATCH',body:{status:'retracted'}}),
    env:{...envBase,AEGIS_DB:db},params:{id:memory.id},
  });
  const response=await onRequestGet({
    request:await request('/api/memories?q=storytelling'),
    env:{...envBase,AEGIS_DB:db},
  });
  assert.equal((await response.json()).total,0);
});


test('memory lifecycle history is authenticated and does not expose another scope', async()=>{
  const db=new MemoryD1();
  const created=await onRequestPost({
    request:await request('/api/memories',{method:'POST',body:memoryInput}),
    env:{...envBase,AEGIS_DB:db},
  });
  const {memory}=await created.json();
  await memoryPatch({
    request:await request('/api/memories/'+memory.id,{method:'PATCH',body:{status:'accepted'}}),
    env:{...envBase,AEGIS_DB:db},params:{id:memory.id},
  });
  const history=await memoryEventsGet({
    request:await request('/api/memories/'+memory.id+'/events'),
    env:{...envBase,AEGIS_DB:db},params:{id:memory.id},
  });
  assert.equal(history.status,200);
  const {events}=await history.json();
  assert.deepEqual(events.map(event=>event.toStatus),['candidate','accepted']);
  const denied=await memoryEventsGet({
    request:new Request('https://aegis.example/api/memories/'+memory.id+'/events'),
    env:{...envBase,AEGIS_DB:db},params:{id:memory.id},
  });
  assert.equal(denied.status,401);
});


test('owner review queue includes candidates but normal memory reads do not', async()=>{
  const db=new MemoryD1();
  const created=await onRequestPost({
    request:await request('/api/memories',{method:'POST',body:memoryInput}),
    env:{...envBase,AEGIS_DB:db},
  });
  const {memory}=await created.json();
  const ordinary=await onRequestGet({
    request:await request('/api/memories'),
    env:{...envBase,AEGIS_DB:db},
  });
  assert.equal((await ordinary.json()).total,0);
  const review=await onRequestGet({
    request:await request('/api/memories?review=1'),
    env:{...envBase,AEGIS_DB:db},
  });
  assert.equal((await review.json()).memories[0].id,memory.id);
});
