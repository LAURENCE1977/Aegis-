import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken } from '../functions/lib/auth.mjs';
import { onRequest as proposalReviewsApi } from '../functions/api/experiment-records/proposals/reviews.js';
import { evaluateAgentExperiment } from '../workers/runtime/agent-evaluation.mjs';
import { createAgentExperimentRecord } from '../workers/runtime/agent-experiment-record.mjs';
import { appendExperimentProposalReview, listExperimentProposalReviews } from '../workers/runtime/experiment-proposal-review-store.mjs';
import { handleRuntimeFetch } from '../workers/runtime/index.mjs';

const token = 'proposal-review-runtime-token-with-at-least-32-characters';
const secret = 'proposal-review-pages-session-secret';
const session = await createSessionToken(secret);
const workloadDigest = 'sha256:' + 'a'.repeat(64);
const proposalId = 'proposal:review-benchmark:aaaaaaaaaaaa:candidate-a:record-old:record-new';

class ReviewD1 {
  constructor(records = []) {
    this.events = new Map();
    this.rows = records.map((record) => ({
      principal_id: 'owner', record_id: record.id, record_digest: record.recordDigest,
      record_json: JSON.stringify(record), created_at: record.createdAt,
    })).sort((a, b) => b.created_at.localeCompare(a.created_at) || b.record_id.localeCompare(a.record_id));
  }
  prepare(sql) {
    const db = this;
    let values = [];
    return { bind(...args) {
      values = args;
      return {
        async run() {
          if (!sql.startsWith('INSERT INTO experiment_proposal_review_events')) throw new Error('Unexpected SQL run: '+sql);
          const [eventId, principalId, proposal, decision, note, first, last, digest, createdAt] = values;
          const key = principalId+':'+eventId;
          if (db.events.has(key)) return { meta: { changes: 0 } };
          db.events.set(key, { event_id:eventId, principal_id:principalId, proposal_id:proposal, decision, note, first_record_id:first, last_record_id:last, workload_digest:digest, created_at:createdAt });
          return { meta: { changes: 1 } };
        },
        async first() {
          if (sql.includes('FROM experiment_proposal_review_events')) {
            const [principalId, eventId] = values;
            return db.events.get(principalId+':'+eventId) || null;
          }
          return null;
        },
        async all() {
          if (sql.includes('FROM experiment_records')) {
            const principalId = values[0];
            const limit = values[values.length-1];
            return { results: db.rows.filter((row)=>row.principal_id===principalId).slice(0,limit) };
          }
          if (sql.includes('FROM experiment_proposal_review_events')) {
            const [principalId, proposal, limit] = values;
            return { results: [...db.events.values()].filter((e)=>e.principal_id===principalId && (proposal===null || e.proposal_id===proposal)).sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,limit) };
          }
          throw new Error('Unexpected SQL all: '+sql);
        },
      };
    }};
  }
}

async function makeRecord(id, createdAt, cost) {
  const contextId = 'context-'+id;
  const context = {
    schemaVersion:'aegis.measurement-context.v1', id:contextId,
    benchmarkId:'review-benchmark', benchmarkVersion:'1.0',
    workloadDigest, workloadEvidenceRef:'benchmark:'+id,
    runtime:'node', runtimeVersion:'22', region:'local',
    concurrency:1, warmupRuns:1, measuredRuns:5, timeoutMs:30000,
  };
  const evaluation = evaluateAgentExperiment({
    priority:'lowest_cost',
    criteria:[{id:'correctness',description:'Produces a correct result'}],
    candidates:['candidate-a','candidate-b'].map((candidateId,index)=>({
      id:candidateId,currency:'GBP',
      costMinorUnits:String(candidateId==='candidate-a'?cost:250+index),
      elapsedMs:candidateId==='candidate-a'?cost*10:1500,
      safetyChecksPassed:true,safetyEvidenceRef:'safety:'+id+':'+candidateId,
      measurementContextId:contextId,
      criterionResults:[{criterionId:'correctness',outcome:'pass',evidenceRef:'criterion:'+id+':'+candidateId}],
    })),
  });
  for(const candidate of evaluation.candidates){candidate.costEvidenceRef='cost:'+id+':'+candidate.id;candidate.elapsedEvidenceRef='runtime:'+id+':'+candidate.id;}
  const evidence=[
    {ref:context.workloadEvidenceRef,kind:'benchmark',sha256:workloadDigest},
    ...evaluation.candidates.flatMap((candidate)=>[
      {ref:candidate.safetyEvidenceRef,kind:'safety'},
      {ref:candidate.costEvidenceRef,kind:'cost'},
      {ref:candidate.elapsedEvidenceRef,kind:'runtime'},
      ...candidate.criterionResults.map((item)=>({ref:item.evidenceRef,kind:'criterion'})),
    ]),
  ].map((item)=>({...item,sha256:item.sha256||'sha256:'+'b'.repeat(64),capturedAt:createdAt}));
  return createAgentExperimentRecord({
    id,ownerId:'owner',benchmarkId:context.benchmarkId,createdAt,
    measurementContext:context,evaluation,evidence,
  });
}

