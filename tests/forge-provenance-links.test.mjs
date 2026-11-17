import test from 'node:test';
import assert from 'node:assert/strict';
import { linkForgeCandidateProvenance } from '../functions/lib/forge-provenance.mjs';

class LinkD1 {
 constructor(){this.candidates=new Map();this.provenance=new Map();this.links=new Map();}
 prepare(sql){
  const db=this;
  return {
   values:[],
   bind(...values){this.values=values;return this;},
   async first(){
    const v=this.values;
    if(sql.includes('FROM forge_candidates WHERE id = ? AND owner_id = ?')){
     const row=db.candidates.get(v[0]);return row?.owner_id===v[1]?{...row}:null;
    }
    if(sql.includes('FROM forge_source_provenance WHERE id = ? AND owner_id = ?')){
     const row=db.provenance.get(v[0]);return row?.owner_id===v[1]?{...row}:null;
    }
    if(/FROM\s+forge_candidate_provenance_links\s+WHERE\s+owner_id\s*=\s*\?\s+AND\s+candidate_id\s*=\s*\?\s+AND\s+provenance_id\s*=\s*\?/i.test(sql)){
     return [...db.links.values()].find(x=>x.owner_id===v[0]&&x.candidate_id===v[1]&&x.provenance_id===v[2])||null;
    }
    return null;
   },
   async run(){
    if(sql.includes('INSERT INTO forge_candidate_provenance_links')){
     const [id,owner,candidate,provenance,created]=this.values;
     const key=owner+'|'+candidate+'|'+provenance;
     if(!db.links.has(key))db.links.set(key,{id,owner_id:owner,candidate_id:candidate,provenance_id:provenance,created_at:created});
     return {meta:{changes:db.links.has(key)?1:0}};
    }
    return {meta:{changes:0}};
   },
  };
 }
}
const candidate={id:'candidate-1',owner_id:'owner',source_url:'https://github.com/example/project',version:'a'.repeat(40),status:'assessed'};
const provenance={id:'provenance-1',owner_id:'owner',canonical_url:'https://github.com/example/project',revision:'a'.repeat(40),record_json:JSON.stringify({
 id:'example-project',canonicalUrl:'https://github.com/example/project',revision:'a'.repeat(40),
 inspectedAt:'2026-11-17T02:00:00.000Z',inspectionDepth:'source-level',
 licence:{identifier:'MIT',licenceFileUrl:'https://github.com/example/project/blob/main/LICENSE',review:'verified'},
 components:[],capabilities:['forge.inspect'],decision:'rebuild',status:'assessed',evidence:[{url:'https://github.com/example/project',note:'Inspected source.'}],
}),created_at:'2026-11-17T02:00:00.000Z',updated_at:'2026-11-17T02:00:00.000Z'};

test('links only same-owner candidate and provenance records pinned to the exact same source revision',async()=>{
 const db=new LinkD1();db.candidates.set(candidate.id,candidate);db.provenance.set(provenance.id,provenance);
 const link=await linkForgeCandidateProvenance(db,'owner',candidate.id,provenance.id,Date.parse('2026-11-17T03:00:00.000Z'));
 assert.equal(link.candidateId,candidate.id);assert.equal(link.provenanceId,provenance.id);
});

test('rejects cross-owner, mismatched-source and mismatched-revision provenance links',async()=>{
 const db=new LinkD1();db.candidates.set(candidate.id,candidate);db.provenance.set(provenance.id,provenance);
 await assert.rejects(()=>linkForgeCandidateProvenance(db,'other',candidate.id,provenance.id),/not found/i);
 db.provenance.set(provenance.id,{...provenance,canonical_url:'https://github.com/example/other'});
 await assert.rejects(()=>linkForgeCandidateProvenance(db,'owner',candidate.id,provenance.id),/same source and pinned revision/i);
});

test('provenance links cannot attach to rejected or archived candidates',async()=>{
 const db=new LinkD1();db.candidates.set(candidate.id,{...candidate,status:'rejected'});db.provenance.set(provenance.id,provenance);
 await assert.rejects(()=>linkForgeCandidateProvenance(db,'owner',candidate.id,provenance.id),/terminal/i);
});
