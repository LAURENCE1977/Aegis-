import test from 'node:test';
import assert from 'node:assert/strict';
import { createRevocableSessionToken } from '../functions/lib/auth.mjs';
import { onRequestGet } from '../functions/api/memories/export.js';

const secret='memory-export-test-session-secret-long-enough';
const sessions=new Map();
const envBase={AEGIS_PASSWORD:'test-password-long-enough',AEGIS_SESSION_SECRET:secret};

const memoryRow={
  id:'memory-export-1',owner_id:'usr-root',principal_id:'usr-root',tenant_id:'org-root',project_id:null,supersedes_id:null,
  kind:'preference',content:'Owner memory for export.',
  source_type:'user-stated',source_url:'https://aegis.example/source',
  source_attribution:'Owner supplied',source_observed_at:'2026-11-15T12:00:00.000Z',
  confidence:1,sensitivity:'private',status:'retracted',tags_json:'["export"]',
  created_at:'2026-11-15T12:00:00.000Z',updated_at:'2026-11-15T12:00:00.000Z',expires_at:null,
};
const eventRow={
  id:'event-export-1',memory_id:'memory-export-1',owner_id:'usr-root',principal_id:'usr-root',tenant_id:'org-root',project_id:null,
  event_type:'status_changed',from_status:'candidate',to_status:'retracted',
  occurred_at:'2026-11-15T12:00:00.000Z',
};

class ExportD1 {
  constructor(){this.queries=[];}
  prepare(sql){
    const db=this;
    if(sql.includes('FROM auth_sessions'))return {bind(sid,now){return {first:async()=>{const row=sessions.get(sid);return row&&row.expires_at>now&&!row.revoked_at?{session_id:sid,...row}:null;}};}};
    return {
      values:[],
      bind(...values){this.values=values;return this;},
      async all(){
        db.queries.push({sql,values:this.values});
        if(sql.includes('FROM aegis_memories')) return {results:[{...memoryRow}]};
        if(sql.includes('FROM aegis_memory_events')) return {results:[{...eventRow}]};
        return {results:[]};
      },
      async first(){
        db.queries.push({sql,values:this.values});
        if(sql.includes('FROM project_spaces')) return {id:this.values[0],owner_id:'usr-root',principal_id:'usr-root',tenant_id:'org-root',status:'active'};
        return null;
      },
    };
  }
}

async function makeRequest(path='/api/memories/export',{authenticated=true}={}){
  const headers={Origin:'https://aegis.example'};
  if(authenticated) headers.Cookie='__Host-aegis_session='+(await (async()=>{const session=await createRevocableSessionToken(secret);sessions.set(session.sessionId,{expires_at:session.expiresAt,revoked_at:null,principal_id:'usr-root',tenant_id:'org-root',roles_json:'[\"owner\"]'});return session.token;})());
  return new Request('https://aegis.example'+path,{headers});
}

test('memory export requires the signed owner session before touching storage',async()=>{
  const db=new ExportD1();
  const response=await onRequestGet({request:await makeRequest('/api/memories/export',{authenticated:false}),env:{...envBase,AEGIS_DB:db}});
  assert.equal(response.status,401);
  assert.equal(db.queries.length,0);
});

test('owner export includes all lifecycle states and audit history without caching',async()=>{
  const db=new ExportD1();
  const response=await onRequestGet({request:await makeRequest(),env:{...envBase,AEGIS_DB:db}});
  assert.equal(response.status,200);
  assert.match(response.headers.get('content-type'),/application\/json/);
  assert.match(response.headers.get('cache-control'),/no-store/);
  assert.match(response.headers.get('content-disposition'),/attachment/);
  const data=await response.json();
  assert.equal(data.memories[0].status,'retracted');
  assert.equal(data.memories[0].content,'Owner memory for export.');
  assert.equal(data.events[0].toStatus,'retracted');
  assert.deepEqual(db.queries[0].values,['org-root','usr-root',1,null,501]);
  assert.deepEqual(db.queries[1].values,['org-root','usr-root',1,null,2001]);
});

test('project export verifies active owner scope and never broadens to other projects',async()=>{
  const db=new ExportD1();
  const response=await onRequestGet({
    request:await makeRequest('/api/memories/export?projectId=project-123'),
    env:{...envBase,AEGIS_DB:db},
  });
  assert.equal(response.status,200);
  const queries=db.queries.filter(query=>query.sql.includes('FROM aegis_memories')||query.sql.includes('FROM aegis_memory_events'));
  assert.ok(queries.every(query=>query.values[0]==='org-root'&&query.values[1]==='usr-root'&&query.values[2]===0&&query.values[3]==='project-123'));
});

test('memory export rejects malformed project scope',async()=>{
  const response=await onRequestGet({
    request:await makeRequest('/api/memories/export?projectId=bad%20scope'),
    env:{...envBase,AEGIS_DB:new ExportD1()},
  });
  assert.equal(response.status,400);
});
