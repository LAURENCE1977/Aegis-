import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgentRunProjectContextBuilder } from '../functions/lib/agent-run-context.mjs';

const workspace = {
  id: 'project-a',
  ownerId: 'owner',
  name: 'AEGIS Core',
  description: 'Build a safe personal AI operating system.',
  status: 'active',
  createdAt: '2026-11-15T10:00:00.000Z',
  updatedAt: '2026-11-15T12:00:00.000Z',
};
const event = {
  id: 'event-a',
  workspaceId: 'project-a',
  ownerId: 'owner',
  type: 'decision',
  summary: 'Keep memory scoped to the selected project.',
  content: 'Raw event content must not enter the brief.',
  createdAt: '2026-11-15T11:30:00.000Z',
};
const memory = {
  id: 'memory-a',
  ownerId: 'owner',
  projectId: 'project-a',
  kind: 'decision',
  content: 'Only accepted project memories may be used as context.',
  confidence: 0.95,
  sensitivity: 'private',
  status: 'accepted',
  source: {
    type: 'user-stated',
    url: 'https://aegis.local/source',
    attribution: 'Owner decision',
    observedAt: '2026-11-15T11:00:00.000Z',
  },
  createdAt: '2026-11-15T11:00:00.000Z',
  updatedAt: '2026-11-15T11:00:00.000Z',
  expiresAt: null,
  tags: ['memory'],
};

function makeBuilder(overrides = {}) {
  return createAgentRunProjectContextBuilder({
    getWorkspace: async (_db, ownerId, projectId) =>
      ownerId === 'owner' && projectId === workspace.id ? workspace : null,
    listWorkspaceEvents: async () => [event],
    createMemoryRepository: () => ({ list: async () => [memory] }),
    ...overrides,
  });
}

test('builds a bounded owner-scoped Project Space context with stable content digest', async () => {
  const builder = makeBuilder();
  const db = { prepare() {} };
  const first = await builder(db, 'project-a', Date.parse('2026-11-16T12:00:00.000Z'));
  const second = await builder(db, 'project-a', Date.parse('2026-11-16T12:05:00.000Z'));

  assert.equal(first.brief.workspace.id, 'project-a');
  assert.equal(first.brief.memories[0].id, 'memory-a');
  assert.equal(first.brief.recentEvents[0].summary, event.summary);
  assert.equal(first.brief.trustBoundary.includes('untrusted reference data'), true);
  assert.equal(first.digest, second.digest);
  assert.notEqual(first.brief.generatedAt, second.brief.generatedAt);
  assert.doesNotMatch(JSON.stringify(first), /Raw event content|aegis\.local\/source/);
});

test('does not build context for missing or inactive Project Spaces', async () => {
  let reads = 0;
  const builder = makeBuilder({
    getWorkspace: async () => ({ ...workspace, status: 'archived' }),
    listWorkspaceEvents: async () => { reads += 1; return [event]; },
    createMemoryRepository: () => ({ list: async () => { reads += 1; return [memory]; } }),
  });
  assert.equal(await builder({ prepare() {} }, 'project-a'), null);
  assert.equal(reads, 0);
});

test('rejects malformed Project Space identifiers before database access', async () => {
  const builder = makeBuilder();
  await assert.rejects(() => builder({ prepare() {} }, '../private'));
});
