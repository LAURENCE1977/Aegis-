import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken } from '../functions/lib/auth.mjs';
import { onRequestPost } from '../functions/api/forge/candidates/[id]/provenance.js';

const secret='forge-provenance-link-api-test-secret-long-enough';
const envBase={AEGIS_PASSWORD:'test-password-long-enough',AEGIS_SESSION_SECRET:secret};
const candidate={id:'candidate-1',owner_id:'owner',source_url:'https://github.com/example/project',version:'a'.repeat(40),status:'assessed'};
const provenance={id:'provenance-1',owner_id:'owner',canonical_url:'https://github.com/example/project',revision:'a'.repeat(40)};
class LinkApiD1{
 constructor(){this.links=[];}
 prepare(sql){
  const db=this;
  return {
   values:[],bind(...values){this.values=values;return this;},
   async first(){
    const v=this.values;
    if(sql.includes('FROM forge_candidates WHERE id = ?'))return v[0]===candidate.id&&v[1]==='owner'?candidate:null;
    if(sql.includes('FROM forge_source_provenance WHERE id = ?'))return v[0]===provenance.id&&v[1]==='owner'?provenance:null;
    if(sql.includes('FROM forge_candidate_provenance_links'))return db.links.find(x=>x.owner_id===v[0]&&x.candidate_id===v[1]&&x.provenance_id===v[2])||null;
    return null;
   },
   async run(){
    if(sql.includes('INSERT INTO forge_candidate_provenance_links')){
     const [id,owner,candidateId,provenanceId,created]=this.values;
     if(!db.links.some(x=>x.owner_id===owner&&x.candidate_id===candidateId&&x.provenance_id===provenanceId))
      db.links.push({id,owner_id:owner,candidate_id:candidateId,provenance_id:provenanceId,created_at:created});
     return {meta:{changes:1}};
    }
    return {meta:{changes:0}};
   },
  };
 }
}
async function request(body,{authenticated=true,origin='https://aegis.example'}={}){
 const headers={'Content-Type':'application/json',Origin:origin};
 if(authenticated)headers.Cookie='__Host-aegis_session='+await createSessionToken(secret);
 return new Request('https://aegis.example/api/forge/candidates/candidate-1/provenance',{method:'POST',headers,body:JSON.stringify(body)});
}

test('candidate provenance link API requires owner authentication and same-origin requests',async()=>{
 const db=new LinkApiD1();
 const unauth=await onRequestPost({request:await request({provenanceId:'provenance-1'},{authenticated:false}),env:{...envBase,AEGIS_DB:db},params:{id:'candidate-1'}});
 assert.equal(unauth.status,401);
 const cross=await onRequestPost({request:await request({provenanceId:'provenance-1'},{origin:'https://attacker.example'}),env:{...envBase,AEGIS_DB:db},params:{id:'candidate-1'}});
 assert.equal(cross.status,403);
});

test('candidate provenance link API links exact source revision and rejects unknown body fields',async()=>{
 const db=new LinkApiD1();
 const linked=await onRequestPost({request:await request({provenanceId:'provenance-1'}),env:{...envBase,AEGIS_DB:db},params:{id:'candidate-1'}});
 assert.equal(linked.status,201);
 assert.equal((await linked.json()).link.provenanceId,'provenance-1');
 const invalid=await onRequestPost({request:await request({provenanceId:'provenance-1',decision:'approve'}),env:{...envBase,AEGIS_DB:db},params:{id:'candidate-1'}});
 assert.equal(invalid.status,400);
});
