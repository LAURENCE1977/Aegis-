import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeJavaScriptModuleGraph } from '../functions/lib/forge-code-intelligence.mjs';

test('builds a read-only graph for relative static imports and re-exports', () => {
  const result = analyzeJavaScriptModuleGraph([
    { path: 'src/main.ts', content: "import { boot } from './core/boot';\nexport * from './shared/types';" },
    { path: 'src/core/boot.ts', content: "import '../shared/types.js';" },
    { path: 'src/shared/types.ts', content: 'export const ready = true;' },
  ]);
  assert.equal(result.nodes.length, 3);
  assert.deepEqual(result.edges.map(edge => [edge.from, edge.to]), [
    ['src/core/boot.ts', 'src/shared/types.ts'],
    ['src/main.ts', 'src/core/boot.ts'],
    ['src/main.ts', 'src/shared/types.ts'],
  ]);
  assert.equal(result.unresolved.length, 0);
});

test('records unresolved relative imports without guessing external packages', () => {
  const result = analyzeJavaScriptModuleGraph([
    { path: 'src/main.js', content: "import './missing'; import React from 'react';" },
  ]);
  assert.equal(result.edges.length, 0);
  assert.deepEqual(result.unresolved.map(item => item.specifier), ['./missing']);
  assert.equal(result.externalImports.length, 1);
  assert.equal(result.externalImports[0].specifier, 'react');
});

test('recognises literal dynamic imports but ignores non-literal dynamic expressions', () => {
  const result = analyzeJavaScriptModuleGraph([
    { path: 'src/main.js', content: "const a = import('./lazy.js'); const b = import(name);" },
    { path: 'src/lazy.js', content: 'export default 1;' },
  ]);
  assert.deepEqual(result.edges.map(edge => [edge.from, edge.to]), [['src/main.js', 'src/lazy.js']]);
  assert.equal(result.unresolved.length, 0);
});

test('rejects traversal paths, duplicate paths, oversized files and excessive file counts', () => {
  assert.throws(() => analyzeJavaScriptModuleGraph([{ path: '../secret.js', content: '' }]), /path/i);
  assert.throws(() => analyzeJavaScriptModuleGraph([
    { path: 'src/a.js', content: '' }, { path: 'src/a.js', content: '' },
  ]), /duplicate/i);
  assert.throws(() => analyzeJavaScriptModuleGraph([{ path: 'src/a.js', content: 'x'.repeat(512 * 1024 + 1) }]), /size/i);
  assert.throws(() => analyzeJavaScriptModuleGraph(Array.from({ length: 1001 }, (_, i) => ({
    path: `src/${i}.js`, content: '',
  }))), /file count/i);
});

test('does not execute inspected source and ignores non-JavaScript files', () => {
  const result = analyzeJavaScriptModuleGraph([
    { path: 'README.md', content: "import './not-code';" },
    { path: 'src/main.ts', content: "import './helper';" },
    { path: 'src/helper.ts', content: 'globalThis.__aegis_test = true;' },
  ]);
  assert.equal(result.nodes.length, 2);
  assert.equal(result.edges.length, 1);
  assert.equal(globalThis.__aegis_test, undefined);
});
