import test from 'node:test';
import assert from 'node:assert/strict';
import { rankKnowledgeChunks } from '../functions/lib/knowledge-retrieval.mjs';

const chunk = (id, text, overrides = {}) => ({
  id, text, sourceId: 'evidence-1', startOffset: 0, endOffset: text.length,
  headingPath: [], status: 'accepted', ...overrides,
});

test('ranks accepted evidence chunks by BM25 relevance and preserves source citations', () => {
  const results = rankKnowledgeChunks('sentinel approval', [
    chunk('unrelated', 'The weather is sunny today.'),
    chunk('sentinel', 'Sentinel is the sole permission authority.'),
    chunk('approval', 'Approval must be explicit and scoped.'),
    chunk('both', 'Sentinel approval requires exact resource scope.', {
      sourceId: 'evidence-2', sourcePath: 'docs/security.md', startOffset: 120, endOffset: 171,
      headingPath: ['Security', 'Sentinel'],
    }),
    chunk('draft', 'Sentinel approval draft only.', { status: 'draft' }),
  ]);

  assert.equal(results[0].id, 'both');
  assert.ok(results.every(result => result.id !== 'draft'));
  assert.equal(results[0].sourceId, 'evidence-2');
  assert.equal(results[0].sourcePath, 'docs/security.md');
  assert.deepEqual(results[0].headingPath, ['Security', 'Sentinel']);
  assert.deepEqual(results[0].matchedTerms, ['approval', 'sentinel']);
  assert.ok(results[0].score > 0);
});

test('uses deterministic ID ordering for equal-scoring accepted chunks', () => {
  const results = rankKnowledgeChunks('alpha', [
    chunk('z', 'alpha beta'),
    chunk('a', 'alpha beta'),
  ]);
  assert.deepEqual(results.map(result => result.id), ['a', 'z']);
});

test('returns no evidence for empty queries and rejects malformed candidate records', () => {
  assert.deepEqual(rankKnowledgeChunks('   ', [chunk('a', 'alpha')]), []);
  assert.throws(() => rankKnowledgeChunks('alpha', [{ id: 'broken' }]), /chunk record/);
});

test('bounds result count and rejects unknown search options', () => {
  assert.equal(rankKnowledgeChunks('alpha', [
    chunk('a', 'alpha'), chunk('b', 'alpha'), chunk('c', 'alpha'),
  ], { limit: 2 }).length, 2);
  assert.throws(() => rankKnowledgeChunks('alpha', [chunk('a', 'alpha')], { limit: 0 }), /limit/);
  assert.throws(() => rankKnowledgeChunks('alpha', [chunk('a', 'alpha')], { includeDrafts: true }), /options/);
});
