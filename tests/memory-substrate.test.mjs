import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateMemoryRecord,
  createMemoryStore,
  createMemoryRepository,
} from '../functions/lib/memory-substrate.mjs';

const now = Date.parse('2026-11-15T12:00:00.000Z');
const record = (overrides = {}) => ({
  id: 'preferred-writing-style',
  ownerId: 'owner-1',
  principalId: 'principal-1',
  tenantId: 'tenant-1',
  projectId: null,
  kind: 'preference',
  content: 'Prefer concise, human-sounding writing with clear storytelling.',
  source: {
    type: 'user-stated',
    url: 'https://aegis.local/conversation/42',
    attribution: 'Explicit user preference',
    observedAt: '2026-11-15T11:00:00.000Z',
  },
  confidence: 1,
  sensitivity: 'private',
  status: 'accepted',
  tags: ['writing', 'style'],
  createdAt: '2026-11-15T11:00:00.000Z',
  updatedAt: '2026-11-15T11:00:00.000Z',
  expiresAt: null,
  supersedesId: null,
  ...overrides,
});

test('accepts a typed, attributed memory record with bounded metadata', () => {
  assert.equal(validateMemoryRecord(record(), now), true);
});

test('rejects records without provenance or with unsafe source URLs', () => {
  assert.throws(() => validateMemoryRecord(record({ source: null }), now));
  assert.throws(() => validateMemoryRecord(record({
    source: { ...record().source, url: 'javascript:alert(1)' },
  }), now));
});

test('rejects malformed confidence, status, sensitivity and timestamps', () => {
  for (const overrides of [
    { confidence: 1.1 },
    { confidence: -0.1 },
    { status: 'trusted' },
    { sensitivity: 'top-secret' },
    { updatedAt: 'not-a-date' },
    { updatedAt: '2026-11-14T10:00:00.000Z' },
    { expiresAt: '2026-11-15T10:30:00.000Z' },
  ]) {
    assert.throws(() => validateMemoryRecord(record(overrides), now));
  }
});

test('rejects oversized, blank, control-character and duplicate-tag content', () => {
  assert.throws(() => validateMemoryRecord(record({ content: '   ' }), now));
  assert.throws(() => validateMemoryRecord(record({ content: 'bad\u0000memory' }), now));
  assert.throws(() => validateMemoryRecord(record({ content: 'x'.repeat(4001) }), now));
  assert.throws(() => validateMemoryRecord(record({ tags: ['same', 'same'] }), now));
});

test('search is isolated to the requested owner and personal/project scope', () => {
  const store = createMemoryStore([
    record(),
    record({ id: 'other-owner', ownerId: 'owner-2', principalId: 'principal-2', tenantId: 'tenant-2' }),
    record({ id: 'same-principal-other-tenant', ownerId: 'owner-1', principalId: 'principal-1', tenantId: 'tenant-2' }),
    record({ id: 'project-memory', projectId: 'project-a' }),
    record({ id: 'other-project', projectId: 'project-b' }),
  ]);
  assert.deepEqual(store.search({ ownerId: 'owner-1', principalId: 'principal-1', tenantId: 'tenant-1', query: 'storytelling' }).map((item) => item.id), [
    'preferred-writing-style',
  ]);
  assert.deepEqual(store.search({
    ownerId: 'owner-1', principalId: 'principal-1', tenantId: 'tenant-1', projectId: 'project-a', query: 'storytelling',
  }).map((item) => item.id), ['project-memory']);
});


test('memory retrieval ranks exact token matches and rejects misleading substring hits', () => {
  const store = createMemoryStore([
    record({id:'full-match',content:'Concise storytelling creates a clear structure.',tags:['writing']}),
    record({id:'partial-match',content:'Storytelling keeps the narrative human.',tags:['narrative']}),
    record({id:'substring-only',content:'Partial artifice in the artist profile.',tags:['artwork']}),
  ]);
  const results = store.search({ownerId:'owner-1',principalId:'principal-1',tenantId:'tenant-1',query:'art concise storytelling',now});
  assert.deepEqual(results.map(item=>item.id),['full-match','partial-match']);
});

