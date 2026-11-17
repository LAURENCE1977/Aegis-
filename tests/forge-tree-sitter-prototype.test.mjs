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
  assert.deepEqual(result.imports.map(item => [item.kind, item.specifier]), [
    ['static', 'react'],
    ['static', './view.jsx'],
    ['re-export', './helper.js'],
    ['dynamic', './lazy.js'],
    ['commonjs', './common.cjs'],
  ]);
  assert.equal(result.execution, 'none');
  assert.equal(result.parser, 'tree-sitter');
});

test('parses TypeScript and TSX and reports syntax errors without executing source', async () => {
  const result = await parseModuleImports([
    { path: 'src/component.tsx', content: "import type { Props } from './types'; export const View = (p: Props) => <div>{p.name}</div>;" },
    { path: 'src/broken.ts', content: 'import { value } from \"./value\"; const = ;' },
  ]);
  assert.equal(result.files.length, 2);
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
