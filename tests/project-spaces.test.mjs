import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorkspace,
  listWorkspaces,
  getWorkspace,
  appendWorkspaceEvent,
  listWorkspaceEvents,
} from '../functions/lib/project-spaces.mjs';

const root = { principalId: 'usr_root', tenantId: 'org_root' };
const other = { principalId: 'usr_other', tenantId: 'org_other' };

class MemoryD1 {
  constructor() {
    this.spaces = new Map();
    this.events = new Map();
  }
  prepare(sql) {
    const db = this;
    return {
      values: [],
      bind(...values) { this.values = values; return this; },
      async run() {
        const v = this.values;
        if (sql.includes('INSERT INTO project_spaces')) {
          db.spaces.set(v[0], {
            id: v[0], owner_id: v[1], principal_id: v[2], tenant_id: v[3], name: v[4], description: v[5],
            status: 'active', created_at: v[6], updated_at: v[7],
          });
          return { meta: { changes: 1 } };
        }
        if (sql.includes('INSERT INTO project_space_events')) {
          const row = {
            id: v[0], space_id: v[1], owner_id: v[2], principal_id: v[3], tenant_id: v[4], event_type: v[5],
            summary: v[6], content: v[7], created_at: v[8],
          };
          db.events.set(row.id, row);
          return { meta: { changes: 1 } };
        }
        if (sql.includes('UPDATE project_spaces')) {
          const [updatedAt, id, tenantId, principalId] = v;
          const row = db.spaces.get(id);
          if (!row || row.tenant_id !== tenantId || row.principal_id !== principalId) return { meta: { changes: 0 } };
          row.updated_at = updatedAt;
          return { meta: { changes: 1 } };
        }
        return { meta: { changes: 0 } };
      },
      async first() {
        const v = this.values;
        if (sql.includes('SELECT * FROM project_spaces')) {
          const row = db.spaces.get(v[0]);
          if (!row || row.tenant_id !== v[1] || row.principal_id !== v[2]) return null;
          return { ...row };
        }
        return null;
      },
      async all() {
        const v = this.values;
        if (sql.includes('FROM project_spaces')) {
          return {
            results: [...db.spaces.values()]
              .filter(row => row.tenant_id === v[0] && row.principal_id === v[1] && row.status === 'active')
              .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
              .slice(0, v[3]).map(row => ({ ...row })),
          };
        }
        if (sql.includes('FROM project_space_events')) {
          return {
            results: [...db.events.values()]
              .filter(row => row.tenant_id === v[0] && row.principal_id === v[1] && row.space_id === v[2])
              .sort((a, b) => b.created_at.localeCompare(a.created_at))
              .slice(0, v[2]).map(row => ({ ...row })),
          };
        }
        return { results: [] };
      },
    };
  }
}

test('creates a named project space with an active status', async () => {
  const db = new MemoryD1();
  const space = await createWorkspace(db, root, {
    name: '  AEGIS Forge  ',
    description: 'Research and build workspace',
  }, Date.parse('2026-11-15T12:00:00.000Z'));
  assert.equal(space.name, 'AEGIS Forge');
  assert.equal(space.description, 'Research and build workspace');
  assert.equal(space.status, 'active');
  assert.equal(db.spaces.get(space.id).owner_id, 'usr_root');
});

test('rejects invalid workspace names and oversized descriptions', async () => {
  const db = new MemoryD1();
  await assert.rejects(() => createWorkspace(db, root, { name: '   ' }), /name/i);
  await assert.rejects(() => createWorkspace(db, root, {
    name: 'Project', description: 'x'.repeat(501),
  }), /description/i);
});

test("lists only the owner's active workspaces with a bounded limit", async () => {
  const db = new MemoryD1();
  await createWorkspace(db, root, { name: 'Mine' });
  await createWorkspace(db, other, { name: 'Not mine' });
  const spaces = await listWorkspaces(db, root, 10);
  assert.equal(spaces.length, 1);
  assert.equal(spaces[0].name, 'Mine');
  await assert.rejects(() => listWorkspaces(db, root, 101), /limit/i);
});

test('workspace lookup is owner-scoped', async () => {
  const db = new MemoryD1();
  const space = await createWorkspace(db, root, { name: 'Private' });
  assert.equal((await getWorkspace(db, root, space.id)).id, space.id);
  assert.equal(await getWorkspace(db, other, space.id), null);
});

test('appends typed notes and decisions only to an owned workspace', async () => {
  const db = new MemoryD1();
  const space = await createWorkspace(db, root, { name: 'Project' });
  const event = await appendWorkspaceEvent(db, {
    principal: root,
    workspaceId: space.id,
    type: 'decision',
    summary: 'Use a provider-neutral adapter',
    content: 'Keep Cloudflare as the initial runtime and hide providers behind interfaces.',
  }, Date.parse('2026-11-15T12:05:00.000Z'));
  assert.equal(event.type, 'decision');
  assert.equal(event.summary, 'Use a provider-neutral adapter');
  assert.equal(db.spaces.get(space.id).updated_at, '2026-11-15T12:05:00.000Z');
  assert.equal(await appendWorkspaceEvent(db, {
    principal: other,
    workspaceId: space.id,
    type: 'note',
    summary: 'No access',
    content: 'Should not be stored',
  }), null);
});

test('rejects unsupported event types and oversized event content', async () => {
  const db = new MemoryD1();
  const space = await createWorkspace(db, root, { name: 'Project' });
  await assert.rejects(() => appendWorkspaceEvent(db, {
    principal: root, workspaceId: space.id, type: 'shell',
    summary: 'Run a command', content: 'No arbitrary execution',
  }), /type/i);
  await assert.rejects(() => appendWorkspaceEvent(db, {
    principal: root, workspaceId: space.id, type: 'note',
    summary: 'Too much', content: 'x'.repeat(12_001),
  }), /content/i);
});

test('lists the most recent workspace events only for the owner', async () => {
  const db = new MemoryD1();
  const space = await createWorkspace(db, root, { name: 'Timeline' });
  await appendWorkspaceEvent(db, {
    principal: root, workspaceId: space.id, type: 'note',
    summary: 'First', content: 'First event',
  }, Date.parse('2026-11-15T12:00:00.000Z'));
  await appendWorkspaceEvent(db, {
    principal: root, workspaceId: space.id, type: 'research',
    summary: 'Second', content: 'Second event',
  }, Date.parse('2026-11-15T12:01:00.000Z'));
  const events = await listWorkspaceEvents(db, root, space.id, 10);
  assert.equal(events.length, 2);
  assert.equal(events[0].summary, 'Second');
  assert.equal(await listWorkspaceEvents(db, other, space.id, 10), null);
});
