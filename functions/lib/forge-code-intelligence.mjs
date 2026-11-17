const SUPPORTED_EXTENSIONS = ['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx'];
const MAX_FILES = 1000;
const MAX_FILE_BYTES = 512 * 1024;
const MAX_TOTAL_BYTES = 8 * 1024 * 1024;

function validatePath(value) {
  if (typeof value !== 'string' || !value || value.length > 240 ||
      value.startsWith('/') || value.includes('\\') ||
      value.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new TypeError('Invalid source file path');
  }
  return value;
}

function normaliseRelative(fromPath, specifier) {
  if (!specifier.startsWith('./') && !specifier.startsWith('../')) return null;
  const parts = fromPath.split('/').slice(0, -1);
  for (const part of specifier.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (parts.length === 0) return null;
      parts.pop();
    } else {
      parts.push(part);
    }
  }
  return parts.join('/');
}

function candidates(base) {
  const hasExtension = /\\.[a-z0-9]+$/i.test(base);
  const result = [base];
  if (!hasExtension) {
    for (const extension of SUPPORTED_EXTENSIONS) result.push(base + extension);
    for (const extension of SUPPORTED_EXTENSIONS) result.push(base + '/index' + extension);
  } else if (base.endsWith('.js')) {
    result.push(base.slice(0, -3) + '.ts', base.slice(0, -3) + '.tsx');
  } else if (base.endsWith('.jsx')) {
    result.push(base.slice(0, -4) + '.tsx');
  }
  return result;
}

function extractImports(source) {
  const imports = [];
  const patterns = [
    { kind: 'static', regex: /(?:^|[;\\n])\\s*import\\s+(?:[^'";\\n]*?\\s+from\\s+)?['"]([^'"]+)['"]/g },
    { kind: 're-export', regex: /(?:^|[;\\n])\\s*export\\s+[^'";\\n]*?\\s+from\\s+['"]([^'"]+)['"]/g },
    { kind: 'dynamic', regex: /\\bimport\\(\\s*['"]([^'"]+)['"]\\s*\\)/g },
    { kind: 'commonjs', regex: /\\brequire\\(\\s*['"]([^'"]+)['"]\\s*\\)/g },
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern.regex)) {
      imports.push({ specifier: match[1], kind: pattern.kind });
    }
  }
  return imports;
}

/**
 * Heuristic, read-only JavaScript/TypeScript import graph.
 * This function never evaluates or imports inspected source.
 */
export function analyzeJavaScriptModuleGraph(inputFiles) {
  if (!Array.isArray(inputFiles) || inputFiles.length > MAX_FILES) {
    throw new TypeError('Forge code intelligence file count must not exceed 1000');
  }

  const files = new Map();
  let totalBytes = 0;
  for (const item of inputFiles) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new TypeError('Invalid source file entry');
    }
    const path = validatePath(item.path);
    if (files.has(path)) throw new TypeError('Duplicate source file path');
    if (typeof item.content !== 'string') throw new TypeError('Invalid source file content');
    const bytes = new TextEncoder().encode(item.content).byteLength;
    if (bytes > MAX_FILE_BYTES) throw new TypeError('Source file size exceeds 512 KiB');
    totalBytes += bytes;
    if (totalBytes > MAX_TOTAL_BYTES) throw new TypeError('Source bundle size exceeds 8 MiB');
    files.set(path, item.content);
  }

  const sourcePaths = [...files.keys()].filter(path => SUPPORTED_EXTENSIONS.some(ext => path.endsWith(ext))).sort();
  const edges = [];
  const unresolved = [];
  const externalImports = [];

  for (const from of sourcePaths) {
    for (const imported of extractImports(files.get(from))) {
      const { specifier, kind } = imported;
      if (!specifier.startsWith('./') && !specifier.startsWith('../')) {
        if (!specifier.startsWith('/') && !specifier.includes(':')) {
          externalImports.push({ from, specifier, kind });
        }
        continue;
      }
      const base = normaliseRelative(from, specifier);
      if (!base) {
        unresolved.push({ from, specifier, kind, reason: 'path-escapes-source-root' });
        continue;
      }
      const target = candidates(base).find(candidate => files.has(candidate));
      if (!target) {
        unresolved.push({ from, specifier, kind, reason: 'target-not-in-supplied-source-set' });
        continue;
      }
      edges.push({ from, to: target, specifier, kind });
    }
  }

  edges.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to) || a.kind.localeCompare(b.kind));
  unresolved.sort((a, b) => a.from.localeCompare(b.from) || a.specifier.localeCompare(b.specifier));
  externalImports.sort((a, b) => a.from.localeCompare(b.from) || a.specifier.localeCompare(b.specifier));

  return {
    analysis: 'heuristic-static-import-graph',
    execution: 'none',
    nodes: sourcePaths.map(path => ({ path })),
    edges,
    unresolved,
    externalImports,
    limits: { maxFiles: MAX_FILES, maxFileBytes: MAX_FILE_BYTES, maxTotalBytes: MAX_TOTAL_BYTES },
  };
}
