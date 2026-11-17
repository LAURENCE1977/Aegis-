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
    ].join('\n'),
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
    ].join('\n'),
  }]);
  assert.deepEqual(result.calls.map(({ caller, callee }) => ({ caller, callee })), [
    { caller: 'start', callee: 'finish' },
  ]);
  assert.deepEqual(result.calls[0].location.start, { line: 2, column: 3 });
});


test('links calls to locally declared arrow-function variables', async () => {
  const result = await parseModuleImports([{
    path: 'src/arrow-callee.js',
    content: [
      'const start = () => finish();',
      'const finish = () => true;',
    ].join('\n'),
  }]);
  assert.deepEqual(result.calls.map(({ caller, callee }) => ({ caller, callee })), [
    { caller: 'start', callee: 'finish' },
  ]);
  assert.deepEqual(result.calls[0].location.start, { line: 1, column: 21 });
});


test('does not resolve a call to a same-named function in an unrelated nested scope', async () => {
  const result = await parseModuleImports([{
    path: 'src/shadowing.js',
    content: [
      'function outer() {',
      '  function finish() {}',
      '}',
      'function start() {',
      '  finish();',
      '}',
    ].join('\n'),
  }]);
  assert.deepEqual(result.calls, []);
});

test('resolves a shadowed call only to the nearest function declaration', async () => {
  const result = await parseModuleImports([{
    path: 'src/nested-shadowing.js',
    content: [
      'function finish() {}',
      'function outer() {',
      '  function finish() {}',
      '  function inner() {',
      '    finish();',
      '  }',
      '  finish();',
      '}',
      'function start() {',
      '  finish();',
      '}',
    ].join('\n'),
  }]);
  assert.deepEqual(result.calls.map(({ caller, callee, location, calleeLocation }) => ({
    caller, callee, line: location.start.line, declarationLine: calleeLocation.start.line,
  })), [
    { caller: 'inner', callee: 'finish', line: 5, declarationLine: 3 },
    { caller: 'outer', callee: 'finish', line: 7, declarationLine: 3 },
    { caller: 'start', callee: 'finish', line: 10, declarationLine: 1 },
  ]);
});

test('does not treat a nested same-name declaration as the target of an outer-scope call', async () => {
  const result = await parseModuleImports([{
    path: 'src/lexical-shadowing.js',
    content: [
      'function finish() {}',
      'function start() {',
      '  finish();',
      '  function nested() {',
      '    function finish() {}',
      '    finish();',
      '  }',
      '}',
    ].join('\n'),
  }]);
  assert.deepEqual(result.calls.map(({ caller, callee, location, calleeLocation }) => ({
    caller, callee, line: location.start.line, declarationLine: calleeLocation.start.line,
  })), [
    { caller: 'start', callee: 'finish', line: 3, declarationLine: 1 },
    { caller: 'nested', callee: 'finish', line: 6, declarationLine: 5 },
  ]);
});


test('resolves relative module imports only against files present in the supplied source bundle', async () => {
  const result = await parseModuleImports([
    { path: 'src/main.js', content: [
      "import { run } from './lib/worker';",
      "export { helper } from './lib/helper.js';",
      "import external from 'external-package';",
    ].join('\\n') },
    { path: 'src/lib/worker.ts', content: 'export function run() {}' },
    { path: 'src/lib/helper.js', content: 'export const helper = true;' },
  ]);
  assert.deepEqual(result.moduleEdges.map(({ source, target, kind, specifier }) =>
    ({ source, target, kind, specifier })), [
    { source: 'src/main.js', target: 'src/lib/helper.js', kind: 're-export', specifier: './lib/helper.js' },
    { source: 'src/main.js', target: 'src/lib/worker.ts', kind: 'static', specifier: './lib/worker' },
  ]);
});

