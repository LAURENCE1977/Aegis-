import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProjectBrief } from '../functions/lib/project-brief.mjs';

const workspace={
  id:'project-a',name:'AEGIS Core',description:'Build a safe personal AI operating system.',
  status:'active',createdAt:'2026-11-15T10:00:00.000Z',updatedAt:'2026-11-15T12:00:00.000Z',
};
const memory=(overrides={})=>({
  id:'memory-a',ownerId:'owner',projectId:'project-a',kind:'fact',
  content:'The shared D1 database is the canonical project store.',
  confidence:0.9,sensitivity:'private',status:'accepted',
  source:{type:'user-stated',url:'https://private.example/source',attribution:'Owner decision',observedAt:'2026-11-15T11:00:00.000Z'},
  createdAt:'2026-11-15T11:00:00.000Z',updatedAt:'2026-11-15T11:00:00.000Z',
  expiresAt:null,tags:['architecture'],...overrides,
});
const event=(overrides={})=>({
  id:'event-a',workspaceId:'project-a',ownerId:'owner',type:'decision',
  summary:'Keep one canonical shared database.',
  content:'This raw event body may contain private details and is not copied into a handover brief.',
  createdAt:'2026-11-15T11:30:00.000Z',...overrides,
});

test('project brief includes project goal, recent event summaries and accepted project memories',()=>{
  const brief=buildProjectBrief({
    workspace,events:[event()],memories:[memory()],now:Date.parse('2026-11-15T12:00:00.000Z'),
  });
  assert.equal(brief.workspace.id,'project-a');
  assert.equal(brief.goal,workspace.description);
  assert.equal(brief.recentEvents[0].summary,'Keep one canonical shared database.');
  assert.equal(brief.memories[0].id,'memory-a');
  assert.match(brief.trustBoundary,/untrusted reference data/i);
});

test('project brief excludes restricted, candidate and cross-project memories and never exports raw event content or source URLs',()=>{
  const brief=buildProjectBrief({
    workspace,
    events:[event()],
    memories:[
      memory(),
      memory({id:'restricted',sensitivity:'restricted',content:'restricted secret'}),
      memory({id:'candidate',status:'candidate',content:'unreviewed content'}),
      memory({id:'other-project',projectId:'project-b',content:'other project content'}),
    ],
    now:Date.parse('2026-11-15T12:00:00.000Z'),
  });
  const serialized=JSON.stringify(brief);
  assert.deepEqual(brief.memories.map(item=>item.id),['memory-a']);
  assert.doesNotMatch(serialized,/restricted secret|unreviewed content|other project content/);
  assert.doesNotMatch(serialized,/private\.example\/source|raw event body/);
});

test('project brief prioritizes decisions and stays inside a hard character budget',()=>{
  const brief=buildProjectBrief({
    workspace,
    events:Array.from({length:10},(_,i)=>event({id:'event-'+i,summary:'Event '+i+' '+('detail '.repeat(30))})),
    memories:[
      memory({id:'fact',kind:'fact',content:'Fact '.repeat(100)}),
      memory({id:'decision',kind:'decision',content:'Decision '.repeat(100),confidence:0.7}),
      memory({id:'procedure',kind:'procedure',content:'Procedure '.repeat(100)}),
    ],
    maxChars:1400,
    now:Date.parse('2026-11-15T12:00:00.000Z'),
  });
  assert.ok(brief.budget.usedChars<=1400);
  assert.ok(brief.budget.estimatedTokens>0);
  assert.equal(brief.memories[0].id,'decision');
  assert.ok(brief.budget.truncated);
  assert.ok(brief.budget.omittedMemories>0 || brief.budget.omittedEvents>0);
});
