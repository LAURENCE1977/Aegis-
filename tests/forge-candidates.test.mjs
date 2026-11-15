import test from 'node:test';
import assert from 'node:assert/strict';
import { createForgeCandidate, listForgeCandidates } from '../functions/lib/forge-candidates.mjs';

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
          if([...db.rows.values()].some(row=>row.uniqueKey===key)) return {meta:{changes:0}};
          const row={
            id:v[0],owner_id:v[1],source_type:v[2],source_url:v[3],version:v[4],
            licence_identifier:v[5],licence_review:v[6],decision:v[7],status:v[8],
            capabilities_json:v[9],dependencies_json:v[10],evidence_json:v[11],
            metadata_json:v[12],created_at:v[13],updated_at:v[14],uniqueKey:key,
          };
          db.rows.set(row.id,row);
          db.events.push({candidate_id:row.id,owner_id:row.owner_id,event_type:'created'});
          return {meta:{changes:1}};
        }
        return {meta:{changes:0}};
      },
      async first(){
        const v=this.values;
        if(sql.includes('FROM forge_candidates')&&sql.includes('source_url = ?')){
          const row=[...db.rows.values()].find(x=>x.owner_id===v[0]&&x.source_url===v[1]&&x.version===v[2]);
          return row?{...row}:null;
        }
        return null;
      },
      async all(){
        const v=this.values;
        if(sql.includes('FROM forge_candidates')){
          return {results:[...db.rows.values()].filter(x=>x.owner_id===v[0]).sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,v[1]).map(x=>({...x}))};
        }
        return {results:[]};
      },
    };
  }
}

const repository=()=>({
  sourceType:'repository',
  sourceUrl:'https://github.com/example/agent',
  fullName:'example/agent',
  description:'A public agent project',
  defaultBranch:'main',
  treeSha:'a'.repeat(40),
  archived:false,
  fork:false,
  stars:42,
  primaryLanguage:'TypeScript',
  licenseSpdx:'MIT',
  licenseName:'MIT License',
});

test('Forge candidate records pin the inspected source and require licence review before reuse',async()=>{
  const db=new CandidateD1();
  const result=await createForgeCandidate(db,'owner',repository());
  assert.equal(result.created,true);
  assert.equal(result.candidate.metadata.fullName,'example/agent');
  assert.equal(result.candidate.version,'a'.repeat(40));
  assert.equal(result.candidate.licence.identifier,'MIT');
  assert.equal(result.candidate.licence.review,'review-required');
  assert.equal(result.candidate.decision,'unassessed');
  assert.equal(result.candidate.status,'inspected');
  assert.equal(db.events.length,1);
});

test('Forge candidate creation is idempotent for the same owner, source and pinned tree',async()=>{
  const db=new CandidateD1();
  const first=await createForgeCandidate(db,'owner',repository());
  const second=await createForgeCandidate(db,'owner',repository());
  assert.equal(first.created,true);
  assert.equal(second.created,false);
  assert.equal(second.candidate.id,first.candidate.id);
  assert.equal(db.rows.size,1);
  assert.equal(db.events.length,1);
});

test('Forge candidate lists are isolated to the authenticated owner',async()=>{
  const db=new CandidateD1();
  await createForgeCandidate(db,'owner',repository());
  await createForgeCandidate(db,'another-owner',{...repository(),sourceUrl:'https://github.com/example/other'});
  const results=await listForgeCandidates(db,'owner');
  assert.equal(results.length,1);
  assert.equal(results[0].ownerId,'owner');
});
