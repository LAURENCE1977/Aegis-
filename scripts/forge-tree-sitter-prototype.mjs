import { dirname, join, posix } from 'node:path';
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

function functionOwnerName(callNode) {
  let current = callNode.parent;
  while (current) {
    if (current.type === 'function_declaration' || current.type === 'generator_function_declaration') {
      const name = current.childForFieldName('name');
      return name?.type === 'identifier' ? name.text : null;
    }
    if (current.type === 'arrow_function' || current.type === 'function_expression' ||
        current.type === 'generator_function') {
      const ownName = current.childForFieldName('name');
      if (ownName?.type === 'identifier') return ownName.text;

      let parent = current.parent;
      while (parent && ['parenthesized_expression', 'as_expression', 'satisfies_expression'].includes(parent.type)) {
        parent = parent.parent;
      }
      if (parent?.type === 'variable_declarator') {
        const variableName = parent.childForFieldName('name');
        return variableName?.type === 'identifier' ? variableName.text : null;
      }
      return null;
    }
    current = current.parent;
  }
  return null;
}

const LEXICAL_SCOPE_TYPES = new Set([
  'program',
  'statement_block',
  'switch_body',
  'catch_clause',
  'for_statement',
  'for_in_statement',
]);

const FUNCTION_SCOPE_TYPES = new Set([
  'program',
  'function_declaration',
  'generator_function_declaration',
  'function_expression',
  'generator_function',
  'arrow_function',
  'method_definition',
]);

function scopeIdentity(node) {
  return `${node.type}:${node.startIndex}:${node.endIndex}`;
}

function nearestScope(node, allowedTypes) {
  let current = node.parent;
  while (current) {
    if (allowedTypes.has(current.type)) return current;
    current = current.parent;
  }
  return null;
}

function declarationScope(node) {
  let current = node.parent;
  while (current && current.type !== 'lexical_declaration' && current.type !== 'variable_declaration') {
    current = current.parent;
  }
  const isVar = current?.children.some(child => child.text === 'var');
  return nearestScope(node, isVar ? FUNCTION_SCOPE_TYPES : LEXICAL_SCOPE_TYPES);
}

function lexicalScopeChain(node) {
  const scopes = [];
  let current = node.parent;
  while (current) {
    if (LEXICAL_SCOPE_TYPES.has(current.type) || FUNCTION_SCOPE_TYPES.has(current.type)) scopes.push(current);
    current = current.parent;
  }
  return scopes;
}

function extractCalls(root, path) {
  const declarations = [];
  walk(root, node => {
    if (node.type === 'function_declaration' || node.type === 'generator_function_declaration') {
      const name = node.childForFieldName('name');
      const scope = nearestScope(node, LEXICAL_SCOPE_TYPES);
      if (name?.type === 'identifier' && scope) {
        declarations.push({ name: name.text, scope: scopeIdentity(scope), node, kind: 'function' });
      }
      return;
    }

    if (node.type === 'variable_declarator') {
      const value = node.childForFieldName('value');
      const name = node.childForFieldName('name');
      if (name?.type === 'identifier' &&
          ['arrow_function', 'function_expression', 'generator_function'].includes(value?.type)) {
        const scope = declarationScope(node);
        if (scope) declarations.push({ name: name.text, scope: scopeIdentity(scope), node, kind: 'function-variable' });
      }
    }
  });

  const calls = [];
  walk(root, node => {
    if (node.type !== 'call_expression') return;
    const callee = node.child(0);
    if (callee?.type !== 'identifier') return;

    const scopes = lexicalScopeChain(node);
    let target = null;
    for (const scope of scopes) {
      const scopeId = scopeIdentity(scope);
      const matches = declarations.filter(declaration =>
        declaration.scope === scopeId && declaration.name === callee.text);
      if (matches.length > 1) return;
      if (matches.length === 1) {
        target = matches[0];
        break;
      }
    }
    if (!target) return;

    const caller = functionOwnerName(node);
    if (!caller) return;

    calls.push({
      path,
      caller,
      callee: callee.text,
      location: locationOf(node),
      calleeLocation: locationOf(target.node),
      calleeKind: target.kind,
    });
  });
  return calls;
}

const LOCAL_EXTENSIONS = ['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx'];

function resolveLocalSpecifier(sourcePath, specifier, availablePaths) {
  if (!specifier.startsWith('./') && !specifier.startsWith('../')) {
    return { reason: 'external-package' };
  }

  const candidateBase = posix.normalize(posix.join(posix.dirname(sourcePath), specifier));
  if (candidateBase === '..' || candidateBase.startsWith('../') || candidateBase.startsWith('/')) {
    return { reason: 'outside-source-bundle' };
  }

  const hasExtension = Boolean(posix.extname(candidateBase));
  const candidates = hasExtension
    ? [candidateBase]
    : [
        candidateBase,
        ...LOCAL_EXTENSIONS.map(extension => candidateBase + extension),
        ...LOCAL_EXTENSIONS.map(extension => posix.join(candidateBase, 'index' + extension)),
      ];
  const matches = [...new Set(candidates.filter(candidate => availablePaths.has(candidate)))];

  if (matches.length === 0) return { reason: 'missing-local-target' };
  if (matches.length > 1) return { reason: 'ambiguous-local-target' };
  return { target: matches[0] };
}

