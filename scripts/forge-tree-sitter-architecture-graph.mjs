import { resolveReExportGraph } from './forge-tree-sitter-reexport-graph.mjs';

function compareText(a, b) {
  return String(a).localeCompare(String(b));
}

function symbolId(symbol) {
  const location = symbol.location.start;
  return `symbol:${symbol.path}#${symbol.name}@${location.line}:${location.column}`;
}

function locationKey(location) {
  return `${location.start.line}:${location.start.column}`;
}

function findSymbol(symbols, path, location) {
  const key = locationKey(location);
  return symbols.find(symbol => symbol.path === path && locationKey(symbol.location) === key);
}

function connectedComponents(paths, edges) {
  const adjacency = new Map(paths.map(path => [path, new Set()]));
  for (const edge of edges) {
    if (!adjacency.has(edge.source) || !adjacency.has(edge.target)) continue;
    adjacency.get(edge.source).add(edge.target);
    adjacency.get(edge.target).add(edge.source);
  }

  const visited = new Set();
  const components = [];
  for (const path of [...paths].sort(compareText)) {
    if (visited.has(path)) continue;
    const pending = [path];
    const component = [];
    visited.add(path);
    while (pending.length) {
      const current = pending.pop();
      component.push(current);
      for (const neighbour of [...adjacency.get(current)].sort(compareText).reverse()) {
        if (visited.has(neighbour)) continue;
        visited.add(neighbour);
        pending.push(neighbour);
      }
    }
    components.push(component.sort(compareText));
  }
  return components.sort((a, b) => compareText(a[0], b[0]));
}

/**
 * Create a deterministic, evidence-preserving architecture graph from a bounded
 * source bundle. The parser only reads source text; no inspected code is run.
 */
export async function buildArchitectureGraph(inputFiles) {
  const analysis = await resolveReExportGraph(inputFiles);
  const nodes = [];
  const edges = [];
  const files = analysis.files.map(file => file.path).sort(compareText);
  const fileIds = new Set(files.map(path => `file:${path}`));

  for (const path of files) {
    nodes.push({ id: `file:${path}`, type: 'file', path });
  }

  const symbols = [...analysis.symbols].sort((a, b) =>
    compareText(a.path, b.path) ||
    a.location.start.line - b.location.start.line ||
    a.location.start.column - b.location.start.column ||
    compareText(a.name, b.name));

  for (const symbol of symbols) {
    nodes.push({
      id: symbolId(symbol),
      type: 'symbol',
      path: symbol.path,
      name: symbol.name,
      kind: symbol.kind,
      exported: symbol.exported,
      isDefault: symbol.isDefault,
      location: symbol.location,
    });
  }

  for (const edge of analysis.moduleEdges) {
    edges.push({
      id: `module:${edge.source}:${edge.location.start.line}:${edge.location.start.column}:${edge.target}`,
      type: 'imports-module',
      source: `file:${edge.source}`,
      target: `file:${edge.target}`,
      evidence: { path: edge.source, location: edge.location, specifier: edge.specifier, kind: edge.kind },
    });
  }

  for (const edge of analysis.symbolEdges) {
    const target = findSymbol(symbols, edge.target, edge.targetLocation);
    if (!target || !fileIds.has(`file:${edge.source}`)) continue;
    edges.push({
      id: `symbol-import:${edge.source}:${edge.location.start.line}:${edge.location.start.column}:${symbolId(target)}`,
      type: 'imports-symbol',
      source: `file:${edge.source}`,
      target: symbolId(target),
      evidence: { path: edge.source, location: edge.location, targetLocation: edge.targetLocation, imported: edge.imported, local: edge.local },
    });
  }

  for (const call of analysis.calls) {
    const target = findSymbol(symbols, call.path, call.calleeLocation);
    const callers = symbols.filter(symbol => symbol.path === call.path && symbol.name === call.caller);
    if (!target || callers.length !== 1) continue;
    edges.push({
      id: `call:${call.path}:${call.location.start.line}:${call.location.start.column}:${symbolId(target)}`,
      type: 'calls',
      source: symbolId(callers[0]),
      target: symbolId(target),
      evidence: { path: call.path, location: call.location, targetLocation: call.calleeLocation, calleeKind: call.calleeKind },
    });
  }

  for (const lineage of analysis.reExportLineage) {
    const target = findSymbol(symbols, lineage.target, lineage.targetLocation);
    if (!target) continue;
    const first = lineage.chain[0];
    edges.push({
      id: `re-export:${first.source}:${first.location.start.line}:${first.location.start.column}:${symbolId(target)}`,
      type: 're-exports-symbol',
      source: `file:${lineage.source}`,
      target: symbolId(target),
      evidence: {
        path: first.source,
        location: first.location,
        targetLocation: lineage.targetLocation,
        imported: lineage.imported,
        exported: lineage.exported,
        chain: lineage.chain,
      },
    });
  }

  const edgeOrder = (a, b) =>
    compareText(a.type, b.type) ||
    compareText(a.source, b.source) ||
    compareText(a.target, b.target) ||
    compareText(a.id, b.id);
  edges.sort(edgeOrder);

  const unresolved = {
    imports: analysis.unresolvedImports,
    symbolImports: analysis.unresolvedSymbolImports,
    reExports: analysis.unresolvedReExports,
    reExportLineage: analysis.unresolvedReExportLineage,
  };

  return {
    schemaVersion: '1.0.0',
    parser: analysis.parser,
    execution: 'none',
    nodes,
    edges,
    disconnectedComponents: connectedComponents(files, analysis.moduleEdges),
    unresolved,
    moduleCycles: analysis.moduleCycles,
    limits: analysis.limits,
  };
}
