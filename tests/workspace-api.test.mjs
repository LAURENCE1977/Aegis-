import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken } from '../functions/lib/auth.mjs';
import {
  onRequestGet as listWorkspacesGet,
  onRequestPost as createWorkspacePost,
} from '../functions/api/workspaces.js';
import {
  onRequestGet as workspaceGet,
} from '../functions/api/workspaces/[id].js';
import {
  onRequestGet as workspaceEventsGet,
  onRequestPost as workspaceEventsPost,
} from '../functions/api/workspaces/[id]/events.js';
import { onRequestGet as workspaceBriefGet } from '../functions/api/workspaces/[id]/brief.js';

const secret = 'workspace-api-test-session-secret-with-enough-entropy';
const envBase = {
  AEGIS_PASSWORD: 'test-password-long-enough',
  AEGIS_SESSION_SECRET: secret,
};

class MemoryD1 {
  constructor() { this.spaces = new Map(); this.events = new Map(); this.memoryEvents = []; this.memories = []; }
  prepare(sql) {
    const db = this;
    return {
      values: [],
      bind(...values) { this.values = values; return this; },
      async run() {
        const v = this.values;
        if (sql.includes('INSERT INTO project_spaces')) {
          db.spaces.set(v[0], {
            id: v[0], owner_id: v[1], name: v[2], description: v[3],
            status: 'active', created_at: v[4], updated_at: v[5],
          });
          return { meta: { changes: 1 } };
        }
        if (sql.includes('INSERT INTO project_space_events')) {
          const row = {
            id: v[0], space_id: v[1], owner_id: v[2], event_type: v[3],
            summary: v[4], content: v[5], created_at: v[6],
          };
          db.events.set(row.id, row);
          return { meta: { changes: 1 } };
        }
        if (sql.includes('UPDATE project_spaces')) {
          const [updatedAt, id, ownerId] = v;
          const row = db.spaces.get(id);
          if (!row || row.owner_id !== ownerId) return { meta: { changes: 0 } };
          row.updated_at = updatedAt;
          return { meta: { changes: 1 } };
        }
        return { meta: { changes: 0 } };
      },
      async first() {
        const v = this.values;
        if (sql.includes('SELECT * FROM project_spaces')) {
          const row = db.spaces.get(v[0]);
          return row && row.owner_id === v[1] ? { ...row } : null;
        }
        return null;
      },
      async all() {
        const v = this.values;
        if (sql.includes('FROM aegis_memories')) {
          return { results: db.memories.filter(row => row.owner_id === v[0] && row.project_id === v[1] && row.status === 'accepted' && (!row.expires_at || row.expires_at > v[2])).sort((a,b) => b.updated_at.localeCompare(a.updated_at)).slice(0,v[3]).map(row => ({...row})) };
        }
        if (sql.includes('FROM aegis_memory_events')) {
          return { results: db.memoryEvents.filter(row => row.owner_id === v[0] && row.project_id === v[1]).slice(0, v[2]).map(row => ({ ...row })) };
        }
        if (sql.includes('FROM project_spaces')) {
          return { results: [...db.spaces.values()]
            .filter(row => row.owner_id === v[0] && row.status === 'active')
            .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
            .slice(0, v[1]).map(row => ({ ...row })) };
        }
        if (sql.includes('FROM project_space_events')) {
          return { results: [...db.events.values()]
            .filter(row => row.owner_id === v[0] && row.space_id === v[1])
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
            .slice(0, v[2]).map(row => ({ ...row })) };
        }
        return { results: [] };
      },
    };
  }
}

