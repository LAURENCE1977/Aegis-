import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken } from '../functions/lib/auth.mjs';
import { onRequestDelete } from '../functions/api/memories/[id].js';

const secret='memory-purge-api-test-session-secret-long-enough';
const env={AEGIS_PASSWORD:'test-password-long-enough',AEGIS_SESSION_SECRET:secret};

class PurgeD1 {
  constructor(){this.calls=[];}
  prepare(sql){const db=this;return {sql,values:[],bind(...values){this.values=values;return this;}};}
  async batch(statements){
    this.calls=statements.map(s=>({sql:s.sql,values:s.values}));
    return [{meta:{changes:1}},{meta:{changes:1}}];
  }
}

async function request(id,body,{authenticated=true,origin='https://aegis.example'}={}){
  const headers={'Content-Type':'application/json',Origin:origin};
  if(authenticated)headers.Cookie='__Host-aegis_session='+await createSessionToken(secret);
  return new Request('https://aegis.example/api/memories/'+id,{
    method:'DELETE',headers,body:JSON.stringify(body),
  });
}

test('permanent memory purge requires owner authentication and same-origin confirmation',async()=>{
  const db=new PurgeD1();
  const unauth=await onRequestDelete({request:await request('memory-1',{confirm:true},{authenticated:false}),env:{...env,AEGIS_DB:db},params:{id:'memory-1'}});
  assert.equal(unauth.status,401);
  const cross=await onRequestDelete({request:await request('memory-1',{confirm:true},{origin:'https://attacker.example'}),env:{...env,AEGIS_DB:db},params:{id:'memory-1'}});
  assert.equal(cross.status,403);
  const noConfirm=await onRequestDelete({request:await request('memory-1',{confirm:false}),env:{...env,AEGIS_DB:db},params:{id:'memory-1'}});
  assert.equal(noConfirm.status,400);
  assert.equal(db.calls.length,0);
});

test('owner can permanently purge one exact personal or project memory',async()=>{
  const db=new PurgeD1();
  const response=await onRequestDelete({
    request:await request('memory-1',{confirm:true,projectId:'project-1'}),
    env:{...env,AEGIS_DB:db},params:{id:'memory-1'},
  });
  assert.equal(response.status,200);
  const data=await response.json();
  assert.equal(data.purged,true);
  assert.deepEqual(db.calls[1].values,['memory-1','owner','project-1']);
  assert.match(db.calls[0].sql,/SET supersedes_id = NULL/);
});

test('purge endpoint rejects unknown body fields and invalid memory identifiers',async()=>{
  const db=new PurgeD1();
  const extra=await onRequestDelete({
    request:await request('memory-1',{confirm:true,ownerId:'other'}),
    env:{...env,AEGIS_DB:db},params:{id:'memory-1'},
  });
  assert.equal(extra.status,400);
  const badId=await onRequestDelete({
    request:await request('../other',{confirm:true}),
    env:{...env,AEGIS_DB:db},params:{id:'../other'},
  });
  assert.equal(badId.status,404);
});
