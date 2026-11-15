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

  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: 'GET',
      redirect: 'error',
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
  } catch {
    throw new GitHubSourceError('GitHub could not be reached safely. Try again later.', 502);
  }

  if (!response || !response.ok) {
    const status = response && Number.isInteger(response.status) ? response.status : 502;
    if (status === 404) {
      throw new GitHubSourceError('Repository not found or not publicly accessible.', 404);
    }
    if (status === 403 || status === 429) {
      throw new GitHubSourceError('GitHub rate limit or access policy prevented discovery.', 429);
    }
    throw new GitHubSourceError('GitHub repository discovery failed.', 502);
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new GitHubSourceError('GitHub returned an unreadable repository response.', 502);
  }

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