async function authenticatedRequest(path, { method = 'GET', body, origin = 'https://aegis.example' } = {}) {
  const token = await createSessionToken(secret);
  const headers = { Cookie: '__Host-aegis_session=' + token };
  if (origin !== null) headers.Origin = origin;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return new Request('https://aegis.example' + path, {
    method, headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

test('workspace collection rejects unauthenticated reads before accessing D1', async () => {
  const response = await listWorkspacesGet({
    request: new Request('https://aegis.example/api/workspaces'),
    env: { ...envBase, AEGIS_DB: { prepare() { throw new Error('must not access D1'); } } },
  });
  assert.equal(response.status, 401);
});

test('workspace collection fails closed when the shared D1 binding is missing', async () => {
  const response = await listWorkspacesGet({
    request: await authenticatedRequest('/api/workspaces'),
    env: envBase,
  });
  assert.equal(response.status, 503);
});

test('owner can create and list a project workspace', async () => {
  const db = new MemoryD1();
  const created = await createWorkspacePost({
    request: await authenticatedRequest('/api/workspaces', {
      method: 'POST',
      body: { name: 'AEGIS Research', description: 'Long-lived research and build context' },
    }),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(created.status, 201);
  const createdBody = await created.json();
  assert.equal(createdBody.workspace.name, 'AEGIS Research');

  const listed = await listWorkspacesGet({
    request: await authenticatedRequest('/api/workspaces'),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(listed.status, 200);
  const listBody = await listed.json();
  assert.equal(listBody.total, 1);
  assert.equal(listBody.workspaces[0].id, createdBody.workspace.id);
});

test('workspace creation rejects cross-origin requests and unknown fields', async () => {
  const db = new MemoryD1();
  const crossOrigin = await createWorkspacePost({
    request: await authenticatedRequest('/api/workspaces', {
      method: 'POST', origin: 'https://attacker.example', body: { name: 'Blocked' },
    }),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(crossOrigin.status, 403);

  const unknownField = await createWorkspacePost({
    request: await authenticatedRequest('/api/workspaces', {
      method: 'POST', body: { name: 'Blocked', runCommand: 'rm -rf /' },
    }),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(unknownField.status, 400);
  assert.equal(db.spaces.size, 0);
});

test("workspace detail and timeline return only the owner's project data", async () => {
  const db = new MemoryD1();
  const created = await createWorkspacePost({
    request: await authenticatedRequest('/api/workspaces', {
      method: 'POST', body: { name: 'Private Project' },
    }),
    env: { ...envBase, AEGIS_DB: db },
  });
  const { workspace } = await created.json();
  const eventResponse = await workspaceEventsPost({
    request: await authenticatedRequest('/api/workspaces/' + workspace.id + '/events', {
      method: 'POST',
      body: { type: 'decision', summary: 'Use one canonical D1 store', content: 'Keep project state and approval records in the AEGIS database.' },
    }),
    env: { ...envBase, AEGIS_DB: db },
    params: { id: workspace.id },
  });
  assert.equal(eventResponse.status, 201);

  const detail = await workspaceGet({
    request: await authenticatedRequest('/api/workspaces/' + workspace.id),
    env: { ...envBase, AEGIS_DB: db },
    params: { id: workspace.id },
  });
  assert.equal(detail.status, 200);
  const detailBody = await detail.json();
  assert.equal(detailBody.events.length, 1);
  assert.equal(detailBody.events[0].type, 'decision');

  const timeline = await workspaceEventsGet({
    request: await authenticatedRequest('/api/workspaces/' + workspace.id + '/events'),
    env: { ...envBase, AEGIS_DB: db },
    params: { id: workspace.id },
  });
  assert.equal(timeline.status, 200);
  assert.equal((await timeline.json()).total, 1);

  const otherId = 'other-owner-space';
  db.spaces.set(otherId, {
    id: otherId, owner_id: 'another-owner', name: 'Not yours',
    description: '', status: 'active',
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  });
  const privateLookup = await workspaceGet({
    request: await authenticatedRequest('/api/workspaces/' + otherId),
    env: { ...envBase, AEGIS_DB: db },
    params: { id: otherId },
  });
  assert.equal(privateLookup.status, 404);
});



test('Project Space handover brief rejects unauthenticated access before touching storage',async()=>{
  const response=await workspaceBriefGet({
    request:new Request('https://aegis.example/api/workspaces/project-a/brief'),
    env:{...envBase,AEGIS_DB:{prepare(){throw new Error('must not access D1');}}},
    params:{id:'project-a'},
  });
  assert.equal(response.status,401);
});

test('owner can create a bounded Project Space handover brief from its own accepted memories and events', async()=>{
  const db=new MemoryD1();
  const created=await createWorkspacePost({
    request:await authenticatedRequest('/api/workspaces',{method:'POST',body:{name:'AEGIS Core',description:'Build a safe personal AI operating system.'}}),
    env:{...envBase,AEGIS_DB:db},
  });
  const {workspace}=await created.json();
  await workspaceEventsPost({
    request:await authenticatedRequest('/api/workspaces/'+workspace.id+'/events',{
      method:'POST',
      body:{type:'decision',summary:'Keep one canonical database.',content:'Private raw event content should not be copied into the brief.'},
    }),
    env:{...envBase,AEGIS_DB:db},params:{id:workspace.id},
  });
  const memoryRow=(overrides={})=>({
    id:'memory-brief-1',owner_id:'owner',project_id:workspace.id,kind:'decision',
    content:'D1 is the canonical persistent project store.',
    source_type:'user-stated',source_url:'https://private.example/source',
    source_attribution:'Owner decision',source_observed_at:'2026-11-15T11:00:00.000Z',
    confidence:0.9,sensitivity:'private',status:'accepted',tags_json:'["architecture"]',
    created_at:'2026-11-15T11:00:00.000Z',updated_at:'2026-11-15T11:00:00.000Z',expires_at:null,
    ...overrides,
  });
  db.memories.push(memoryRow());
  db.memories.push(memoryRow({id:'restricted-memory',sensitivity:'restricted',content:'restricted secret'}));
  db.memories.push(memoryRow({id:'candidate-memory',status:'candidate',content:'unreviewed content'}));
  db.memories.push(memoryRow({id:'other-project-memory',project_id:'other-project',content:'other project content'}));

  const response=await workspaceBriefGet({
    request:await authenticatedRequest('/api/workspaces/'+workspace.id+'/brief'),
    env:{...envBase,AEGIS_DB:db},params:{id:workspace.id},
  });
  assert.equal(response.status,200);
  const {brief}=await response.json();
  assert.equal(brief.goal,'Build a safe personal AI operating system.');
  assert.equal(brief.recentEvents[0].summary,'Keep one canonical database.');
  assert.deepEqual(brief.memories.map(item=>item.id),['memory-brief-1']);
  const serialized=JSON.stringify(brief);
  assert.doesNotMatch(serialized,/Private raw event content|private\.example|restricted secret|unreviewed content|other project content/);
});

test('Project Space handover brief validates the requested budget and refuses inactive or foreign projects', async()=>{
  const db=new MemoryD1();
  const created=await createWorkspacePost({
    request:await authenticatedRequest('/api/workspaces',{method:'POST',body:{name:'Brief test'}}),
    env:{...envBase,AEGIS_DB:db},
  });
  const {workspace}=await created.json();
  const invalid=await workspaceBriefGet({
    request:await authenticatedRequest('/api/workspaces/'+workspace.id+'/brief?maxChars=999'),
    env:{...envBase,AEGIS_DB:db},params:{id:workspace.id},
  });
  assert.equal(invalid.status,400);
  const foreign=await workspaceBriefGet({
    request:await authenticatedRequest('/api/workspaces/not-yours/brief'),
    env:{...envBase,AEGIS_DB:db},params:{id:'not-yours'},
  });
  assert.equal(foreign.status,404);
});

test('Project Space timeline merges only its own memory lifecycle events', async () => {
  const db = new MemoryD1();
  const created = await createWorkspacePost({
    request: await authenticatedRequest('/api/workspaces', {
      method: 'POST', body: { name: 'Memory Timeline' },
    }),
    env: { ...envBase, AEGIS_DB: db },
  });
  const { workspace } = await created.json();
  db.memoryEvents.push({
    id: 'memory-event-1', memory_id: 'memory-1', owner_id: 'owner',
    project_id: workspace.id, event_type: 'status_changed',
    from_status: 'candidate', to_status: 'accepted',
    occurred_at: '2026-11-15T18:00:00.000Z',
  });
  db.memoryEvents.push({
    id: 'other-project-event', memory_id: 'memory-2', owner_id: 'owner',
    project_id: 'another-project', event_type: 'created',
    from_status: null, to_status: 'candidate',
    occurred_at: '2026-11-15T18:01:00.000Z',
  });
  const timeline = await workspaceEventsGet({
    request: await authenticatedRequest('/api/workspaces/' + workspace.id + '/events'),
    env: { ...envBase, AEGIS_DB: db },
    params: { id: workspace.id },
  });
  assert.equal(timeline.status, 200);
  const data = await timeline.json();
  assert.equal(data.total, 1);
  assert.equal(data.events[0].source, 'memory');
  assert.equal(data.events[0].type, 'memory_status_changed');
  assert.equal(data.events[0].memoryId, 'memory-1');
});

test('workspace event writes reject missing origin and invalid event types', async () => {
  const db = new MemoryD1();
  const created = await createWorkspacePost({
    request: await authenticatedRequest('/api/workspaces', {
      method: 'POST', body: { name: 'Event Guard' },
    }),
    env: { ...envBase, AEGIS_DB: db },
  });
  const { workspace } = await created.json();

  const noOrigin = await workspaceEventsPost({
    request: await authenticatedRequest('/api/workspaces/' + workspace.id + '/events', {
      method: 'POST', origin: null,
      body: { type: 'note', summary: 'Blocked', content: 'No origin header' },
    }),
    env: { ...envBase, AEGIS_DB: db },
    params: { id: workspace.id },
  });
  assert.equal(noOrigin.status, 403);

  const invalidType = await workspaceEventsPost({
    request: await authenticatedRequest('/api/workspaces/' + workspace.id + '/events', {
      method: 'POST',
      body: { type: 'execute', summary: 'Not allowed', content: 'No code execution.' },
    }),
    env: { ...envBase, AEGIS_DB: db },
    params: { id: workspace.id },
  });
  assert.equal(invalidType.status, 400);
});
