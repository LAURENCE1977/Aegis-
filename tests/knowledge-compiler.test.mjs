import test from 'node:test';
import assert from 'node:assert/strict';
import { compileKnowledgeDocument } from '../functions/lib/knowledge-compiler.mjs';

test('compiles a source document into chunks carrying immutable source identity and exact offsets', async () => {
  const document = {
    sourceId: 'evidence-123',
    sourcePath: 'docs/security.md',
    content: '# Security\n\nSentinel is the sole permission authority.\n\n## Grants\n\nEvery grant is scoped.',
    status: 'accepted',
  };
  const compiled = await compileKnowledgeDocument(document, { maxChars: 80 });

  assert.equal(compiled.sourceId, document.sourceId);
  assert.equal(compiled.sourcePath, document.sourcePath);
  assert.equal(compiled.chunks.length, 2);
  for (const chunk of compiled.chunks) {
    assert.equal(chunk.sourceId, document.sourceId);
    assert.equal(chunk.sourcePath, document.sourcePath);
    assert.equal(chunk.status, 'accepted');
    assert.equal(document.content.slice(chunk.startOffset, chunk.endOffset), chunk.text);
  }
  assert.deepEqual(compiled.chunks.map(chunk => chunk.headingPath), [
    ['Security'],
    ['Security', 'Grants'],
  ]);
});

test('draft source material stays draft and cannot become accepted through compilation options', async () => {
  const compiled = await compileKnowledgeDocument({
    sourceId: 'evidence-draft',
    content: 'Unreviewed content.',
    status: 'draft',
  });
  assert.equal(compiled.chunks[0].status, 'draft');
  await assert.rejects(() => compileKnowledgeDocument({
    sourceId: 'evidence-draft',
    content: 'Unreviewed content.',
    status: 'accepted',
  }, { status: 'accepted' }), /options/);
});

test('rejects missing identity, unsafe paths, unknown fields and oversized documents', async () => {
  await assert.rejects(() => compileKnowledgeDocument({ content: 'text', status: 'draft' }), /source ID/);
  await assert.rejects(() => compileKnowledgeDocument({
    sourceId: 'evidence-1', sourcePath: '../private.md', content: 'text', status: 'draft',
  }), /source path/);
  await assert.rejects(() => compileKnowledgeDocument({
    sourceId: 'evidence-1', content: 'text', status: 'draft', ownerId: 'someone-else',
  }), /document fields/);
  await assert.rejects(() => compileKnowledgeDocument({
    sourceId: 'evidence-1', content: 'text', status: 'draft',
  }, { unknown: true }), /options/);
});