function resolveModuleEdges(imports, inputFiles) {
  const availablePaths = new Set(inputFiles.map(item => item.path));
  const moduleEdges = [];
  const unresolvedImports = [];

  for (const item of imports) {
    const resolved = resolveLocalSpecifier(item.path, item.specifier, availablePaths);
    if (resolved.target) {
      moduleEdges.push({
        source: item.path,
        target: resolved.target,
        kind: item.kind,
        specifier: item.specifier,
        location: item.location,
      });
    } else {
      unresolvedImports.push({
        path: item.path,
        specifier: item.specifier,
        kind: item.kind,
        reason: resolved.reason,
        location: item.location,
      });
    }
  }

  const bySource = (a, b) => a.path.localeCompare(b.path) ||
    a.specifier.localeCompare(b.specifier) || a.kind.localeCompare(b.kind);
  moduleEdges.sort((a, b) => a.source.localeCompare(b.source) ||
    a.target.localeCompare(b.target) || a.specifier.localeCompare(b.specifier) ||
    a.kind.localeCompare(b.kind));
  unresolvedImports.sort(bySource);
  return { moduleEdges, unresolvedImports };
}

function extractImportBindings(root, path) {
  const bindings = [];
  walk(root, node => {
    if (node.type !== 'import_statement') return;
    const source = literal(node.childForFieldName('source'));
    if (source === null) return;

    const clause = node.namedChildren.find(child => child.type === 'import_clause');
    if (!clause) return;

    for (const child of clause.namedChildren) {
      if (child.type === 'identifier') {
        bindings.push({
          path,
          specifier: source,
          imported: 'default',
          local: child.text,
          kind: 'default',
          location: locationOf(node),
        });
      } else if (child.type === 'named_imports') {
        for (const specifier of child.namedChildren.filter(item => item.type === 'import_specifier')) {
          const nameNode = specifier.childForFieldName('name');
          const aliasNode = specifier.childForFieldName('alias');
          if (!nameNode) continue;
          const imported = nameNode.type === 'string' ? literal(nameNode) : nameNode.text;
          const local = aliasNode?.text || imported;
          if (!imported || !local) continue;
          bindings.push({
            path,
            specifier: source,
            imported,
            local,
            kind: 'named',
            location: locationOf(specifier),
          });
        }
      }
    }
  });
  return bindings;
}

function resolveSymbolEdges(importBindings, moduleEdges, symbols) {
  const symbolEdges = [];
  const unresolvedSymbolImports = [];

  for (const binding of importBindings) {
    const moduleEdge = moduleEdges.find(edge =>
      edge.source === binding.path && edge.specifier === binding.specifier);
    if (!moduleEdge) continue;

    const matches = symbols.filter(symbol => {
      if (symbol.path !== moduleEdge.target || !symbol.exported) return false;
      const exportName = symbol.isDefault ? 'default' : symbol.name;
      return exportName === binding.imported;
    });

    if (matches.length === 1) {
      symbolEdges.push({
        source: binding.path,
        target: moduleEdge.target,
        imported: binding.imported,
        local: binding.local,
        kind: binding.kind,
        location: binding.location,
        targetLocation: matches[0].location,
      });
    } else {
      unresolvedSymbolImports.push({
        path: binding.path,
        target: moduleEdge.target,
        imported: binding.imported,
        local: binding.local,
        reason: matches.length > 1 ? 'ambiguous-export' : 'missing-export',
        location: binding.location,
      });
    }
  }

  symbolEdges.sort((a, b) => a.source.localeCompare(b.source) ||
    a.target.localeCompare(b.target) || a.imported.localeCompare(b.imported) ||
    a.local.localeCompare(b.local));
  unresolvedSymbolImports.sort((a, b) => a.path.localeCompare(b.path) ||
    a.imported.localeCompare(b.imported) || a.local.localeCompare(b.local));
  return { symbolEdges, unresolvedSymbolImports };
}

function extractReExports(root, path) {
  const reExports = [];
  const unresolvedReExports = [];

  for (const statement of root.namedChildren.filter(node => node.type === 'export_statement')) {
    const specifier = literal(statement.namedChildren.find(child => child.type === 'string'));
    if (specifier === null) continue;

    const exportSpecifiers = [];
    walk(statement, node => {
      if (node.type === 'export_specifier') exportSpecifiers.push(node);
    });

    if (exportSpecifiers.length === 0) {
      unresolvedReExports.push({
        path,
        specifier,
        reason: statement.children.some(child => child.text === '*')
          ? 'star-or-namespace-re-export-not-resolved'
          : 'unsupported-re-export-shape',
        location: locationOf(statement),
      });
      continue;
    }

    for (const item of exportSpecifiers) {
      const nameNode = item.childForFieldName('name');
      const aliasNode = item.childForFieldName('alias');
      const imported = nameNode?.type === 'string' ? literal(nameNode) : nameNode?.text;
      const exported = aliasNode?.type === 'string' ? literal(aliasNode) : aliasNode?.text || imported;
      if (!imported || !exported) {
        unresolvedReExports.push({
          path,
          specifier,
          reason: 'unsupported-export-name',
          location: locationOf(item),
        });
        continue;
      }
      reExports.push({
        path,
        specifier,
        imported,
        exported,
        location: locationOf(item),
      });
    }
  }

  return { reExports, unresolvedReExports };
}