function runtimeRequest(path, method='GET', body) {
  return new Request('https://runtime.example'+path, {
    method,
    headers:{
      Authorization:'Bearer '+token,
      'X-Aegis-Principal':'owner',
      ...(body===undefined?{}:{'Content-Type':'application/json'}),
    },
    ...(body===undefined?{}:{body:JSON.stringify(body)}),
  });
}

function ownerRequest(method='GET', body) {
  return new Request('https://aegis.example/api/experiment-records/proposals/reviews', {
    method,
    headers:{
      Cookie:'__Host-aegis_session='+session,
      ...(body===undefined?{}:{'Content-Type':'application/json',Origin:'https://aegis.example'}),
    },
    ...(body===undefined?{}:{body:JSON.stringify(body)}),
  });
}

test('runtime records a human review only against a currently derived proposal', async()=>{
  const records=[
    await makeRecord('record-old','2026-11-20T10:00:00.000Z',200),
    await makeRecord('record-new','2026-11-20T11:00:00.000Z',150),
  ];
  const DB=new ReviewD1(records);
  const response=await handleRuntimeFetch(runtimeRequest('/v1/experiment-records/proposals/reviews','POST',{
    eventId:'review-event-0001',proposalId,
    decision:'accepted_for_further_review',note:'Inspect source evidence before any next step.',
  }),{AEGIS_JOB_TOKEN:token,DB});
  assert.equal(response.status,201);
  const body=await response.json();
  assert.equal(body.review.decision,'accepted_for_further_review');
  assert.equal(body.review.approvalGranted,false);
  assert.equal(body.review.execution,'not_authorised');
  assert.equal(body.review.evidence.firstRecordId,'record-old');
});

test('runtime rejects stale proposal IDs and invalid review decisions',async()=>{
  const records=[
    await makeRecord('record-old','2026-11-20T10:00:00.000Z',200),
    await makeRecord('record-new','2026-11-20T11:00:00.000Z',150),
  ];
  const DB=new ReviewD1(records);
  const stale=await handleRuntimeFetch(runtimeRequest('/v1/experiment-records/proposals/reviews','POST',{
    eventId:'review-event-0002',proposalId:'stale-proposal',
    decision:'rejected',note:'Stale review.',
  }),{AEGIS_JOB_TOKEN:token,DB});
  assert.equal(stale.status,409);
  const invalid=await handleRuntimeFetch(runtimeRequest('/v1/experiment-records/proposals/reviews','POST',{
    eventId:'review-event-0003',proposalId,
    decision:'approved',note:'This must never grant approval.',
  }),{AEGIS_JOB_TOKEN:token,DB});
  assert.equal(invalid.status,400);
  assert.equal(DB.events.size,0);
});

test('Pages review endpoint requires owner authentication and same-origin writes',async()=>{
  const originalFetch=globalThis.fetch;
  let calls=0;
  globalThis.fetch=async()=>{calls++;return new Response('{}');};
  try{
    const denied=await proposalReviewsApi({request:new Request('https://aegis.example/api/experiment-records/proposals/reviews',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}),env:{AEGIS_PASSWORD:'test-password',AEGIS_SESSION_SECRET:secret,AEGIS_RUNTIME_URL:'https://runtime.example/',AEGIS_JOB_TOKEN:token}});
    assert.equal(denied.status,401);
    const crossOrigin=await proposalReviewsApi({request:new Request('https://aegis.example/api/experiment-records/proposals/reviews',{method:'POST',headers:{Cookie:'__Host-aegis_session='+session,'Content-Type':'application/json',Origin:'https://evil.example'},body:'{}'}),env:{AEGIS_PASSWORD:'test-password',AEGIS_SESSION_SECRET:secret,AEGIS_RUNTIME_URL:'https://runtime.example/',AEGIS_JOB_TOKEN:token}});
    assert.equal(crossOrigin.status,403);
    assert.equal(calls,0);
  }finally{globalThis.fetch=originalFetch;}
});

test('review store is principal-scoped and rejects attempts to label a review as approval',async()=>{
  const DB=new ReviewD1();
  const event={
    eventId:'review-event-0004',proposalId,decision:'needs_more_evidence',
    note:'Need independent source artifact verification.',
    firstRecordId:'record-old',lastRecordId:'record-new',
    workloadDigest,createdAt:'2026-11-21T09:00:00.000Z',
  };
  const saved=await appendExperimentProposalReview(DB,'owner',event);
  assert.equal(saved.created,true);
  assert.equal(saved.review.approvalGranted,false);
  assert.equal((await listExperimentProposalReviews(DB,'other-owner')).length,0);
  await assert.rejects(()=>appendExperimentProposalReview(DB,'owner',{...event,ownerId:'attacker'}),/owner/i);
});
