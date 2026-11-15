const REPOSITORY_SEGMENT = /^[A-Za-z0-9_.-]{1,100}$/;

export class GitHubSourceError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = 'GitHubSourceError';
    this.status = status;
  }
}

export function parseGitHubRepositoryUrl(sourceUrl) {
  if (typeof sourceUrl !== 'string' || sourceUrl.length > 2048) {
    throw new TypeError('A valid GitHub repository URL is required.');
  }

  let parsed;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    throw new TypeError('A valid GitHub repository URL is required.');
  }

  if (parsed.protocol !== 'https:' || parsed.hostname.toLowerCase() !== 'github.com' ||
      parsed.port || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new TypeError('Only canonical HTTPS GitHub repository URLs are supported.');
  }

  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments.length !== 2) {
    throw new TypeError('Provide a repository URL, not a file, issue or subpage URL.');
  }

  let owner;
  let repository;
  try {
    owner = decodeURIComponent(segments[0]);
    repository = decodeURIComponent(segments[1]).replace(/\.git$/i, '');
  } catch {
    throw new TypeError('The GitHub repository URL contains invalid encoding.');
  }

  if (!REPOSITORY_SEGMENT.test(owner) || !REPOSITORY_SEGMENT.test(repository) ||
      owner === '.' || owner === '..' || repository === '.' || repository === '..') {
    throw new TypeError('The GitHub repository URL contains an invalid owner or repository name.');
  }

  return { owner, repository, canonicalUrl: 'https://github.com/' + owner + '/' + repository };
}

export async function discoverGitHubRepository(sourceUrl, fetchImpl = fetch) {
  const parsed = parseGitHubRepositoryUrl(sourceUrl);
  const endpoint = 'https://api.github.com/repos/' +
    encodeURIComponent(parsed.owner) + '/' + encodeURIComponent(parsed.repository);

  const data = await githubJson(endpoint, fetchImpl);
  if (!data || typeof data !== 'object' || Array.isArray(data) ||
      typeof data.full_name !== 'string' || typeof data.html_url !== 'string' ||
      typeof data.default_branch !== 'string' || typeof data.private !== 'boolean') {
    throw new GitHubSourceError('GitHub returned incomplete repository metadata.', 502);
  }
  if (data.private) {
    throw new GitHubSourceError('Only public repositories can be discovered without an authorised private connection.', 403);
  }

  return {
    sourceType: 'repository',
    sourceUrl: parsed.canonicalUrl,
    fullName: data.full_name,
    description: typeof data.description === 'string' ? data.description.slice(0, 1000) : null,
    defaultBranch: data.default_branch,
    archived: Boolean(data.archived),
    fork: Boolean(data.fork),
    private: false,
    lastPushedAt: typeof data.pushed_at === 'string' ? data.pushed_at : null,
    stars: Number.isSafeInteger(data.stargazers_count) ? data.stargazers_count : null,
    primaryLanguage: typeof data.language === 'string' ? data.language : null,
    licenseSpdx: data.license && typeof data.license.spdx_id === 'string' ? data.license.spdx_id : null,
    licenseName: data.license && typeof data.license.name === 'string' ? data.license.name : null,
  };
}


const INSPECTABLE_EXTENSIONS = new Set([
  '.md','.mdx','.txt','.json','.yaml','.yml','.toml','.js','.mjs','.cjs',
  '.ts','.tsx','.jsx','.py','.go','.rs','.java','.kt','.swift','.html',
  '.css','.sql','.sh','.rb','.php','.cs','.cpp','.h','.hpp','.xml',
  '.gradle','.properties',
]);
const IMPORTANT_FILENAMES = new Set([
  'readme','agents.md','license','license.md','copying','contributing.md',
  'security.md','code_of_conduct.md','package.json','pyproject.toml',
  'cargo.toml','go.mod','wrangler.toml','dockerfile','makefile',
]);
const MAX_SOURCE_FILE_BYTES = 32 * 1024;
const MAX_SOURCE_FILES = 100;