function resolveReExportEdges(reExports, unresolved, moduleEdges, unresolvedImports, symbols) {
  const reExportEdges = [];
  const unresolvedReExports = [...unresolved];

  for (const item of reExports) {
    const moduleEdge = moduleEdges.find(edge =>
      edge.source === item.path && edge.specifier === item.specifier);
    if (!moduleEdge) {
      const unresolvedModule = unresolvedImports.find(edge =>
        edge.path === item.path && edge.specifier === item.specifier);
      unresolvedReExports.push({
        path: item.path,
        specifier: item.specifier,
        imported: item.imported,
        exported: item.exported,
        reason: unresolvedModule?.reason || 'unresolved-module-target',
        location: item.location,
      });
      continue;
    }

    const matches = symbols.filter(symbol =>
      symbol.path === moduleEdge.target && symbol.exported &&
      (symbol.isDefault ? 'default' : symbol.name) === item.imported);

    if (matches.length === 1) {
      reExportEdges.push({
        source: item.path,
        target: moduleEdge.target,
        imported: item.imported,
        exported: item.exported,
        location: item.location,
        targetLocation: matches[0].location,
      });
    } else {
      unresolvedReExports.push({
        path: item.path,
        target: moduleEdge.target,
        specifier: item.specifier,
        imported: item.imported,
        exported: item.exported,
        reason: matches.length > 1 ? 'ambiguous-export' : 'missing-export',
        location: item.location,
      });
    }
  }

  reExportEdges.sort((a, b) => a.source.localeCompare(b.source) ||
    a.target.localeCompare(b.target) || a.exported.localeCompare(b.exported) ||
    a.imported.localeCompare(b.imported));
  unresolvedReExports.sort((a, b) => a.path.localeCompare(b.path) ||
    (a.exported || '').localeCompare(b.exported || '') ||
    (a.imported || '').localeCompare(b.imported || '') ||
    a.reason.localeCompare(b.reason));
  return { reExportEdges, unresolvedReExports };
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
  const calls = [];
  const importBindings = [];
  const reExports = [];
  const unresolvedReExportSyntax = [];
  const trees = [];

  try {
    for (const item of inputFiles) {
      const ext = item.path.slice(item.path.lastIndexOf('.')).toLowerCase();
      parser.setLanguage(ext === '.ts' ? languages.ts : ext === '.tsx' ? languages.tsx : languages.js);
      const tree = parser.parse(item.content);
      trees.push(tree);
      files.push({ path: item.path, hasError: tree.rootNode.hasError });
      imports.push(...extract(tree.rootNode, item.path));
      symbols.push(...extractSymbols(tree.rootNode, item.path));
      calls.push(...extractCalls(tree.rootNode, item.path));
      importBindings.push(...extractImportBindings(tree.rootNode, item.path));
      const extractedReExports = extractReExports(tree.rootNode, item.path);
      reExports.push(...extractedReExports.reExports);
      unresolvedReExportSyntax.push(...extractedReExports.unresolvedReExports);
    }
  } finally {
    for (const tree of trees) tree.delete();
    parser.delete();
  }

  imports.sort((a, b) => a.path.localeCompare(b.path) ||
    a.specifier.localeCompare(b.specifier) || a.kind.localeCompare(b.kind));
  calls.sort((a, b) => a.path.localeCompare(b.path) ||
    a.location.start.line - b.location.start.line ||
    a.location.start.column - b.location.start.column ||
    a.caller.localeCompare(b.caller) || a.callee.localeCompare(b.callee));

  const { moduleEdges, unresolvedImports } = resolveModuleEdges(imports, inputFiles);
  const { symbolEdges, unresolvedSymbolImports } =
    resolveSymbolEdges(importBindings, moduleEdges, symbols);
  const { reExportEdges, unresolvedReExports } = resolveReExportEdges(
    reExports, unresolvedReExportSyntax, moduleEdges, unresolvedImports, symbols);

  return {
    parser: 'tree-sitter',
    execution: 'none',
    files,
    imports,
    symbols,
    calls,
    moduleEdges,
    unresolvedImports,
    symbolEdges,
    unresolvedSymbolImports,
    reExportEdges,
    unresolvedReExports,
    limits: { maxFiles: MAX_FILES, maxFileBytes: MAX_FILE_BYTES, maxTotalBytes: MAX_TOTAL_BYTES },
  };
}