test('does not guess when a relative module specifier matches multiple supplied files', async () => {
  const result = await parseModuleImports([
    { path: 'src/main.js', content: "import './worker';" },
    { path: 'src/worker.js', content: 'export const a = 1;' },
    { path: 'src/worker.ts', content: 'export const b = 2;' },
  ]);
  assert.deepEqual(result.moduleEdges, []);
  assert.deepEqual(result.unresolvedImports.map(({ path, specifier, reason }) =>
    ({ path, specifier, reason })), [
    { path: 'src/main.js', specifier: './worker', reason: 'ambiguous-local-target' },
  ]);
});

test('classifies package imports and missing relative targets without claiming a local edge', async () => {
  const result = await parseModuleImports([{
    path: 'src/main.js',
    content: "import React from 'react'; import './missing.js'; import '../../outside.js';",
  }]);
  assert.deepEqual(result.moduleEdges, []);
  assert.deepEqual(result.unresolvedImports.map(({ specifier, reason }) => ({ specifier, reason })), [
    { specifier: '../../outside.js', reason: 'outside-source-bundle' },
    { specifier: './missing.js', reason: 'missing-local-target' },
    { specifier: 'react', reason: 'external-package' },
  ]);
});


test('links named, aliased and default imports to matching exported declarations', async () => {
  const result = await parseModuleImports([
    { path: 'src/main.ts', content: [
      "import { run as start, Config } from './worker';",
      "import Worker from './default-worker.js';",
    ].join('\\n') },
    { path: 'src/worker.ts', content: [
      'export function run() {}',
      'export interface Config {}',
    ].join('\\n') },
    { path: 'src/default-worker.js', content: 'export default class Worker {}' },
  ]);
  assert.deepEqual(result.symbolEdges.map(({ source, target, imported, local, kind }) =>
    ({ source, target, imported, local, kind })), [
    { source: 'src/main.ts', target: 'src/default-worker.js', imported: 'default', local: 'Worker', kind: 'default' },
    { source: 'src/main.ts', target: 'src/worker.ts', imported: 'Config', local: 'Config', kind: 'named' },
    { source: 'src/main.ts', target: 'src/worker.ts', imported: 'run', local: 'start', kind: 'named' },
  ]);
  assert.ok(result.symbolEdges.every(edge => edge.location.start.line > 0 && edge.targetLocation.start.line > 0));
});

test('reports missing exported names rather than inventing symbol edges', async () => {
  const result = await parseModuleImports([
    { path: 'src/main.js', content: "import { missing } from './worker.js';" },
    { path: 'src/worker.js', content: 'export function present() {}' },
  ]);
  assert.deepEqual(result.symbolEdges, []);
  assert.deepEqual(result.unresolvedSymbolImports.map(({ imported, local, reason }) =>
    ({ imported, local, reason })), [
    { imported: 'missing', local: 'missing', reason: 'missing-export' },
  ]);
});


test('resolves function-valued var declarations through their enclosing function scope', async () => {
  const result = await parseModuleImports([{
    path: 'src/function-scoped-var.js',
    content: [
      'function start() {',
      '  if (true) {',
      '    var finish = () => true;',
      '  }',
      '  finish();',
      '}',
    ].join('\n'),
  }]);
  assert.deepEqual(result.calls.map(({ caller, callee, location, calleeLocation }) => ({
    caller, callee, line: location.start.line, declarationLine: calleeLocation.start.line,
  })), [
    { caller: 'start', callee: 'finish', line: 5, declarationLine: 3 },
  ]);
});


test('extracts explicit named re-export lineage without flattening it into a direct import', async () => {
  const result = await parseModuleImports([
    { path: 'src/source.js', content: 'export function original() {}' },
    { path: 'src/barrel.js', content: "export { original as renamed } from './source.js';" },
    { path: 'src/consumer.js', content: "import { renamed as localName } from './barrel.js';" },
  ]);

  assert.deepEqual(result.reExportEdges.map(({ source, target, imported, exported }) =>
    ({ source, target, imported, exported })), [
    { source: 'src/barrel.js', target: 'src/source.js', imported: 'original', exported: 'renamed' },
  ]);
  assert.deepEqual(result.unresolvedReExports, []);
  assert.equal(result.symbolEdges.some(edge =>
    edge.source === 'src/consumer.js' && edge.target === 'src/source.js'), false);
});
