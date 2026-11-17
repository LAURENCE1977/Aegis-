import test from 'node:test';
import assert from 'node:assert/strict';
import { parseModuleImports } from '../scripts/forge-tree-sitter-namespace-members.mjs';

test('resolves namespace member references to directly exported declarations', async () => {
  const result = await parseModuleImports([
    { path: 'src/toolkit.js', content: [
      'export function run() {}',
      'export const Config = {};',
    ].join('\n') },
    { path: 'src/consumer.js', content: [
      "import * as toolkit from './toolkit.js';",
      'toolkit.run();',
      'const config = toolkit.Config;',
    ].join('\n') },
  ]);

  assert.deepEqual(result.namespaceMemberEdges.map(({ source, target, namespace, imported, local, usage }) =>
    ({ source, target, namespace, imported, local, usage })), [
    { source: 'src/consumer.js', target: 'src/toolkit.js', namespace: 'toolkit', imported: 'run', local: 'toolkit', usage: 'call' },
    { source: 'src/consumer.js', target: 'src/toolkit.js', namespace: 'toolkit', imported: 'Config', local: 'toolkit', usage: 'member' },
  ]);
  assert.ok(result.namespaceMemberEdges.every(edge =>
    edge.location.start.line > 0 && edge.targetLocation.start.line > 0));
});

test('does not mistake a locally shadowed namespace name for an imported namespace', async () => {
  const result = await parseModuleImports([
    { path: 'src/toolkit.js', content: 'export function run() {}' },
    { path: 'src/consumer.js', content: [
      "import * as toolkit from './toolkit.js';",
      'function local() {',
      '  const toolkit = {};',
      '  toolkit.fake();',
      '}',
      'toolkit.run();',
    ].join('\n') },
  ]);

  assert.deepEqual(result.namespaceMemberEdges.map(({ imported, location }) =>
    ({ imported, line: location.start.line })), [
    { imported: 'run', line: 6 },
  ]);
});

test('reports missing namespace exports without fabricating a member edge', async () => {
  const result = await parseModuleImports([
    { path: 'src/toolkit.js', content: 'export function run() {}' },
    { path: 'src/consumer.js', content: [
      "import * as toolkit from './toolkit.js';",
      'toolkit.missing();',
    ].join('\n') },
  ]);

  assert.deepEqual(result.namespaceMemberEdges, []);
  assert.deepEqual(result.unresolvedNamespaceMembers.map(({ namespace, imported, reason }) =>
    ({ namespace, imported, reason })), [
    { namespace: 'toolkit', imported: 'missing', reason: 'missing-export' },
  ]);
});
