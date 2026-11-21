const MAX_FILES = 20;
const MAX_FILE_BYTES = 32 * 1024;
const MAX_TOTAL_BYTES = 256 * 1024;
const COMMIT_SHA = /^[a-f0-9]{40}$/i;
const OBJECT_SHA = /^[a-f0-9]{40,64}$/i;
const ALLOWED_EXTENSIONS = new Set([
  '.md', '.mdx', '.txt', '.json', '.yaml', '.yml', '.toml', '.js', '.mjs',
  '.cjs', '.ts', '.tsx', '.jsx', '.py', '.go', '.rs', '.java', '.kt',
  '.swift', '.html', '.css', '.sql', '.sh', '.rb', '.php', '.cs', '.cpp',
  '.h', '.hpp', '.xml', '.gradle', '.properties',
]);
const ALLOWED_FILENAMES = new Set([
  'readme', 'agents.md', 'license', 'license.md', 'copying',
  'contributing.md', 'security.md', 'code_of_conduct.md',
  'package.json', 'pyproject.toml', 'cargo.toml', 'go.mod',
  'wrangler.toml', 'dockerfile', 'makefile',
]);
const EXCLUDED_SEGMENTS = new Set([
  '.git', 'node_modules', 'vendor', 'dist', 'build', 'coverage',
  'target', '__pycache__',
]);

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function validateRepository(repository) {
  if (!repository || typeof repository !== 'object' || Array.isArray(repository) ||
      typeof repository.fullName !== 'string' ||
      typeof repository.sourceUrl !== 'string') {
    throw new TypeError('A canonical public GitHub repository identity is required.');
  }
  const match = /^([A-Za-z0-9_.-]{1,100})\/([A-Za-z0-9_.-]{1,100})$/.exec(repository.fullName);
  if (!match || match[1] === '.' || match[1] === '..' || match[2] === '.' || match[2] === '..' ||
      repository.sourceUrl !== 'https://github.com/' + repository.fullName) {
    throw new TypeError('Repository identity and canonical source URL must match.');
  }
  return {
    fullName: repository.fullName,
    sourceUrl: repository.sourceUrl,
    licenseSpdx: typeof repository.licenseSpdx === 'string' ? repository.licenseSpdx.slice(0, 64) : null,
  };
}

function validatePath(path) {
  if (typeof path !== 'string' || path.length < 1 || path.length > 240 ||
      path.startsWith('/') || path.includes('\\') || path.includes('%') ||
      path.includes(':') || path.includes('\0')) return false;
  const segments = path.split('/');
  if (segments.some(segment => !segment || segment === '.' || segment === '..' ||
      EXCLUDED_SEGMENTS.has(segment.toLowerCase()))) return false;
  const filename = segments.at(-1).toLowerCase();
  if (filename.endsWith('.min.js') || filename.endsWith('.map')) return false;
  const extension = filename.includes('.') ? filename.slice(filename.lastIndexOf('.')) : '';
  return ALLOWED_FILENAMES.has(filename) || ALLOWED_EXTENSIONS.has(extension);
}

function validateObservedAt(observedAt) {
  if (typeof observedAt !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(observedAt)) {
    throw new TypeError('A valid UTC observation timestamp is required.');
  }
  const timestamp = Date.parse(observedAt);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !==
      new Date(observedAt).toISOString()) {
    throw new TypeError('The observation timestamp is invalid.');
  }
  if (timestamp > Date.now()) throw new TypeError('Future observation timestamps are not accepted.');
  return new Date(timestamp).toISOString();
}

/**
 * Builds a deterministic, metadata-only record for explicitly selected source
 * files at one immutable Git commit. It never fetches, installs or executes code.
 */
export function createPinnedSourceInspection(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Pinned source inspection input is required.');
  }
  const allowedKeys = new Set(['repository', 'commitSha', 'observedAt', 'files']);
  if (Object.keys(input).some(key => !allowedKeys.has(key))) {
    throw new TypeError('Pinned source inspection contains unexpected fields.');
  }
  const repository = validateRepository(input.repository);
  if (typeof input.commitSha !== 'string' || !COMMIT_SHA.test(input.commitSha)) {
    throw new TypeError('A full immutable 40-character commit SHA is required.');
  }
  const observedAt = validateObservedAt(input.observedAt);
  if (!Array.isArray(input.files) || input.files.length > MAX_FILES) {
    throw new TypeError('Pinned source inspection exceeds the file count limit.');
  }

  const seenPaths = new Set();
  let totalBytes = 0;
  const files = input.files.map(file => {
    if (!file || typeof file !== 'object' || Array.isArray(file) ||
        Object.keys(file).some(key => !['path', 'sha', 'size'].includes(key)) ||
        !validatePath(file.path)) {
      throw new TypeError('A source file path is not on the inspection allowlist.');
    }
    if (seenPaths.has(file.path)) throw new TypeError('Duplicate source file paths are not accepted.');
    seenPaths.add(file.path);
    if (typeof file.sha !== 'string' || !OBJECT_SHA.test(file.sha)) {
      throw new TypeError('A valid immutable Git blob SHA is required for every source file.');
    }
    if (!Number.isSafeInteger(file.size) || file.size < 0 || file.size > MAX_FILE_BYTES) {
      throw new TypeError('Source file size exceeds the per-file inspection limit.');
    }
    totalBytes += file.size;
    if (totalBytes > MAX_TOTAL_BYTES) {
      throw new TypeError('Aggregate source file size exceeds the inspection limit.');
    }
    return { path: file.path, sha: file.sha.toLowerCase(), size: file.size };
  }).sort((a, b) => a.path.localeCompare(b.path));

  return deepFreeze({
    schema: 'aegis.pinned-source-inspection.v1',
    repository,
    commitSha: input.commitSha.toLowerCase(),
    observedAt,
    files,
    totalBytes,
    trust: {
      source: 'external',
      content: 'untrusted',
      instructions: 'never-follow',
    },
    restrictions: {
      fetchAdditionalContent: false,
      execute: false,
      install: false,
      build: false,
      network: false,
      configurationMutation: false,
    },
    sentinelApprovalRequired: true,
    execution: {
      authorised: false,
      install: false,
      execute: false,
      status: 'not-authorised',
    },
  });
}
