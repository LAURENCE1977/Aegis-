import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createForgeProvenanceRecord,
  listForgeProvenanceRecords,
  ForgeProvenanceConflictError,
} from '../functions/lib/forge-provenance.mjs';

class ProvenanceD1 {
  constructor(){ this.rows=new Map(); this.events=[]; }
  prepare(sql){
    const db=this;
    return {
      values:[],
      bind(...values){this.values=values;return this;},
      async run(){
        const v=this.values;
        if(sql.includes('INSERT INTO forge_source_provenance')){
          const key=v[1]+'|'+v[2]+'|'+v[3];
          if([...db.rows.values()].some(row=>row.uniqueKey===key)) return {meta:{changes:0}};
          const row={id:v[0],owner_id:v[1],canonical_url:v[2],revision:v[3],record_json:v[4],created_at:v[5],updated_at:v[6],uniqueKey:key};
          db.rows.set(row.id,row);
          db.events.push({record_id:row.id,owner_id:row.owner_id,event_type:'created'});
          return {meta:{changes:1}};
        }
        return {meta:{changes:0}};
      },
      async first(){
        const v=this.values;
        if(sql.includes('FROM forge_source_provenance')&&sql.includes('canonical_url = ?')){
          const row=[...db.rows.values()].find(x=>x.owner_id===v[0]&&x.canonical_url===v[1]&&x.revision===v[2]);
          return row?{...row}:null;
        }
        return null;
      },
      async all(){
        const [owner,limit]=this.values;
        return {results:[...db.rows.values()].filter(x=>x.owner_id===owner)
          .sort((a,b)=>b.updated_at.localeCompare(a.updated_at)).slice(0,limit).map(x=>({...x}))};
      },
    };
  }
}

const validRecord=()=>({
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
  evidence:[{url:'https://github.com/MasterKale/SimpleWebAuthn/tree/main/packages/server',note:'Server ceremony implementation inspected.'}],
});

test('persists validated provenance records with owner scope and immutable source revision',async()=>{
 const db=new ProvenanceD1();
 const first=await createForgeProvenanceRecord(db,'owner',validRecord(),Date.parse('2026-11-17T03:00:00.000Z'));
 assert.equal(first.created,true);
 assert.equal(first.record.revision,'a'.repeat(40));
 assert.equal(first.record.ownerId,'owner');
 assert.equal(first.record.decision,'adapt');
 assert.equal(db.events.length,1);
});

test('provenance creation is idempotent for the same owner, repository and pinned revision',async()=>{
 const db=new ProvenanceD1();
 const a=await createForgeProvenanceRecord(db,'owner',validRecord(),Date.parse('2026-11-17T03:00:00.000Z'));
 const b=await createForgeProvenanceRecord(db,'owner',validRecord(),Date.parse('2026-11-17T03:01:00.000Z'));
 assert.equal(a.created,true);
 assert.equal(b.created,false);
 assert.equal(a.record.id,b.record.id);
 assert.equal(db.events.length,1);
});

test('provenance records are listed only for their owner and bounded to 100',async()=>{
 const db=new ProvenanceD1();
 await createForgeProvenanceRecord(db,'owner',validRecord());
 await createForgeProvenanceRecord(db,'other',{...validRecord(),canonicalUrl:'https://github.com/example/other'});
 assert.equal((await listForgeProvenanceRecords(db,'owner')).length,1);
 assert.equal((await listForgeProvenanceRecords(db,'owner',1)).length,1);
 await assert.rejects(()=>listForgeProvenanceRecords(db,'owner',101),/between 1 and 100/);
});

test('unresolved component licences cannot be persisted as reuse or adaptation records',async()=>{
 const db=new ProvenanceD1();
 const record=validRecord();
 record.components=[{kind:'model',name:'weights',identifier:'custom-terms',licenceFileUrl:'https://example.org/model/LICENSE',review:'review-required'}];
 await assert.rejects(()=>createForgeProvenanceRecord(db,'owner',record),/verified source and component licences/i);
});

test('provenance database migration protects source identity and append-only event history',async()=>{
 const {readFile}=await import('node:fs/promises');
 const sql=await readFile(new URL('../migrations/forge/0004_source_provenance.sql',import.meta.url),'utf8');
 assert.match(sql,/CREATE TABLE IF NOT EXISTS forge_source_provenance/);
 assert.match(sql,/UNIQUE\s*\(owner_id, canonical_url, revision\)/i);
 assert.match(sql,/trg_forge_source_provenance_identity_immutable/);
 assert.match(sql,/trg_forge_source_provenance_events_no_update/);
 assert.match(sql,/trg_forge_source_provenance_events_no_delete/);
});
