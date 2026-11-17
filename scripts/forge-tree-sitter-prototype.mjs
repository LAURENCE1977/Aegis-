import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { Parser, Language } from 'web-tree-sitter';

const require = createRequire(import.meta.url);
const MAX_FILES = 50;
const MAX_FILE_BYTES = 32 * 1024;
const MAX_TOTAL_BYTES = 1024 * 1024;
const EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx']);

const packageRoot = name => dirname(dirname(dirname(require.resolve(name))));

function validatePath(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 240 ||
      value.startsWith('/') || value.includes('\\') ||
      value.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new TypeError('Invalid Tree-sitter source file path');
  }
  const extension = value.slice(value.lastIndexOf('.')).toLowerCase();
  if (!EXTENSIONS.has(extension)) throw new TypeError('Unsupported source extension');
  return value;
}

function literal(node) {
  if (!node || node.type !== 'string') return null;
  const raw = node.text;
  if (raw.length < 2 || !['"', "'"].includes(raw[0]) || raw.at(-1) !== raw[0]) return null;
  return raw.slice(1, -1);
}

function walk(node, visit) {
  visit(node);
  for (let i = 0; i < node.childCount; i++) walk(node.child(i), visit);
}

function locationOf(node) {
  return {
    start: { line: node.startPosition.row + 1, column: node.startPosition.column + 1 },
    end: { line: node.endPosition.row + 1, column: node.endPosition.column + 1 },
  };
}

function declarationKind(node) {
  if (node.type === 'function_declaration' || node.type === 'generator_function_declaration') return 'function';
  if (node.type === 'class_declaration') return 'class';
  if (node.type === 'interface_declaration') return 'interface';
  if (node.type === 'type_alias_declaration') return 'type';
  if (node.type === 'enum_declaration') return 'enum';
  if (node.type === 'lexical_declaration' || node.type === 'variable_declaration') {
    const keyword = node.children.find(child => ['const', 'let', 'var'].includes(child.text))?.text;
    return keyword || 'variable';
  }
  return null;
}

function extractSymbols(root, path) {
  const symbols = [];
  for (const topLevel of root.namedChildren) {
    const exported = topLevel.type === 'export_statement';
    const declaration = exported
      ? topLevel.namedChildren.find(child => declarationKind(child))
      : topLevel;
    if (!declaration) continue;

    const kind = declarationKind(declaration);
    const isDefault = exported && topLevel.children.some(child => child.text === 'default');
    const declarations = kind === 'const' || kind === 'let' || kind === 'var' || kind === 'variable'
      ? declaration.namedChildren.filter(child => child.type === 'variable_declarator')
      : [declaration];

    for (const item of declarations) {
      const nameNode = item.childForFieldName('name');
      if (!nameNode || nameNode.type !== 'identifier' && nameNode.type !== 'type_identifier') continue;
      symbols.push({
        path,
        kind: kind === 'variable' ? 'variable' : kind,
        name: nameNode.text,
        exported,
        isDefault,
        location: locationOf(item),
      });
    }
  }
  return symbols;
}

function extractCalls(root, path) {
  const declaredFunctions = new Set();
  walk(root, node => {
    if (node.type !== 'function_declaration' && node.type !== 'generator_function_declaration') return;
    const name = node.childForFieldName('name');
    if (name?.type === 'identifier') declaredFunctions.add(name.text);
  });

  const calls = [];
  walk(root, node => {
    if (node.type !== 'call_expression') return;
    const callee = node.child(0);
    if (callee?.type !== 'identifier' || !declaredFunctions.has(callee.text)) return;

    let enclosing = node.parent;
    while (enclosing && !['function_declaration', 'generator_function_declaration'].includes(enclosing.type)) {
      enclosing = enclosing.parent;
    }
    const caller = enclosing?.childForFieldName('name');
    if (!caller || caller.type !== 'identifier') return;

    calls.push({
      path,
      caller: caller.text,
      callee: callee.text,
      location: locationOf(node),
    });
  });
  return calls;
}