test('search excludes candidate, retracted, superseded and expired memories by default', () => {
  const store = createMemoryStore([
    record(),
    record({ id: 'candidate-memory', status: 'candidate' }),
    record({ id: 'retracted-memory', status: 'retracted' }),
    record({ id: 'superseded-memory', status: 'superseded' }),
    record({ id: 'expired-memory', expiresAt: '2026-11-15T11:59:00.000Z' }),
  ]);
  assert.deepEqual(store.search({
    ownerId: 'owner-1', principalId: 'principal-1', tenantId: 'tenant-1', query: 'storytelling', now,
  }).map((item) => item.id), ['preferred-writing-style']);
});

test('store returns defensive copies and bounds result counts', () => {
  const store = createMemoryStore([record()]);
  const first = store.get('preferred-writing-style', { ownerId: 'owner-1', principalId: 'principal-1', tenantId: 'tenant-1' });
  first.tags.push('mutated');
  assert.deepEqual(store.get('preferred-writing-style', { ownerId: 'owner-1', principalId: 'principal-1', tenantId: 'tenant-1' }).tags, ['writing', 'style']);
  assert.throws(() => store.search({
    ownerId: 'owner-1', principalId: 'principal-1', tenantId: 'tenant-1', query: 'writing', limit: 1000,
  }));
});

test('empty or invalid queries return no results without widening scope', () => {
  const store = createMemoryStore([record()]);
  assert.deepEqual(store.search({ ownerId: 'owner-1', principalId: 'principal-1', tenantId: 'tenant-1', query: '' }), []);
  assert.deepEqual(store.search({ ownerId: '', query: 'writing' }), []);
  assert.deepEqual(store.search({ ownerId: 'owner-1', principalId: 'principal-1', tenantId: 'tenant-1', query: 'writing', projectId: '*' }), []);
});

class MemoryRepositoryD1 {
  constructor() { this.rows = new Map(); this.events = []; }
  prepare(sql) {
    const db = this;
    return {
      values: [],
      bind(...values) { this.values = values; return this; },
      async run() {
        const v = this.values;
        if (sql.includes('INSERT INTO aegis_memories')) {
          if (db.rows.has(v[0])) throw new Error('duplicate');
          db.rows.set(v[0], {
            id:v[0], owner_id:v[1], principal_id:v[2], tenant_id:v[3], project_id:v[4], kind:v[5], content:v[6],
            source_type:v[7], source_url:v[8], source_attribution:v[9],
            source_observed_at:v[10], confidence:v[11], sensitivity:v[12],
            status:v[13], tags_json:v[14], created_at:v[15], updated_at:v[16],
            expires_at:v[17],
          });
          db.events.push({id:'event-'+db.events.length,memory_id:v[0],owner_id:v[1],principal_id:v[2],tenant_id:v[3],project_id:v[4],event_type:'created',from_status:null,to_status:v[13],occurred_at:v[15]});
          return { meta:{changes:1} };
        }
        if (sql.includes('UPDATE aegis_memories')) {
          const row=db.rows.get(v[2]);
          if (!row || row.tenant_id!==v[3] || row.principal_id!==v[4] || row.project_id!==v[5]) return {meta:{changes:0}};
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
          const row=db.rows.get(v[0]);
          if (!row || row.tenant_id!==v[1] || row.principal_id!==v[2] || row.project_id!==v[3]) return null;
          return {...row};
        }
        return null;
      },
      async all() {
        const v=this.values;
        if (sql.includes('FROM aegis_memory_events') && sql.includes('WHERE memory_id = ?')) {
          return {results:db.events.filter(event=>event.memory_id===v[0] && event.tenant_id===v[1] && event.principal_id===v[2] && event.project_id===v[3]).slice(0,v[4]).map(event=>({...event}))};
        }
        if (sql.includes('FROM aegis_memory_events') && sql.includes('WHERE tenant_id = ? AND principal_id = ? AND project_id = ?')) {
          return {results:db.events.filter(event=>event.tenant_id===v[0] && event.principal_id===v[1] && event.project_id===v[2]).slice(0,v[3]).map(event=>({...event}))};
        }
        let rows=[...db.rows.values()];
        if (sql.includes('FROM aegis_memories')) {
          rows=rows.filter(row=>row.tenant_id===v[0] && row.principal_id===v[1] && row.project_id===v[2] &&
            (row.status==='accepted' || (sql.includes("'accepted', 'candidate'") && row.status==='candidate')) && (!sql.includes("sensitivity <> 'restricted'") || row.sensitivity!=='restricted') && (!row.expires_at || row.expires_at>v[3]));
          if (sql.includes('LIKE')) {
            const terms=v.slice(4,-1);
            rows=rows.filter(row=>terms.some(term=>
              (row.content+' '+row.kind+' '+row.tags_json).toLowerCase().includes(term.replaceAll('%','').toLowerCase())));
            rows.sort((a,b)=>b.confidence-a.confidence || b.updated_at.localeCompare(a.updated_at));
            return {results:rows.slice(0,v[v.length-1]).map(row=>({...row}))};
          }
          rows.sort((a,b)=>b.updated_at.localeCompare(a.updated_at));
          return {results:rows.slice(0,v[4]).map(row=>({...row}))};
        }
        return {results:[]};
      },
    };
  }
}