function apiHeaders() {
  return {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

const MAX_GITHUB_JSON_BYTES = 1024 * 1024;
const GITHUB_REQUEST_TIMEOUT_MS = 8000;

async function readBoundedResponseText(response, maxBytes = MAX_GITHUB_JSON_BYTES) {
  if (!response?.body || typeof response.body.getReader !== 'function') {
    // Lightweight test doubles and non-streaming fetch implementations may expose
    // only json(). Serialize their parsed value before accepting it so the same
    // byte ceiling still applies to the normalized representation.
    if (typeof response.text !== 'function' && typeof response.json === 'function') {
      let value;
      try { value = await response.json(); }
      catch { throw new GitHubSourceError('GitHub returned unreadable source metadata.', 502); }
      const serialized = JSON.stringify(value);
      if (new TextEncoder().encode(serialized).byteLength > maxBytes) {
        throw new GitHubSourceError('GitHub response is too large to inspect safely.', 413);
      }
      return serialized;
    }
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes) {
      throw new GitHubSourceError('GitHub response is too large to inspect safely.', 413);
    }
    return text;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new GitHubSourceError('GitHub response is too large to inspect safely.', 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw new GitHubSourceError('GitHub returned invalid response text.', 502); }
}

async function githubJson(url, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(url, {
      method: 'GET',
      redirect: 'error',
      signal: AbortSignal.timeout(GITHUB_REQUEST_TIMEOUT_MS),
      headers: apiHeaders(),
    });
  } catch {
    throw new GitHubSourceError('GitHub could not be reached safely. Try again later.', 502);
  }
  if (!response || !response.ok) {
    const status = response && Number.isInteger(response.status) ? response.status : 502;
    if (status === 404) throw new GitHubSourceError('Repository source object was not found.', 404);
    if (status === 403 || status === 429) throw new GitHubSourceError('GitHub rate limit or access policy prevented source inspection.', 429);
    throw new GitHubSourceError('GitHub source inspection failed.', 502);
  }
  const raw = await readBoundedResponseText(response);
  try { return JSON.parse(raw); }
  catch { throw new GitHubSourceError('GitHub returned unreadable source metadata.', 502); }
}

function isInspectableTreeEntry(entry) {
  if (!entry || entry.type !== 'blob' || typeof entry.path !== 'string' ||
      !Number.isSafeInteger(entry.size) || entry.size < 0 || entry.size > MAX_SOURCE_FILE_BYTES ||
      typeof entry.sha !== 'string' || !/^[a-f0-9]{40,64}$/i.test(entry.sha)) return false;
  const segments = entry.path.split('/');
  if (segments.some(segment => !segment || segment === '.' || segment === '..' ||
      ['node_modules','vendor','dist','build','coverage','target','__pycache__','.git'].includes(segment.toLowerCase()))) return false;
  const filename = segments.at(-1).toLowerCase();
  if (filename.endsWith('.min.js') || filename.endsWith('.map')) return false;
  const extension = filename.includes('.') ? filename.slice(filename.lastIndexOf('.')) : '';
  return IMPORTANT_FILENAMES.has(filename) || INSPECTABLE_EXTENSIONS.has(extension);
}

export async function inspectGitHubRepository(sourceUrl, fetchImpl = fetch) {
  const parsed = parseGitHubRepositoryUrl(sourceUrl);
  const repository = await discoverGitHubRepository(sourceUrl, fetchImpl);
  const endpoint = 'https://api.github.com/repos/' +
    encodeURIComponent(parsed.owner) + '/' + encodeURIComponent(parsed.repository) +
    '/git/trees/' + encodeURIComponent(repository.defaultBranch) + '?recursive=1';
  const data = await githubJson(endpoint, fetchImpl);
  if (!data || typeof data !== 'object' || !Array.isArray(data.tree) ||
      typeof data.sha !== 'string' || !/^[a-f0-9]{40,64}$/i.test(data.sha)) {
    throw new GitHubSourceError('GitHub returned an invalid repository tree.', 502);
  }
  const inspectable = data.tree.filter(isInspectableTreeEntry).sort((a, b) => a.path.localeCompare(b.path));
  const files = inspectable.slice(0, MAX_SOURCE_FILES).map(entry => ({
    path: entry.path,
    sha: entry.sha,
    size: entry.size,
  }));
  return {
    ...repository,
    treeSha: data.sha,
    truncated: Boolean(data.truncated) || inspectable.length > MAX_SOURCE_FILES,
    files,
  };
}

export async function readGitHubBlob(sourceUrl, blobSha, fetchImpl = fetch) {
  const parsed = parseGitHubRepositoryUrl(sourceUrl);
  if (typeof blobSha !== 'string' || !/^[a-f0-9]{40,64}$/i.test(blobSha)) {
    throw new TypeError('A pinned Git blob SHA is required.');
  }
  const endpoint = 'https://api.github.com/repos/' +
    encodeURIComponent(parsed.owner) + '/' + encodeURIComponent(parsed.repository) +
    '/git/blobs/' + encodeURIComponent(blobSha);
  const data = await githubJson(endpoint, fetchImpl);
  if (!data || typeof data !== 'object' || data.sha?.toLowerCase() !== blobSha.toLowerCase() ||
      data.encoding !== 'base64' || !Number.isSafeInteger(data.size) ||
      data.size < 0 || data.size > MAX_SOURCE_FILE_BYTES || typeof data.content !== 'string') {
    throw new GitHubSourceError('Source blob size is invalid or exceeds the 32 KiB inspection limit.', 413);
  }
  let binary;
  try { binary = atob(data.content.replace(/\\s+/g, '')); }
  catch { throw new GitHubSourceError('GitHub returned an invalid base64 source blob.', 502); }
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  if (bytes.byteLength !== data.size || bytes.byteLength > MAX_SOURCE_FILE_BYTES) {
    throw new GitHubSourceError('Source blob size does not match its metadata.', 502);
  }
  let content;
  try { content = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw new GitHubSourceError('Binary or non-UTF-8 source files are not supported by text inspection.', 415); }
  return {
    sourceUrl: parsed.canonicalUrl,
    sha: data.sha,
    size: data.size,
    content,
  };
}
