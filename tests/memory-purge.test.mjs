import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRepository } from '../functions/lib/memory-substrate.mjs';

class PurgeD1 {
  constructor(changes=1){this.changes=changes;this.statements=[];}
  prepare(sql){
    const db=this;
    return {values:[],bind(...values){this.values=values;return this;},sql};
  }
  async batch(statements){
    this.statements=statements.map(statement=>({sql:statement.sql,values:statement.values}));
    return [{meta:{changes:1}},{meta:{changes:this.changes}}];
  }
}

test('memory purge atomically unlinks dependent corrections then deletes only the exact owner/project record',async()=>{
  const db=new PurgeD1();
  const repository=createMemoryRepository(db);
  const purged=await repository.purge('memory-1',{ownerId:'owner',projectId:'project-1'});
  assert.equal(purged,true);
  assert.equal(db.statements.length,2);
  assert.match(db.statements[0].sql,/UPDATE aegis_memories/);
  assert.match(db.statements[0].sql,/SET supersedes_id = NULL/);
  assert.deepEqual(db.statements[0].values,['memory-1','owner','project-1']);
  assert.match(db.statements[1].sql,/DELETE FROM aegis_memories/);
  assert.deepEqual(db.statements[1].values,['memory-1','owner','project-1']);
});

test('memory purge reports missing owner-scoped records without claiming success',async()=>{
  const db=new PurgeD1(0);
  const repository=createMemoryRepository(db);
  assert.equal(await repository.purge('memory-1',{ownerId:'owner',projectId:null}),false);
  assert.deepEqual(db.statements[1].values,['memory-1','owner',null]);
});

test('memory purge requires transactional D1 batch support',async()=>{
  const db={prepare(){return {bind(){return this;}}}};
  const repository=createMemoryRepository(db);
  await assert.rejects(()=>repository.purge('memory-1',{ownerId:'owner',projectId:null}),/batch/i);
});
