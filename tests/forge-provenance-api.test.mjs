import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken } from '../functions/lib/auth.mjs';
import { onRequestGet, onRequestPost } from '../functions/api/forge/provenance.js';

const secret='forge-provenance-api-test-secret-long-enough';
const envBase={AEGIS_PASSWORD:'test-password-long-enough',AEGIS_SESSION_SECRET:secret};

class ProvenanceApiD1 {
 constructor(){this.rows=new Map();}
 prepare(sql){
  const db=this;
  return {
   values:[],
   bind(...values){this.values=values;return this;},
   async run(){
    const v=this.values;
    if(sql.includes('INSERT INTO forge_source_provenance')){
     const key=v[1]+'|'+v[2]+'|'+v[3];
     if([...db.rows.values()].some(row=>row.key===key))return {meta:{changes:0}};
     db.rows.set(v[0],{id:v[0],owner_id:v[1],canonical_url:v[2],revision:v[3],record_json:v[4],created_at:v[5],updated_at:v[6],key});
     return {meta:{changes:1}};
    }
    return {meta:{changes:0}};
   },
   async first(){
    const [owner,url,revision]=this.values;
    const row=[...db.rows.values()].find(x=>x.owner_id===owner&&x.canonical_url===url&&x.revision===revision);
    return row?{...row}:null;
   },
   async all(){
    const [owner,limit]=this.values;
    return {results:[...db.rows.values()].filter(x=>x.owner_id===owner).slice(0,limit).map(x=>({...x}))};
   },
  };
 }
}

async function request(path,body,{authenticated=true,origin='https://aegis.example',method}={}){
 const headers={'Content-Type':'application/json',Origin:origin};
 if(authenticated)headers.Cookie='__Host-aegis_session='+await createSessionToken(secret);
 return new Request('https://aegis.example'+path,{method:method||(body===undefined?'GET':'POST'),headers,...(body===undefined?{}:{body:JSON.stringify(body)})});
}
const record={
 id:'simplewebauthn-server',
 canonicalUrl:'https://github.com/MasterKale/SimpleWebAuthn',
 revision:'a'.repeat(40),
 inspectedAt:'2026-11-17T02:00:00.000Z',
 inspectionDepth:'source-level',
 licence:{identifier:'MIT',licenceFileUrl:'https://github.com/MasterKale/SimpleWebAuthn/blob/main/LICENSE',review:'verified'},
 components:[],
 capabilities:['identity.passkeys'],
 decision:'adapt',
 status:'assessed',
 evidence:[{url:'https://github.com/MasterKale/SimpleWebAuthn/tree/main/packages/server',note:'Source-level inspection evidence.'}],
};

test('Forge provenance API requires authentication and same-origin writes',async()=>{
 const db=new ProvenanceApiD1();
 const unauth=await onRequestGet({request:await request('/api/forge/provenance',undefined,{authenticated:false}),env:{...envBase,AEGIS_DB:db}});
 assert.equal(unauth.status,401);
 const cross=await onRequestPost({request:await request('/api/forge/provenance',record,{origin:'https://attacker.example'}),env:{...envBase,AEGIS_DB:db}});
 assert.equal(cross.status,403);
});

test('Forge provenance API persists a validated record and returns owner-scoped records',async()=>{
 const db=new ProvenanceApiD1();
 const created=await onRequestPost({request:await request('/api/forge/provenance',record),env:{...envBase,AEGIS_DB:db}});
 assert.equal(created.status,201);
 assert.equal((await created.json()).record.revision,'a'.repeat(40));
 const duplicate=await onRequestPost({request:await request('/api/forge/provenance',record),env:{...envBase,AEGIS_DB:db}});
 assert.equal(duplicate.status,200);
 assert.equal((await duplicate.json()).duplicate,true);
 const list=await onRequestGet({request:await request('/api/forge/provenance'),env:{...envBase,AEGIS_DB:db}});
 assert.equal((await list.json()).total,1);
});

test('Forge provenance API rejects unresolved licences for adaptation',async()=>{
 const invalid={...record,components:[{kind:'model',name:'weights',identifier:'restricted',licenceFileUrl:'https://example.org/model/LICENSE',review:'review-required'}]};
 const response=await onRequestPost({request:await request('/api/forge/provenance',invalid),env:{...envBase,AEGIS_DB:new ProvenanceApiD1()}});
 assert.equal(response.status,400);
});
