import { parseModuleImports as parseBaseModuleImports } from './forge-tree-sitter-prototype.mjs';

function edgeKey(source, exported) {
  return JSON.stringify([source, exported]);
}

/**
 * Resolve explicit named re-export chains across the exact bounded source bundle.
 * This is structural analysis only: it never loads or executes inspected source.
 */
export async function resolveReExportGraph(inputFiles) {
  const base = await parseBaseModuleImports(inputFiles);
  const candidates = [
    ...base.reExportEdges,
    ...base.unresolvedReExports.filter(item =>
      typeof item.target === 'string' &&
      typeof item.imported === 'string' &&
      typeof item.exported === 'string'),
  ].map(item => ({
    source: item.source ?? item.path,
    target: item.target,
    imported: item.imported,
    exported: item.exported,
    location: item.location,
    targetLocation: item.targetLocation,
    originalReason: item.reason,
  }));

  const bySourceAndExport = new Map();
  for (const candidate of candidates) {
    const key = edgeKey(candidate.source, candidate.exported);
    const entries = bySourceAndExport.get(key) ?? [];
    entries.push(candidate);
    bySourceAndExport.set(key, entries);
  }

  for (const entries of bySourceAndExport.values()) {
    entries.sort((a, b) =>
      a.target.localeCompare(b.target) ||
      a.imported.localeCompare(b.imported) ||
      a.location.start.line - b.location.start.line ||
      a.location.start.column - b.location.start.column);
  }

  const reExportLineage = [];
  const unresolvedReExportLineage = [];

  for (const initial of candidates) {
    const chain = [];
    const visited = new Set();
    let current = initial;
    let origin = null;
    let reason = null;

    while (current) {
      const key = edgeKey(current.source, current.exported);
      if (visited.has(key)) {
        reason = 'cyclic-re-export';
        break;
      }
      visited.add(key);

      chain.push({
        source: current.source,
        target: current.target,
        imported: current.imported,
        exported: current.exported,
        location: current.location,
      });

      const direct = base.symbols.filter(symbol =>
        symbol.path === current.target &&
        symbol.exported &&
        (symbol.isDefault ? 'default' : symbol.name) === current.imported);

      if (direct.length === 1) {
        origin = direct[0];
        break;
      }
      if (direct.length > 1) {
        reason = 'ambiguous-origin-export';
        break;
      }

      const next = bySourceAndExport.get(edgeKey(current.target, current.imported)) ?? [];
      if (next.length > 1) {
        reason = 'ambiguous-barrel-forwarding';
        break;
      }
      if (next.length === 0) {
        reason = current.originalReason && current.originalReason !== 'missing-export'
          ? current.originalReason
          : 'missing-origin-export';
        break;
      }
      current = next[0];
    }

    if (origin) {
      reExportLineage.push({
        source: initial.source,
        target: origin.path,
        imported: origin.name,
        exported: initial.exported,
        chain,
        targetLocation: origin.location,
      });
    } else {
      unresolvedReExportLineage.push({
        source: initial.source,
        target: initial.target,
        imported: initial.imported,
        exported: initial.exported,
        reason: reason ?? 'unresolved-re-export',
        chain,
        location: initial.location,
      });
    }
  }

  const sortLineage = (a, b) =>
    a.source.localeCompare(b.source) ||
    a.exported.localeCompare(b.exported) ||
    a.target.localeCompare(b.target) ||
    (a.imported ?? '').localeCompare(b.imported ?? '');
  reExportLineage.sort(sortLineage);
  unresolvedReExportLineage.sort(sortLineage);

  return { ...base, reExportLineage, unresolvedReExportLineage };
}
