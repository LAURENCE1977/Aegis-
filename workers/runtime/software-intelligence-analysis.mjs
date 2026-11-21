const REPOSITORY_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9](?:[A-Za-z0-9._-]{0,99})$/;
const SHA_PATTERN = /^[a-f0-9]{40}$/i;
const MAX_FILES = 20;
const MAX_FILE_BYTES = 32 * 1024;
const MAX_TOTAL_BYTES = 256 * 1024;
const ALLOWED_EXTENSIONS = new Set([
  '.md', '.txt', '.json', '.toml', '.yaml', '.yml', '.xml', '.gradle',
  '.mjs', '.cjs', '.js', '.jsx', '.ts', '.tsx', '.py', '.rs', '.go',
  '.java', '.cs', '.sh', '.sql',
]);
const DENIED_SEGMENTS = new Set([
  '.git', '.github', '.next', '.venv', 'node_modules', 'vendor',
  'dist', 'build', 'target', 'coverage',
]);
const SENSITIVE_NAME = /(?:^|[._-])(?:\.env|secret|credential|private[-_.]?key|id_rsa|id_ed25519)(?:$|[._-])/i;

const SIGNALS = [
  {
    id: 'agent-orchestration',
    terms: ['multi-agent', 'orchestrator', 'agent runtime', 'agent framework', 'workflow engine', 'task graph', 'planner'],
  },
  {
    id: 'mcp-integration',
    terms: ['@modelcontextprotocol', 'model context protocol', 'mcp server', 'tools/list', 'tools/call'],
  },
  {
    id: 'memory',
    terms: ['agent memory', 'vector store', 'embeddings', 'retrieval', 'bm25', 'memory store', 'knowledge graph'],
  },
  {
    id: 'observability',
    terms: ['opentelemetry', 'distributed tracing', 'telemetry', 'audit log', 'structured logging', 'metrics'],
  },
  {
    id: 'provider-routing',
    terms: ['openai-compatible', 'provider adapter', 'model router', 'ollama', 'vllm', 'litellm', 'inference provider'],
  },
  {
    id: 'security-isolation',
    terms: ['sandbox', 'isolation', 'seccomp', 'namespaces', 'capability-based', 'least privilege', 'policy enforcement', 'cedar'],
  },
  {
    id: 'testing',
    terms: ['node:test', 'vitest', 'jest', 'pytest', 'cargo test', 'playwright', 'test runner'],
  },
];

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function canonicalTimestamp(value) {
  if (typeof value !== 'string') throw new TypeError('Observation timestamp must be canonical UTC.');
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new TypeError('Observation timestamp must be canonical UTC.');
  }
  return value;
}

function validatePath(path) {
  if (typeof path !== 'string' || !path || path.length > 240 ||
      path.startsWith('/') || path.includes('\\') || path.includes('\0')) {
    throw new TypeError('Invalid source path.');
  }
  const segments = path.split('/');
  if (segments.some(segment => !segment || segment === '.' || segment === '..' ||
      segment.startsWith('.') || DENIED_SEGMENTS.has(segment.toLowerCase()))) {
    throw new TypeError('Source path is outside the inspection allowlist.');
  }
  const filename = segments.at(-1);
  if (SENSITIVE_NAME.test(filename) || /\.(?:pem|key|p12|pfx|crt|cer|der)$/i.test(filename)) {
    throw new TypeError('Sensitive source paths are not inspectable.');
  }
  const dot = filename.lastIndexOf('.');
  const extension = dot > 0 ? filename.slice(dot).toLowerCase() : '';
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new TypeError('Source path extension is not inspectable.');
  }
}

export function isSoftwareSourcePathAllowed(path) {
  try {
    validatePath(path);
    return true;
  } catch {
    return false;
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

/**
 * Derive conservative capability signals from source files already inspected
 * by AEGIS Forge. This function performs no I/O and never executes source.
 */
export function assessPinnedSoftwareSource({
  repository,
  treeSha,
  observedAt,
  files,
} = {}) {
  if (typeof repository !== 'string' || !REPOSITORY_PATTERN.test(repository) ||
      repository.includes('..') || repository.endsWith('.git')) {
    throw new TypeError('Repository must be a canonical owner/name identity.');
  }
  if (typeof treeSha !== 'string' || !SHA_PATTERN.test(treeSha)) {
    throw new TypeError('A full immutable tree SHA is required.');
  }
  canonicalTimestamp(observedAt);
  if (!Array.isArray(files) || files.length < 1 || files.length > MAX_FILES) {
    throw new TypeError('Source file count must be between 1 and 20.');
  }

  const paths = new Set();
  const blobs = new Set();
  let totalBytes = 0;
  const normalizedFiles = files.map(file => {
    if (!isRecord(file)) throw new TypeError('Source file must be an object.');
    validatePath(file.path);
    if (paths.has(file.path)) throw new TypeError('Duplicate source path.');
    paths.add(file.path);
    if (typeof file.sha !== 'string' || !SHA_PATTERN.test(file.sha)) {
      throw new TypeError('A full immutable blob SHA is required.');
    }
    const blobSha = file.sha.toLowerCase();
    if (blobs.has(blobSha)) throw new TypeError('Duplicate source blob reference.');
    blobs.add(blobSha);
    if (typeof file.content !== 'string') throw new TypeError('Source content must be UTF-8 text.');
    const actualBytes = new TextEncoder().encode(file.content).byteLength;
    if (!Number.isInteger(file.size) || file.size < 0 || file.size !== actualBytes ||
        actualBytes > MAX_FILE_BYTES) {
      throw new RangeError('Source file size does not match bounded UTF-8 content.');
    }
    totalBytes += actualBytes;
    if (totalBytes > MAX_TOTAL_BYTES) throw new RangeError('Aggregate source content exceeds the inspection limit.');
    return {
      path: file.path,
      sha: blobSha,
      content: file.content.toLowerCase(),
    };
  });

  const capabilities = [];
  for (const signal of SIGNALS) {
    const evidence = [];
    for (const file of normalizedFiles) {
      const matchedTerms = signal.terms.filter(term => file.content.includes(term)).slice(0, 8);
      if (matchedTerms.length) {
        evidence.push({
          path: file.path,
          blobSha: file.sha,
          matchedTerms,
        });
      }
    }
    if (evidence.length) {
      capabilities.push({
        id: signal.id,
        confidence: 'candidate_signal',
        evidence: evidence.sort((a, b) => a.path.localeCompare(b.path)),
      });
    }
  }

  capabilities.sort((a, b) => a.id.localeCompare(b.id));
  return deepFreeze({
    schemaVersion: 'aegis.software-capability-assessment.v1',
    source: {
      repository,
      treeSha: treeSha.toLowerCase(),
    },
    observedAt,
    sourceContentIsUntrusted: true,
    capabilities,
    readiness: 'unassessed',
    authority: {
      executeCode: false,
      installSoftware: false,
      changeConfiguration: false,
      sentinelApprovalRequired: true,
      execution: 'not_authorised',
    },
  });
}