test('D1 repository persists a memory and reads it back only in its exact owner scope', async () => {
  const { createMemoryRepository } = await import('../functions/lib/memory-substrate.mjs');
  const db = new MemoryRepositoryD1();
  const repository = createMemoryRepository(db);
  const saved = await repository.create(record());
  assert.equal(saved.source.trust, 'untrusted');
  assert.deepEqual(await repository.get(saved.id, { ownerId: 'owner-1', principalId: 'principal-1', tenantId: 'tenant-1' }), saved);
  assert.equal(await repository.get(saved.id, { ownerId:'owner-2',principalId:'principal-2',tenantId:'tenant-2' }), null);
});

test('D1 repository lists only accepted, unexpired records in exact project scope', async () => {
  const { createMemoryRepository } = await import('../functions/lib/memory-substrate.mjs');
  const db = new MemoryRepositoryD1();
  const repository = createMemoryRepository(db);
  await repository.create(record());
  await repository.create(record({id:'candidate-record',status:'candidate'}));
  await repository.create(record({id:'project-record',projectId:'project-a'}));
  const personal = await repository.list({ownerId: 'owner-1', principalId: 'principal-1', tenantId: 'tenant-1',now,limit:20});
  const project = await repository.list({ownerId: 'owner-1', principalId: 'principal-1', tenantId: 'tenant-1',projectId:'project-a',now,limit:20});
  assert.deepEqual(personal.map(item=>item.id),['preferred-writing-style']);
  assert.deepEqual(project.map(item=>item.id),['project-record']);
});

test('D1 repository searches all terms without crossing owner or project boundaries', async () => {
  const { createMemoryRepository } = await import('../functions/lib/memory-substrate.mjs');
  const db = new MemoryRepositoryD1();
  const repository = createMemoryRepository(db);
  await repository.create(record());
  await repository.create(record({id:'other-owner-record',ownerId:'owner-2',principalId:'principal-2',tenantId:'tenant-2'}));
  const results = await repository.search({ownerId: 'owner-1', principalId: 'principal-1', tenantId: 'tenant-1',query:'concise storytelling',now});
  assert.deepEqual(results.map(item=>item.id),['preferred-writing-style']);
  assert.deepEqual(await repository.search({ownerId: 'owner-1', principalId: 'principal-1', tenantId: 'tenant-1',projectId:'project-a',query:'concise storytelling',now}),[]);
});


test('D1 memory retrieval ranks relevant terms after bounded candidate selection', async () => {
  const { createMemoryRepository } = await import('../functions/lib/memory-substrate.mjs');
  const db = new MemoryRepositoryD1();
  const repository = createMemoryRepository(db);
  await repository.create(record({id:'full-match',content:'Concise storytelling creates a clear structure.',tags:['writing']}));
  await repository.create(record({id:'partial-match',content:'Storytelling keeps the narrative human.',tags:['narrative']}));
  await repository.create(record({id:'substring-only',content:'Partial artifice in the artist profile.',tags:['artwork']}));
  const results = await repository.search({ownerId: 'owner-1', principalId: 'principal-1', tenantId: 'tenant-1',query:'art concise storytelling',now});
  assert.deepEqual(results.map(item=>item.id),['full-match','partial-match']);
});