function extract(root, path) {
  const imports = [];
  walk(root, node => {
    if (node.type === 'import_statement' || node.type === 'export_statement') {
      const specifier = literal(node.namedChildren.find(child => child.type === 'string'));
      if (specifier !== null) imports.push({
        path,
        kind: node.type === 'import_statement' ? 'static' : 're-export',
        specifier,
        // Human-readable, one-based coordinates; end is exclusive.
        location: locationOf(node),
      });
    }
    if (node.type === 'call_expression') {
      const callee = node.child(0);
      const args = node.namedChildren.find(child => child.type === 'arguments');
      const specifier = literal(args?.namedChildren.find(child => child.type === 'string'));
      if (specifier !== null && (callee?.type === 'import' || (callee?.type === 'identifier' && callee.text === 'require'))) {
        imports.push({
          path,
          kind: callee.type === 'import' ? 'dynamic' : 'commonjs',
          specifier,
          location: locationOf(node),
        });
      }
    }
  });
  return imports;
}

/**
 * Isolated, read-only Tree-sitter prototype. Source is parsed as text only:
 * it is never imported, evaluated, installed, built or executed.
 */
export async function parseModuleImports(inputFiles) {
  if (!Array.isArray(inputFiles) || inputFiles.length < 1 || inputFiles.length > MAX_FILES) {
    throw new TypeError('Tree-sitter prototype accepts between 1 and 50 files');
  }

  const seenPaths = new Set();
  let totalBytes = 0;
  for (const item of inputFiles) {
    if (!item || typeof item !== 'object' || Array.isArray(item) ||
        typeof item.content !== 'string') {
      throw new TypeError('Invalid Tree-sitter source file');
    }
    const path = validatePath(item.path);
    if (seenPaths.has(path)) throw new TypeError('Duplicate Tree-sitter source file path');
    seenPaths.add(path);

    const bytes = new TextEncoder().encode(item.content).byteLength;
    if (bytes > MAX_FILE_BYTES) throw new TypeError('Tree-sitter source file exceeds 32 KiB');
    totalBytes += bytes;
    if (totalBytes > MAX_TOTAL_BYTES) throw new TypeError('Tree-sitter source bundle exceeds 1 MiB total');
  }

  const jsRoot = packageRoot('tree-sitter-javascript');
  const tsRoot = packageRoot('tree-sitter-typescript');
  await Parser.init();

  const languages = {
    js: await Language.load(join(jsRoot, 'tree-sitter-javascript.wasm')),
    ts: await Language.load(join(tsRoot, 'tree-sitter-typescript.wasm')),
    tsx: await Language.load(join(tsRoot, 'tree-sitter-tsx.wasm')),
  };
  const parser = new Parser();
  const files = [];
  const imports = [];
  const symbols = [];
  const trees = [];

  try {
    for (const item of inputFiles) {
      const ext = item.path.slice(item.path.lastIndexOf('.')).toLowerCase();
      parser.setLanguage(ext === '.ts' ? languages.ts : ext === '.tsx' ? languages.tsx : languages.js);
      const tree = parser.parse(item.content);
      trees.push(tree);
      files.push({ path: item.path, hasError: tree.rootNode.hasError });
      imports.push(...extract(tree.rootNode, item.path));
      symbols.push(...extractSymbols(tree.rootNode, item.path));\n      calls.push(...extractCalls(tree.rootNode, item.path));
    }
  } finally {
    for (const tree of trees) tree.delete();
    parser.delete();
  }

  imports.sort((a, b) => a.path.localeCompare(b.path) ||
    a.specifier.localeCompare(b.specifier) || a.kind.localeCompare(b.kind));

  return {
    parser: 'tree-sitter',
    execution: 'none',
    files,
    imports,
    symbols,
    limits: { maxFiles: MAX_FILES, maxFileBytes: MAX_FILE_BYTES, maxTotalBytes: MAX_TOTAL_BYTES },
  };
}
