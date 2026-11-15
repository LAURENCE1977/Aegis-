import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateMemoryRecord,
  createMemoryStore,
} from '../functions/lib/memory-substrate.mjs';

const now = Date.parse('2026-11-15T12:00:00.000Z');
const record = (overrides = {}) => ({
  id: 'preferred-writing-style',
  ownerId: 'owner-1',
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
    record({ id: 'other-owner', ownerId: 'owner-2' }),
    record({ id: 'project-memory', projectId: 'project-a' }),
    record({ id: 'other-project', projectId: 'project-b' }),
  ]);
  assert.deepEqual(store.search({ ownerId: 'owner-1', query: 'storytelling' }).map((item) => item.id), [
    'preferred-writing-style',
  ]);
  assert.deepEqual(store.search({
    ownerId: 'owner-1', projectId: 'project-a', query: 'storytelling',
  }).map((item) => item.id), ['project-memory']);
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
    ownerId: 'owner-1', query: 'storytelling', now,
  }).map((item) => item.id), ['preferred-writing-style']);
});

test('store returns defensive copies and bounds result counts', () => {
  const store = createMemoryStore([record()]);
  const first = store.get('preferred-writing-style', { ownerId: 'owner-1' });
  first.tags.push('mutated');
  assert.deepEqual(store.get('preferred-writing-style', { ownerId: 'owner-1' }).tags, ['writing', 'style']);
  assert.throws(() => store.search({
    ownerId: 'owner-1', query: 'writing', limit: 1000,
  }));
});

test('empty or invalid queries return no results without widening scope', () => {
  const store = createMemoryStore([record()]);
  assert.deepEqual(store.search({ ownerId: 'owner-1', query: '' }), []);
  assert.deepEqual(store.search({ ownerId: '', query: 'writing' }), []);
  assert.deepEqual(store.search({ ownerId: 'owner-1', query: 'writing', projectId: '*' }), []);
});