test('D1 repository only permits candidate memories to be reviewed into accepted or retracted states', async () => {
  const { createMemoryRepository } = await import('../functions/lib/memory-substrate.mjs');
  const db = new MemoryRepositoryD1();
  const repository = createMemoryRepository(db);
  const candidate = await repository.create(record({status:'candidate'}));
  assert.equal(await repository.setStatus(candidate.id,{ownerId: 'owner-1', principalId: 'principal-1', tenantId: 'tenant-1',status:'accepted',now}),true);
  assert.equal((await repository.get(candidate.id,{ownerId: 'owner-1', principalId: 'principal-1', tenantId: 'tenant-1'})).status,'accepted');
  assert.equal(await repository.setStatus(candidate.id,{ownerId: 'owner-2', principalId: 'principal-2', tenantId: 'tenant-2',status:'retracted',now}),false);
  await assert.rejects(()=>repository.setStatus(candidate.id,{ownerId: 'owner-1', principalId: 'principal-1', tenantId: 'tenant-1',status:'trusted',now}),/status/i);
});


test('D1 repository exposes append-only creation and lifecycle history in exact scope', async () => {
  const db = new MemoryRepositoryD1();
  const repository = createMemoryRepository(db);
  const candidate = await repository.create(record({status:'candidate'}));
  await repository.setStatus(candidate.id,{ownerId: 'owner-1', principalId: 'principal-1', tenantId: 'tenant-1',status:'accepted',now});
  await repository.setStatus(candidate.id,{ownerId: 'owner-1', principalId: 'principal-1', tenantId: 'tenant-1',status:'retracted',now:now+1000});
  const events = await repository.listEvents(candidate.id,{ownerId: 'owner-1', principalId: 'principal-1', tenantId: 'tenant-1'});
  assert.deepEqual(events.map(event=>[event.type,event.fromStatus,event.toStatus]),[
    ['created',null,'candidate'],
    ['status_changed','candidate','accepted'],
    ['status_changed','accepted','retracted'],
  ]);
  assert.deepEqual(await repository.listEvents(candidate.id,{ownerId: 'owner-2', principalId: 'principal-2', tenantId: 'tenant-2'}),[]);
});


test('D1 review listing can include candidates without changing normal retrieval', async () => {
  const db = new MemoryRepositoryD1();
  const repository = createMemoryRepository(db);
  await repository.create(record({status:'candidate'}));
  assert.deepEqual((await repository.list({ownerId: 'owner-1', principalId: 'principal-1', tenantId: 'tenant-1',now})),[]);
  assert.deepEqual((await repository.list({ownerId: 'owner-1', principalId: 'principal-1', tenantId: 'tenant-1',now,includeCandidates:true})).map(item=>item.status),['candidate']);
});


test('D1 retrieval accepts partial-term matches but never returns restricted memories', async () => {
  const db = new MemoryRepositoryD1();
  const repository = createMemoryRepository(db);
  await repository.create(record());
  await repository.create(record({id:'restricted-memory',sensitivity:'restricted',content:'private storytelling memory'}));
  const results = await repository.search({ownerId: 'owner-1', principalId: 'principal-1', tenantId: 'tenant-1',query:'storytelling unrelated',now});
  assert.deepEqual(results.map(item=>item.id),['preferred-writing-style']);
});


test('D1 repository exposes project-scoped memory lifecycle events for the Project Space timeline',async()=>{
  const db=new MemoryRepositoryD1();
  const repository=createMemoryRepository(db);
  await repository.create(record({id:'project-memory',projectId:'project-a',status:'candidate'}));
  await repository.setStatus('project-memory',{ownerId: 'owner-1', principalId: 'principal-1', tenantId: 'tenant-1',projectId:'project-a',status:'accepted',now:now+1000});
  const events=await repository.listProjectEvents({ownerId: 'owner-1', principalId: 'principal-1', tenantId: 'tenant-1',projectId:'project-a',limit:20});
  assert.deepEqual(events.map(event=>event.type),['created','status_changed']);
  assert.ok(events.every(event=>event.projectId==='project-a'));
  assert.deepEqual(await repository.listProjectEvents({ownerId: 'owner-2', principalId: 'principal-2', tenantId: 'tenant-2',projectId:'project-a'}),[]);
});
