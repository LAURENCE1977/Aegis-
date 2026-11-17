import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveReExportGraph } from '../scripts/forge-tree-sitter-reexport-graph.mjs';

test('follows multi-hop named barrel exports to the original declaration with full lineage', async () => {
  const result = await resolveReExportGraph([
    { path: 'src/origin.js', content: 'export function run() {}' },
    { path: 'src/inner.js', content: "export { run as renamed } from './origin.js';" },
    { path: 'src/outer.js', content: "export { renamed as publicRun } from './inner.js';" },
    { path: 'src/consumer.js', content: "import { publicRun } from './outer.js'; publicRun();" },
  ]);

  assert.deepEqual(result.reExportLineage.map(({ source, target, imported, exported, chain }) =>
    ({ source, target, imported, exported, chain: chain.map(edge => [edge.source, edge.target, edge.imported, edge.exported]) })), [
    {
      source: 'src/inner.js',
      target: 'src/origin.js',
      imported: 'run',
      exported: 'renamed',
      chain: [['src/inner.js', 'src/origin.js', 'run', 'renamed']],
    },
    {
      source: 'src/outer.js',
      target: 'src/origin.js',
      imported: 'run',
      exported: 'publicRun',
      chain: [
        ['src/outer.js', 'src/inner.js', 'renamed', 'publicRun'],
        ['src/inner.js', 'src/origin.js', 'run', 'renamed'],
      ],
    },
  ]);
  assert.deepEqual(result.unresolvedReExportLineage, []);
  assert.equal(result.symbolEdges.some(edge => edge.source === 'src/consumer.js' && edge.target === 'src/origin.js'), false);
});

test('reports cyclic barrel forwarding without inventing an origin declaration', async () => {
  const result = await resolveReExportGraph([
    { path: 'src/a.js', content: "export { value } from './b.js';" },
    { path: 'src/b.js', content: "export { value } from './a.js';" },
  ]);

  assert.deepEqual(result.reExportLineage, []);
  assert.deepEqual(result.unresolvedReExportLineage.map(({ source, exported, reason }) =>
    ({ source, exported, reason })), [
    { source: 'src/a.js', exported: 'value', reason: 'cyclic-re-export' },
    { source: 'src/b.js', exported: 'value', reason: 'cyclic-re-export' },
  ]);
});
