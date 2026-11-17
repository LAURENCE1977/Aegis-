import test from 'node:test';
import assert from 'node:assert/strict';
import { parseModuleImports } from '../scripts/forge-tree-sitter-prototype.mjs';

test('extracts real JS/JSX imports and ignores import-like comments and strings', async () => {
  const result = await parseModuleImports([
    { path: 'src/main.jsx', content: [
      "// import './comment-only';",
      "const example = \"import './string-only'\";",
      "import React from 'react';",
      "import './view.jsx';",
      "export { helper } from './helper.js';",
      "const lazy = import('./lazy.js');",
      "const dynamic = import(moduleName);",
      "const common = require('./common.cjs');",
    ].join('\n') },
  ]);
  const actualImports = result.imports.map(item => [item.kind, item.specifier])
    .map(([kind, specifier]) => JSON.stringify([kind, specifier])).sort();
  const expectedImports = [
    ['static', 'react'],
    ['static', './view.jsx'],
    ['re-export', './helper.js'],
    ['dynamic', './lazy.js'],
    ['commonjs', './common.cjs'],
  ].map(item => JSON.stringify(item)).sort();
  assert.deepEqual(actualImports, expectedImports);
  assert.equal(result.files[0].hasError, false);
  assert.equal(result.execution, 'none');
  assert.equal(result.parser, 'tree-sitter');
  const reactImport = result.imports.find(item => item.specifier === 'react');
  assert.deepEqual(reactImport.location, { start: { line: 3, column: 1 }, end: { line: 3, column: 27 } });
  assert.deepEqual(result.imports.find(item => item.specifier === './view.jsx').location.start, { line: 4, column: 1 });
});

test('parses TypeScript and TSX and reports syntax errors without executing source', async () => {
  const result = await parseModuleImports([
    { path: 'src/component.tsx', content: "import type { Props } from './types'; export const View = (p: Props) => <div>{p.name}</div>;" },
    { path: 'src/broken.ts', content: 'import { value } from \"./value\"; const = ;' },
  ]);
  assert.equal(result.files.length, 2);
  assert.equal(result.files.find(file => file.path === 'src/component.tsx').hasError, false);
  assert.ok(result.files.some(file => file.path === 'src/broken.ts' && file.hasError));
  assert.ok(result.imports.some(item => item.specifier === './types'));
  assert.equal(result.execution, 'none');
});

test('rejects oversized and unsupported input before parsing', async () => {
  await assert.rejects(() => parseModuleImports([
    { path: 'src/large.js', content: 'x'.repeat(32 * 1024 + 1) },
  ]), /32 KiB/);
  await assert.rejects(() => parseModuleImports([
    { path: 'src/readme.md', content: 'text' },
  ]), /unsupported/i);
});


test('rejects unsafe paths, duplicate files and aggregate source beyond the bounded budget', async () => {
  await assert.rejects(() => parseModuleImports([
    { path: '../outside.js', content: 'export {};' },
  ]), /path/i);
  await assert.rejects(() => parseModuleImports([
    { path: '/absolute.js', content: 'export {};' },
  ]), /path/i);
  await assert.rejects(() => parseModuleImports([
    { path: 'src\\outside.js', content: 'export {};' },
  ]), /path/i);
  await assert.rejects(() => parseModuleImports([
    { path: 'src/same.js', content: 'export {};' },
    { path: 'src/same.js', content: 'export {};' },
  ]), /duplicate/i);
  await assert.rejects(() => parseModuleImports(Array.from({ length: 40 }, (_, index) => ({
    path: `src/file-${index}.js`,
    content: 'x'.repeat(32 * 1024),
  }))), /total|aggregate|bundle/i);
});


test('extracts module-level declarations and export metadata from JavaScript and TypeScript', async () => {
  const result = await parseModuleImports([{
    path: 'src/model.ts',
    content: [
      'export function greet(name: string) { return name; }',
      'export class Greeter {}',
      'export const answer = 42, other = true;',
      'export interface Props { label: string }',
      'export type Identifier = string;',
      'export enum State { Ready }',
      'function localOnly() {}',
      'export default function main() {}',
    ].join('\\n'),
  }]);
  assert.deepEqual(result.symbols.map(({ kind, name, exported, isDefault }) =>
    ({ kind, name, exported, isDefault })), [
    { kind: 'function', name: 'greet', exported: true, isDefault: false },
    { kind: 'class', name: 'Greeter', exported: true, isDefault: false },
    { kind: 'const', name: 'answer', exported: true, isDefault: false },
    { kind: 'const', name: 'other', exported: true, isDefault: false },
    { kind: 'interface', name: 'Props', exported: true, isDefault: false },
    { kind: 'type', name: 'Identifier', exported: true, isDefault: false },
    { kind: 'enum', name: 'State', exported: true, isDefault: false },
    { kind: 'function', name: 'localOnly', exported: false, isDefault: false },
    { kind: 'function', name: 'main', exported: true, isDefault: true },
  ]);
  assert.ok(result.symbols.every(symbol => symbol.path === 'src/model.ts' && symbol.location.start.line > 0));
});


test('links direct calls between locally declared functions with source evidence', async () => {
  const result = await parseModuleImports([{
    path: 'src/flow.js',
    content: [
      'function start() {',
      '  finish();',
      '  outside();',
      '  service.finish();',
      '}',
      'function finish() {}',
    ].join('\n'),
  }]);
  assert.deepEqual(result.calls.map(({ caller, callee, path }) => ({ caller, callee, path })), [
    { caller: 'start', callee: 'finish', path: 'src/flow.js' },
  ]);
  assert.deepEqual(result.calls[0].location.start, { line: 2, column: 3 });
});


test('attributes direct calls inside arrow-function variables to their local symbol', async () => {
  const result = await parseModuleImports([{
    path: 'src/arrows.js',
    content: [
      'const start = () => {',
      '  finish();',
      '};',
      'function finish() {}',
    ].join('\\n'),
  }]);
  assert.deepEqual(result.calls.map(({ caller, callee }) => ({ caller, callee })), [
    { caller: 'start', callee: 'finish' },
  ]);
  assert.deepEqual(result.calls[0].location.start, { line: 2, column: 3 });
});
