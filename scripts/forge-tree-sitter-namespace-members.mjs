import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { Parser, Language } from 'web-tree-sitter';
import { parseModuleImports as parseBaseModuleImports } from './forge-tree-sitter-prototype.mjs';

const require = createRequire(import.meta.url);
const packageRoot = name => dirname(dirname(dirname(require.resolve(name))));

const LEXICAL_SCOPE_TYPES = new Set([
  'program', 'statement_block', 'switch_body', 'catch_clause',
  'for_statement', 'for_in_statement',
]);
const FUNCTION_SCOPE_TYPES = new Set([
  'program', 'function_declaration', 'generator_function_declaration',
  'function_expression', 'generator_function', 'arrow_function', 'method_definition',
]);
const FUNCTION_TYPES = new Set([
  'function_declaration', 'generator_function_declaration',
  'function_expression', 'generator_function', 'arrow_function', 'method_definition',
]);

function walk(node, visit) {
  visit(node);
  for (let index = 0; index < node.childCount; index += 1) walk(node.child(index), visit);
}

function locationOf(node) {
  return {
    start: { line: node.startPosition.row + 1, column: node.startPosition.column + 1 },
    end: { line: node.endPosition.row + 1, column: node.endPosition.column + 1 },
  };
}

function scopeIdentity(node) {
  return `${node.type}:${node.startIndex}:${node.endIndex}`;
}

function nearestScope(node, allowed) {
  let current = node.parent;
  while (current) {
    if (allowed.has(current.type)) return current;
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

function scopeChain(node) {
  const result = [];
  let current = node.parent;
  while (current) {
    if (LEXICAL_SCOPE_TYPES.has(current.type) || FUNCTION_SCOPE_TYPES.has(current.type)) {
      result.push(scopeIdentity(current));
    }
    current = current.parent;
  }
  return result;
}

function collectLocalBindings(root) {
  const bindings = [];
  walk(root, node => {
    if (node.type === 'variable_declarator') {
      const name = node.childForFieldName('name');
      const scope = declarationScope(node);
      if (name?.type === 'identifier' && scope) {
        bindings.push({ name: name.text, scope: scopeIdentity(scope) });
      }
      return;
    }

    if (node.type === 'function_declaration' || node.type === 'generator_function_declaration' ||
        node.type === 'class_declaration') {
      const name = node.childForFieldName('name');
      const scope = nearestScope(node, LEXICAL_SCOPE_TYPES);
      if (name?.type === 'identifier' && scope) {
        bindings.push({ name: name.text, scope: scopeIdentity(scope) });
      }
      return;
    }

    if (node.type === 'formal_parameters') {
      const owner = node.parent;
      if (FUNCTION_TYPES.has(owner?.type)) {
        for (const parameter of node.namedChildren) {
          if (parameter.type === 'identifier') {
            bindings.push({ name: parameter.text, scope: scopeIdentity(owner) });
          }
        }
      }
      return;
    }

    if (node.type === 'catch_clause') {
      const parameter = node.childForFieldName('parameter');
      const body = node.childForFieldName('body');
      if (parameter?.type === 'identifier' && body) {
        bindings.push({ name: parameter.text, scope: scopeIdentity(node) });
      }
    }
  });
  return bindings;
}

function isShadowed(name, scopes, localBindings) {
  const visibleScopes = new Set(scopes);
  return localBindings.some(binding => binding.name === name && visibleScopes.has(binding.scope));
}

function resolveMembers(root, path, namespaceBindings, moduleEdges, symbols) {
  const localBindings = collectLocalBindings(root);
  const edges = [];
  const unresolved = [];

  walk(root, node => {
    if (node.type !== 'member_expression') return;
    const object = node.childForFieldName('object');
    const property = node.childForFieldName('property');
    if (object?.type !== 'identifier' || property?.type !== 'property_identifier' &&
        property?.type !== 'identifier') return;

    const namespace = namespaceBindings.find(binding =>
      binding.path === path && binding.local === object.text);
    if (!namespace) return;

    const scopes = scopeChain(node);
    if (isShadowed(object.text, scopes, localBindings)) return;

    const moduleEdge = moduleEdges.find(edge =>
      edge.source === path && edge.specifier === namespace.specifier);
    if (!moduleEdge) return;

    const imported = property.text;
    const matches = symbols.filter(symbol =>
      symbol.path === moduleEdge.target && symbol.exported && !symbol.isDefault &&
      symbol.name === imported);
    const parent = node.parent;
    const usage = parent?.type === 'call_expression' &&
      parent.child(0)?.startIndex === node.startIndex ? 'call' : 'member';

    if (matches.length === 1) {
      edges.push({
        source: path,
        target: moduleEdge.target,
        namespace: namespace.local,
        imported,
        local: namespace.local,
        usage,
        location: locationOf(node),
        targetLocation: matches[0].location,
      });
    } else {
      unresolved.push({
        path,
        target: moduleEdge.target,
        namespace: namespace.local,
        imported,
        local: namespace.local,
        reason: matches.length > 1 ? 'ambiguous-export' : 'missing-export',
        location: locationOf(node),
      });
    }
  });

  const byLocation = (a, b) => a.path.localeCompare(b.path) ||
    a.location.start.line - b.location.start.line ||
    a.location.start.column - b.location.start.column ||
    a.namespace.localeCompare(b.namespace) || a.imported.localeCompare(b.imported);
  edges.sort(byLocation);
  unresolved.sort(byLocation);
  return { namespaceMemberEdges: edges, unresolvedNamespaceMembers: unresolved };
}

/**
 * Extends the isolated read-only Tree-sitter report with conservative namespace
 * member references. Local shadowing suppresses a namespace edge rather than
 * guessing. Source text is parsed only and is never executed.
 */
export async function parseModuleImports(inputFiles) {
  const base = await parseBaseModuleImports(inputFiles);
  const jsRoot = packageRoot('tree-sitter-javascript');
  const tsRoot = packageRoot('tree-sitter-typescript');
  await Parser.init();

  const languages = {
    js: await Language.load(join(jsRoot, 'tree-sitter-javascript.wasm')),
    ts: await Language.load(join(tsRoot, 'tree-sitter-typescript.wasm')),
    tsx: await Language.load(join(tsRoot, 'tree-sitter-tsx.wasm')),
  };
  const parser = new Parser();
  const trees = [];
  const namespaceMemberEdges = [];
  const unresolvedNamespaceMembers = [];

  try {
    for (const item of inputFiles) {
      const extension = item.path.slice(item.path.lastIndexOf('.')).toLowerCase();
      parser.setLanguage(extension === '.ts' ? languages.ts : extension === '.tsx' ? languages.tsx : languages.js);
      const tree = parser.parse(item.content);
      trees.push(tree);
      const result = resolveMembers(
        tree.rootNode,
        item.path,
        base.namespaceBindings,
        base.moduleEdges,
        base.symbols,
      );
      namespaceMemberEdges.push(...result.namespaceMemberEdges);
      unresolvedNamespaceMembers.push(...result.unresolvedNamespaceMembers);
    }
  } finally {
    for (const tree of trees) tree.delete();
    parser.delete();
  }

  return {
    ...base,
    namespaceMemberEdges,
    unresolvedNamespaceMembers,
  };
}
