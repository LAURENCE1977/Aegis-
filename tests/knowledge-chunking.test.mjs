import test from 'node:test';
import assert from 'node:assert/strict';
import { chunkMarkdownDocument } from '../functions/lib/knowledge-chunking.mjs';

test('chunks markdown by section while retaining exact source offsets and heading hierarchy', () => {
  const source = '# Guide\n\nIntro paragraph.\n\n## Setup\n\nInstall the package.\n';
  const chunks = chunkMarkdownDocument(source, { maxChars: 80 });

  assert.deepEqual(chunks.map(chunk => chunk.headingPath), [
    ['Guide'],
    ['Guide', 'Setup'],
  ]);
  for (const chunk of chunks) {
    assert.equal(source.slice(chunk.startOffset, chunk.endOffset), chunk.text);
    assert.ok(chunk.startLine >= 1);
    assert.ok(chunk.endLine >= chunk.startLine);
  }
  assert.deepEqual(chunks.map(chunk => chunk.text), [
    'Intro paragraph.',
    'Install the package.',
  ]);
});

test('splits oversized paragraphs without losing, duplicating or reordering source text', () => {
  const source = 'alpha beta gamma delta epsilon zeta';
  const chunks = chunkMarkdownDocument(source, { maxChars: 12 });
  assert.ok(chunks.every(chunk => chunk.text.length <= 12));
  assert.equal(chunks.map(chunk => chunk.text).join(' '), source);
  for (const chunk of chunks) {
    assert.equal(source.slice(chunk.startOffset, chunk.endOffset), chunk.text);
  }
});

test('keeps fenced code blocks intact when they fit and does not interpret headings inside them', () => {
  const source = '# Guide\n\n\`\`\`js\n# not a heading\nconst value = 1;\n\`\`\`\n';
  const chunks = chunkMarkdownDocument(source, { maxChars: 100 });
  assert.equal(chunks.length, 1);
  assert.deepEqual(chunks[0].headingPath, ['Guide']);
  assert.match(chunks[0].text, /# not a heading/);
});

test('rejects invalid chunk limits instead of silently changing them', () => {
  assert.throws(() => chunkMarkdownDocument('hello', { maxChars: 10 }), /chunk size/);
  assert.throws(() => chunkMarkdownDocument('hello', { maxChars: 100, overlapChars: 50 }), /overlap/);
  assert.throws(() => chunkMarkdownDocument('hello', { unknown: true }), /options/);
});
