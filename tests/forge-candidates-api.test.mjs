import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken } from '../functions/lib/auth.mjs';
import { onRequestGet, onRequestPost } from '../functions/api/forge/candidates.js';

const secret='forge-candidate-api-test-session-secret-long-enough';
const envBase={AEGIS_PASSWORD:'test-password-long-enough',AEGIS_SESSION_SECRET:secret};

class CandidateD1 {
  constructor(){this.rows=new Map();this.events=[];}
  prepare(sql){
    const db=this;
    return {
      values:[],
      bind(...values){this.values=values;return this;},
      async run(){
        const v=this.values;
        if(sql.includes('INSERT INTO forge_candidates')){
          const key=v[1]+'|'+v[3]+'|'+v[4];
          if([...db.rows.values()].some(row=>row.uniqueKey===key))return {meta:{changes:0}};
          const row={
            id:v[0],owner_id:v[1],source_type:v[2],source_url:v[3],version:v[4],
            licence_identifier:v[5],licence_review:v[6],decision:v[7],status:v[8],
            capabilities_json:v[9],dependencies_json:v[10],evidence_json:v[11],
            metadata_json:v[12],created_at:v[13],updated_at:v[14],uniqueKey:key,
          };
          db.rows.set(row.id,row);db.events.push({candidate_id:row.id});return {meta:{changes:1}};
        }
        return {meta:{changes:0}};
      },
      async first(){
        const v=this.values;
        if(sql.includes('FROM forge_candidates'))return [...db.rows.values()].find(row=>row.owner_id===v[0]&&row.source_url===v[1]&&row.version===v[2])||null;
        return null;
      },
      async all(){
        const v=this.values;
        if(sql.includes('FROM forge_candidates'))return {results:[...db.rows.values()].filter(row=>row.owner_id===v[0]).slice(0,v[1])};
        return {results:[]};
      },
    };
  }
}

async function request(path,body,{authenticated=true,origin='https://aegis.example'}={}){
  const headers={'Content-Type':'application/json',Origin:origin};
  if(authenticated)headers.Cookie='__Host-aegis_session='+await createSessionToken(secret);
  return new Request('https://aegis.example'+path,{method:body===undefined?'GET':'POST',headers,...(body===undefined?{}:{body:JSON.stringify(body)})});
}

function githubFetch(url){
  if(url.endsWith('/repos/example/agent'))return Promise.resolve({ok:true,status:200,async json(){return {
    full_name:'example/agent',html_url:'https://github.com/example/agent',default_branch:'main',
    private:false,description:'Public project',archived:false,fork:false,stargazers_count:7,
    language:'TypeScript',license:{spdx_id:'MIT',name:'MIT License'},
  };}});
  return Promise.resolve({ok:true,status:200,async json(){return {
    sha:'a'.repeat(40),truncated:false,tree:[{path:'README.md',type:'blob',sha:'b'.repeat(40),size:20}],
  };}});
}

test('Forge candidate intake requires owner authentication and same-origin writes',async()=>{
  const unauth=await onRequestPost({request:await request('/api/forge/candidates',{sourceUrl:'https://github.com/example/agent'},{authenticated:false}),env:envBase});
  assert.equal(unauth.status,401);
  const cross=await onRequestPost({request:await request('/api/forge/candidates',{sourceUrl:'https://github.com/example/agent'},{origin:'https://attacker.example'}),env:{...envBase,AEGIS_DB:new CandidateD1()},fetchImpl:githubFetch});
  assert.equal(cross.status,403);
});

test('Forge candidate intake pins the inspected tree and keeps licence review pending',async()=>{
  const db=new CandidateD1();
  const response=await onRequestPost({
    request:await request('/api/forge/candidates',{sourceUrl:'https://github.com/example/agent'}),
    env:{...envBase,AEGIS_DB:db},fetchImpl:githubFetch,
  });
  assert.equal(response.status,201);
  const data=await response.json();
  assert.equal(data.candidate.version,'a'.repeat(40));
  assert.equal(data.candidate.licence.identifier,'MIT');
  assert.equal(data.candidate.licence.review,'review-required');
  assert.equal(data.candidate.decision,'unassessed');
  assert.equal(data.licenceReviewRequired,true);
});

test('Forge candidate intake is idempotent and listing stays owner-scoped',async()=>{
  const db=new CandidateD1();
  const make=()=>request('/api/forge/candidates',{sourceUrl:'https://github.com/example/agent'});
  const first=await onRequestPost({request:await make(),env:{...envBase,AEGIS_DB:db},fetchImpl:githubFetch});
  const second=await onRequestPost({request:await make(),env:{...envBase,AEGIS_DB:db},fetchImpl:githubFetch});
  assert.equal(first.status,201);
  assert.equal(second.status,200);
  const listed=await onRequestGet({request:await request('/api/forge/candidates'),env:{...envBase,AEGIS_DB:db}});
  assert.equal(listed.status,200);
  const data=await listed.json();
  assert.equal(data.total,1);
  assert.equal(data.candidates[0].ownerId,'owner');
});
