const REPOSITORY_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9](?:[A-Za-z0-9._-]{0,99})$/;
const COMMIT_SHA_PATTERN = /^[a-f0-9]{40}$/i;
const SPDX_PATTERN = /^[A-Za-z0-9.+-]{1,80}$/;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_TOPICS = 50;
const STALE_AFTER_MS = 365 * 24 * 60 * 60 * 1000;

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function canonicalTimestamp(value, label) {
  if (typeof value !== 'string') throw new TypeError(label + ' must be a canonical UTC timestamp.');
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new TypeError(label + ' must be a canonical UTC timestamp.');
  }
  return parsed.getTime();
}

function normalizeMetadata(metadata, observedAtMs) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new TypeError('Repository metadata must be an object.');
  }
  if (typeof metadata.name !== 'string' || !metadata.name.trim() || metadata.name.length > 120) {
    throw new TypeError('Repository name must be 1–120 characters.');
  }
  if (metadata.description !== null && metadata.description !== undefined &&
      (typeof metadata.description !== 'string' || metadata.description.length > MAX_DESCRIPTION_LENGTH)) {
    throw new TypeError('Repository description must be at most 2000 characters.');
  }
  if (typeof metadata.archived !== 'boolean') {
    throw new TypeError('Repository archived state must be boolean.');
  }
  if (metadata.licenseSpdx !== null && metadata.licenseSpdx !== undefined &&
      (typeof metadata.licenseSpdx !== 'string' || !SPDX_PATTERN.test(metadata.licenseSpdx))) {
    throw new TypeError('Repository SPDX licence identifier is invalid.');
  }

  const updatedAtMs = canonicalTimestamp(metadata.updatedAt, 'Repository updatedAt');
  if (updatedAtMs > observedAtMs) {
    throw new RangeError('Repository updatedAt cannot be in the future.');
  }

  const topics = metadata.topics === undefined ? [] : metadata.topics;
  if (!Array.isArray(topics) || topics.length > MAX_TOPICS ||
      topics.some((topic) => typeof topic !== 'string' || !/^[a-z0-9][a-z0-9-]{0,49}$/i.test(topic))) {
    throw new TypeError('Repository topics must contain at most 50 bounded topic identifiers.');
  }

  return {
    name: metadata.name.trim(),
    description: metadata.description?.trim() || null,
    licenseSpdx: metadata.licenseSpdx || null,
    archived: metadata.archived,
    updatedAt: new Date(updatedAtMs).toISOString(),
    topics: [...new Set(topics.map((topic) => topic.toLowerCase()))].sort(),
  };
}

/**
 * Create a passive, pinned observation of a public GitHub repository.
 *
 * This function deliberately does not fetch source code, execute software,
 * install dependencies, follow repository-provided URLs, or infer trust.
 * Inputs originate outside AEGIS and are treated as untrusted metadata.
 */
export function createSoftwareIntelligenceAssessment({
  repository,
  commitSha,
  observedAt,
  metadata,
} = {}) {
  if (typeof repository !== 'string' || !REPOSITORY_PATTERN.test(repository) ||
      repository.includes('..') || repository.endsWith('.git')) {
    throw new TypeError('Repository must be a canonical GitHub owner/name identity.');
  }
  if (typeof commitSha !== 'string' || !COMMIT_SHA_PATTERN.test(commitSha)) {
    throw new TypeError('A full 40-character commit SHA is required to pin the source.');
  }

  const observedAtMs = canonicalTimestamp(observedAt, 'Observation timestamp');
  const normalizedMetadata = normalizeMetadata(metadata, observedAtMs);
  const reviewSignals = [];

  if (normalizedMetadata.archived) reviewSignals.push('archived_repository');
  if (!normalizedMetadata.licenseSpdx) reviewSignals.push('missing_license');
  if (observedAtMs - Date.parse(normalizedMetadata.updatedAt) > STALE_AFTER_MS) {
    reviewSignals.push('stale_repository');
  }

  return deepFreeze({
    schemaVersion: 'aegis.software-intelligence-assessment.v1',
    source: {
      type: 'github_repository',
      repository,
      commitSha: commitSha.toLowerCase(),
      url: 'https://github.com/' + repository,
    },
    observedAt: new Date(observedAtMs).toISOString(),
    metadata: normalizedMetadata,
    reviewSignals,
    readiness: 'unassessed',
    authority: {
      sourceContentIsUntrusted: true,
      fetchAdditionalContent: false,
      executeCode: false,
      installSoftware: false,
      changeConfiguration: false,
      sentinelApprovalRequired: true,
      execution: 'not_authorised',
    },
  });
}
