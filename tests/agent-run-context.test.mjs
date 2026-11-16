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
  let memoryOptions;
  const builder = makeBuilder({
    createMemoryRepository: () => ({
      list: async (options) => { memoryOptions = options; return [memory]; },
    }),
  });
  const db = { prepare() {} };
  const firstNow = Date.parse('2026-11-16T12:00:00.000Z');
  const secondNow = Date.parse('2026-11-16T12:05:00.000Z');
  const first = await builder(db, 'project-a', firstNow);
  assert.equal(memoryOptions.now, firstNow);
  const second = await builder(db, 'project-a', secondNow);

  assert.equal(first.brief.workspace.id, 'project-a');
  assert.equal(first.brief.memories[0].id, 'memory-a');
  assert.equal(first.brief.recentEvents[0].summary, event.summary);
  assert.equal(first.brief.trustBoundary.includes('untrusted reference data'), true);
  assert.equal(first.digest, second.digest);
  assert.notEqual(first.brief.generatedAt, second.brief.generatedAt);
  assert.doesNotMatch(JSON.stringify(first), /Raw event content|aegis\.local\/source/);
});

test('keeps multilingual Project Space snapshots inside the UTF-8 byte budget', async () => {
  const events = Array.from({ length: 100 }, (_, index) => ({
    ...event,
    id: 'event-' + index,
    summary: '😀'.repeat(240),
    createdAt: new Date(Date.parse(event.createdAt) + index * 1000).toISOString(),
  }));
  const memories = Array.from({ length: 50 }, (_, index) => ({
    ...memory,
    id: 'memory-' + index,
    content: '😀'.repeat(1200),
  }));
  const builder = makeBuilder({
    listWorkspaceEvents: async () => events,
    createMemoryRepository: () => ({ list: async () => memories }),
  });
  const context = await builder({ prepare() {} }, 'project-a');
  const bytes = new TextEncoder().encode(JSON.stringify(context)).byteLength;
  assert.ok(bytes <= 11 * 1024 + 128);
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

test('does not attach a Project Space returned for a different owner or identifier', async () => {
  const wrongOwner = makeBuilder({
    getWorkspace: async () => ({ ...workspace, ownerId: 'another-owner' }),
  });
  const wrongProject = makeBuilder({
    getWorkspace: async () => ({ ...workspace, id: 'project-b' }),
  });
  const db = { prepare() {} };
  assert.equal(await wrongOwner(db, 'project-a'), null);
  assert.equal(await wrongProject(db, 'project-a'), null);
});

test('rejects malformed Project Space identifiers before database access', async () => {
  const builder = makeBuilder();
  await assert.rejects(() => builder({ prepare() {} }, '../private'));
});


test('attaches only owner-accepted Forge knowledge as bounded untrusted project context', async () => {
  const accepted = {
    id: 'knowledge-runtime-pattern',
    ownerId: 'owner',
    title: 'Durable runtime pattern',
    domain: 'runtime',
    knowledgeType: 'pattern',
    summary: 'Persist intent and immutable provenance before dispatching background work.',
    evidenceLevel: 'high',
    status: 'accepted',
    sources: [{
      url: 'https://example.org/runtime-pattern',
      title: 'Runtime design notes',
      attribution: 'AEGIS research',
    }],
    limitations: ['Applies to durable background tasks, not synchronous UI requests.'],
    applicableCapabilities: ['agent.run'],
    version: 3,
    updatedAt: '2026-11-16T12:00:00.000Z',
  };
  const builder = makeBuilder({
    listForgeKnowledgeRecords: async (_db, ownerId, options) => {
      assert.equal(ownerId, 'owner');
      assert.deepEqual(options, { status: 'accepted', limit: 20 });
      return [
        accepted,
        { ...accepted, id: 'knowledge-draft', status: 'draft' },
        { ...accepted, id: 'knowledge-other-owner', ownerId: 'another-owner' },
      ];
    },
  });

  const context = await builder({ prepare() {} }, 'project-a');

  assert.deepEqual(context.knowledge.map((item) => item.id), ['knowledge-runtime-pattern']);
  assert.equal(context.knowledge[0].trust, 'untrusted-reference');
  assert.equal(context.knowledge[0].evidenceLevel, 'high');
  assert.equal(context.knowledge[0].sources[0].url, accepted.sources[0].url);
  assert.match(context.knowledgeDigest, /^sha256:[a-f0-9]{64}$/);
  assert.ok(new TextEncoder().encode(JSON.stringify(context)).byteLength <= 12 * 1024);
});
