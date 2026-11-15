import test from 'node:test';
import assert from 'node:assert/strict';
import { createForgeCandidate, updateForgeCandidateReview } from '../functions/lib/forge-candidates.mjs';

class ReviewD1 {
  constructor(){this.rows=new Map();this.events=[];}
  prepare(sql){
    const db=this;
    return {
      values:[],
      bind(...values){this.values=values;return this;},
      async run(){
        const v=this.values;
        if(sql.includes('INSERT INTO forge_candidates')){
          const row={
            id:v[0],owner_id:v[1],source_type:v[2],source_url:v[3],version:v[4],
            licence_identifier:v[5],licence_review:v[6],decision:v[7],status:v[8],
            capabilities_json:v[9],dependencies_json:v[10],evidence_json:v[11],
            metadata_json:v[12],created_at:v[13],updated_at:v[14],
          };
          db.rows.set(row.id,row);db.events.push({type:'created',id:row.id});return {meta:{changes:1}};
        }
        if(sql.includes('UPDATE forge_candidates')){
          const row=db.rows.get(v[5]);
          if(!row||row.owner_id!==v[6]||row.updated_at!==v[7]||['archived','rejected'].includes(row.status))return {meta:{changes:0}};
          const old={...row};
          row.licence_review=v[0];row.decision=v[1];row.status=v[2];row.metadata_json=v[3];row.updated_at=v[4];
          if(old.licence_review!==row.licence_review||old.decision!==row.decision)db.events.push({type:'review_changed',id:row.id,from:old.licence_review,to:row.licence_review,decision:row.decision});
          if(old.status!==row.status)db.events.push({type:'status_changed',id:row.id,from:old.status,to:row.status});
          return {meta:{changes:1}};
        }
        return {meta:{changes:0}};
      },
      async first(){
        const v=this.values;
        if(sql.includes('FROM forge_candidates')&&sql.includes('source_url = ?')){
          return [...db.rows.values()].find(row=>row.owner_id===v[0]&&row.source_url===v[1]&&row.version===v[2])||null;
        }
        if(sql.includes('FROM forge_candidates')&&sql.includes('WHERE id = ?')){
          const row=db.rows.get(v[0]);return row&&row.owner_id===v[1]?{...row}:null;
        }
        if(sql.includes('UPDATE forge_candidates')&&sql.includes('RETURNING')){
          const row=db.rows.get(v[4]);return row?{...row}:null;
        }
        return null;
      },
    };
  }
}

const source={
  sourceType:'repository',sourceUrl:'https://github.com/example/repo',fullName:'example/repo',
  description:null,defaultBranch:'main',treeSha:'a'.repeat(40),archived:false,fork:false,
  stars:1,primaryLanguage:'TypeScript',licenseSpdx:'MIT',licenseName:'MIT License',
};

test('Forge reuse and adaptation decisions require explicit verified licence review',async()=>{
  const db=new ReviewD1();const created=await createForgeCandidate(db,'owner',source);
  await assert.rejects(()=>updateForgeCandidateReview(db,'owner',created.candidate.id,{
    licenceReview:'review-required',decision:'reuse',status:'assessed',
    licenceEvidenceUrl:null,reviewNote:'Licence has not yet been reviewed.',licenceAttested:false,
    expectedUpdatedAt:created.candidate.updatedAt,
  }),/licence/i);
  await assert.rejects(()=>updateForgeCandidateReview(db,'owner',created.candidate.id,{
    licenceReview:'review-required',decision:'unassessed',status:'approved',
    licenceEvidenceUrl:null,reviewNote:'Licence has not yet been reviewed.',licenceAttested:false,
    expectedUpdatedAt:created.candidate.updatedAt,
  }),/approved/i);
});

test('owner can record verified licence review and approve an assessed native-use decision',async()=>{
  const db=new ReviewD1();const created=await createForgeCandidate(db,'owner',source);
  const updated=await updateForgeCandidateReview(db,'owner',created.candidate.id,{
    licenceReview:'verified',decision:'adapt',status:'approved',
    licenceEvidenceUrl:'https://github.com/example/repo/blob/main/LICENSE',
    reviewNote:'Reviewed upstream licence and dependency obligations.',
    licenceAttested:true,expectedUpdatedAt:created.candidate.updatedAt,
  });
  assert.equal(updated.licence.review,'verified');
  assert.equal(updated.decision,'adapt');
  assert.equal(updated.status,'approved');
  assert.ok(db.events.some(event=>event.type==='review_changed'));
  assert.ok(db.events.some(event=>event.type==='status_changed'));
});

test('Forge candidate review is owner-scoped and terminal candidates cannot be reopened',async()=>{
  const db=new ReviewD1();const created=await createForgeCandidate(db,'owner',source);
  assert.equal(await updateForgeCandidateReview(db,'other-owner',created.candidate.id,{
    licenceReview:'verified',decision:'reuse',status:'approved',
    licenceEvidenceUrl:'https://github.com/example/repo/blob/main/LICENSE',
    reviewNote:'Reviewed upstream licence and dependency obligations.',
    licenceAttested:true,expectedUpdatedAt:created.candidate.updatedAt,
  }),null);
  await updateForgeCandidateReview(db,'owner',created.candidate.id,{
    licenceReview:'verified',decision:'reject',status:'rejected',
    licenceEvidenceUrl:'https://github.com/example/repo/blob/main/LICENSE',
    reviewNote:'Rejected after licence and security review.',
    licenceAttested:true,expectedUpdatedAt:created.candidate.updatedAt,
  });
  assert.equal(await updateForgeCandidateReview(db,'owner',created.candidate.id,{
    licenceReview:'verified',decision:'reuse',status:'approved',
    licenceEvidenceUrl:'https://github.com/example/repo/blob/main/LICENSE',
    reviewNote:'Reviewed upstream licence and dependency obligations.',
    licenceAttested:true,expectedUpdatedAt:created.candidate.updatedAt,
  }),null);
});
