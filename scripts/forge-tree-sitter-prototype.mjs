import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { Parser, Language } from 'web-tree-sitter';
const require = createRequire(import.meta.url);
const MAX_FILES = 50, MAX_FILE_BYTES = 32 * 1024;
const EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx']);
const packageRoot = name => dirname(dirname(dirname(require.resolve(name))));
function literal(node) {
  if (!node || node.type !== 'string') return null;
  const raw = node.text;
  if (raw.length < 2 || !['"', "'"].includes(raw[0]) || raw.at(-1) !== raw[0]) return null;
  return raw.slice(1, -1);
}
function walk(node, visit) { visit(node); for (let i = 0; i < node.childCount; i++) walk(node.child(i), visit); }
function extract(root, path) {
  const imports = [];
  walk(root, node => {
    if (node.type === 'import_statement' || node.type === 'export_statement') {
      const specifier = literal(node.namedChildren.find(child => child.type === 'string'));
      if (specifier !== null) imports.push({ path, kind: node.type === 'import_statement' ? 'static' : 're-export', specifier });
    }
    if (node.type === 'call_expression') {
      const callee = node.child(0), args = node.namedChildren.find(child => child.type === 'arguments');
      const specifier = literal(args?.namedChildren.find(child => child.type === 'string'));
      if (specifier !== null && callee?.type === 'import') imports.push({ path, kind: 'dynamic', specifier });
      if (specifier !== null && callee?.type === 'identifier' && callee.text === 'require') imports.push({ path, kind: 'commonjs', specifier });
    }
  });
  return imports;
}
export async function parseModuleImports(inputFiles) {
  if (!Array.isArray(inputFiles) || inputFiles.length < 1 || inputFiles.length > MAX_FILES) throw new TypeError('Tree-sitter prototype accepts between 1 and 50 files');
  const jsRoot = packageRoot('tree-sitter-javascript'), tsRoot = packageRoot('tree-sitter-typescript');
  await Parser.init();
  const languages = {
    js: await Language.load(join(jsRoot, 'tree-sitter-javascript.wasm')),
    ts: await Language.load(join(tsRoot, 'tree-sitter-typescript.wasm')),
    tsx: await Language.load(join(tsRoot, 'tree-sitter-tsx.wasm')),
  };
  const parser = new Parser(), files = [], imports = [];
  try {
    for (const item of inputFiles) {
      if (!item || typeof item.path !== 'string' || typeof item.content !== 'string') throw new TypeError('Invalid Tree-sitter source file');
      const ext = item.path.slice(item.path.lastIndexOf('.')).toLowerCase();
      if (!EXTENSIONS.has(ext)) throw new TypeError('Unsupported source extension');
      if (new TextEncoder().encode(item.content).byteLength > MAX_FILE_BYTES) throw new TypeError('Tree-sitter source file exceeds 32 KiB');
      parser.setLanguage(ext === '.ts' ? languages.ts : ext === '.tsx' ? languages.tsx : languages.js);
      const tree = parser.parse(item.content);
      files.push({ path: item.path, hasError: tree.rootNode.hasError });
      imports.push(...extract(tree.rootNode, item.path));
      tree.delete();
    }
  } finally { parser.delete(); }
  imports.sort((a,b) => a.path.localeCompare(b.path) || a.specifier.localeCompare(b.specifier) || a.kind.localeCompare(b.kind));
  return { parser: 'tree-sitter', execution: 'none', files, imports };
}
