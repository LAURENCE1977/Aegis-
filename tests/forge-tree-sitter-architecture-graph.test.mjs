import test from 'node:test';
import assert from 'node:assert/strict';
import { buildArchitectureGraph } from '../scripts/forge-tree-sitter-architecture-graph.mjs';

test('serializes files, declarations and relationships with deterministic source evidence', async () => {
  const files = [
    { path: 'src/a.js', content: 'export function start() { finish(); }\nfunction finish() {}' },
    { path: 'src/b.js', content: "import { start } from './a.js'; start();" },
    { path: 'src/unused.js', content: 'export const unused = 1;' },
  ];
  const result = await buildArchitectureGraph(files);

  assert.equal(result.schemaVersion, '1.0.0');
  assert.deepEqual(result.nodes.map(node => node.id), [
    'file:src/a.js',
    'file:src/b.js',
    'file:src/unused.js',
    'symbol:src/a.js#finish@2:10',
    'symbol:src/a.js#start@1:17',
    'symbol:src/unused.js#unused@1:14',
  ]);
  assert.ok(result.edges.some(edge =>
    edge.type === 'imports-module' &&
    edge.source === 'file:src/b.js' &&
    edge.target === 'file:src/a.js' &&
    edge.evidence.path === 'src/b.js'));
  assert.ok(result.edges.some(edge =>
    edge.type === 'calls' &&
    edge.source === 'symbol:src/a.js#start@1:17' &&
    edge.target === 'symbol:src/a.js#finish@2:10' &&
    edge.evidence.location.start.line === 1));
  assert.deepEqual(result.disconnectedComponents, [
    ['src/a.js', 'src/b.js'],
    ['src/unused.js'],
  ]);
  assert.deepEqual(result, await buildArchitectureGraph([...files].reverse()));
});

test('retains unresolved imports and does not invent graph edges', async () => {
  const result = await buildArchitectureGraph([
    { path: 'src/a.js', content: "import { missing } from './b.js';" },
    { path: 'src/b.js', content: 'export const present = 1;' },
  ]);

  assert.equal(result.edges.some(edge => edge.type === 'imports-symbol'), false);
  assert.deepEqual(result.unresolved.symbolImports.map(item => item.reason), ['missing-export']);
  assert.deepEqual(result.disconnectedComponents, [['src/a.js', 'src/b.js']]);
});
