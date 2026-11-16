const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CAPABILITY_PATTERN = /^[a-z][a-z0-9-]{0,31}\.[a-z][a-z0-9-]{0,47}$/;
const SOURCE_TYPES = new Set(['repository', 'mcp', 'api', 'sdk', 'package', 'framework', 'application', 'document', 'research', 'benchmark']);
const DECISIONS = new Set(['unassessed', 'reuse', 'adapt', 'rebuild', 'combine', 'reject']);
const CANDIDATE_STATUSES = new Set(['discovered', 'inspected', 'assessed', 'approved', 'rejected', 'archived']);
const LICENCE_REVIEW = new Set(['verified', 'review-required', 'not-applicable']);
const KNOWLEDGE_TYPES = new Set(['research', 'practice', 'standard', 'benchmark', 'pattern', 'technique']);
const EVIDENCE_LEVELS = new Set(['high', 'medium', 'low', 'experimental']);
const KNOWLEDGE_STATUSES = new Set(['draft', 'reviewed', 'accepted', 'superseded']);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireText(value, label, maxLength = 500) {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) {
    throw new TypeError('Invalid ' + label);
  }
}

function requireSlug(value, label) {
  if (typeof value !== 'string' || value.length > 80 || !ID_PATTERN.test(value)) {
    throw new TypeError('Invalid ' + label);
  }
}

function requireHttpsUrl(value, label) {
  requireText(value, label, 2048);
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new TypeError('Invalid ' + label);
  }
  if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.username || parsed.password) {
    throw new TypeError('Invalid ' + label);
  }
}

function requireStringArray(value, label, { min = 0, max = 100, pattern } = {}) {
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    throw new TypeError('Invalid ' + label);
  }
  if (value.some((item) => typeof item !== 'string' || !item.trim() || item.length > 200 ||
      (pattern && !pattern.test(item)))) {
    throw new TypeError('Invalid ' + label);
  }
  if (new Set(value).size !== value.length) throw new TypeError('Duplicate ' + label);
}

export function validateCandidateRecord(record) {
  if (!isRecord(record)) throw new TypeError('Candidate record must be an object');
  requireSlug(record.id, 'candidate identifier');
  if (!SOURCE_TYPES.has(record.sourceType)) throw new TypeError('Invalid candidate source type');
  requireHttpsUrl(record.sourceUrl, 'candidate source URL');
  if (record.version !== undefined) requireText(record.version, 'candidate version', 128);

  if (!isRecord(record.licence)) throw new TypeError('Invalid candidate licence');
  requireText(record.licence.identifier, 'licence identifier', 100);
  if (!LICENCE_REVIEW.has(record.licence.review)) throw new TypeError('Invalid licence review status');

  if (!DECISIONS.has(record.decision)) throw new TypeError('Invalid candidate decision');
  if (['reuse', 'adapt', 'combine'].includes(record.decision) && record.licence.review !== 'verified') {
    throw new TypeError('A verified licence review is required before reuse, adaptation or combination');
  }
  if (!CANDIDATE_STATUSES.has(record.status)) throw new TypeError('Invalid candidate status');

  requireStringArray(record.capabilities, 'candidate capabilities', { max: 100, pattern: CAPABILITY_PATTERN });
  requireStringArray(record.dependencies, 'candidate dependencies');
  if (!Array.isArray(record.evidence) || record.evidence.length > 100) {
    throw new TypeError('Invalid candidate evidence');
  }
  for (const item of record.evidence) {
    if (!isRecord(item)) throw new TypeError('Invalid candidate evidence item');
    requireHttpsUrl(item.url, 'candidate evidence URL');
    requireText(item.note, 'candidate evidence note', 500);
  }
  return true;
}

export function validateKnowledgeRecord(record) {
  if (!isRecord(record)) throw new TypeError('Knowledge record must be an object');
  requireSlug(record.id, 'knowledge identifier');
  requireText(record.title, 'knowledge title', 200);
  requireSlug(record.domain, 'knowledge domain');
  if (!KNOWLEDGE_TYPES.has(record.knowledgeType)) throw new TypeError('Invalid knowledge type');
  requireText(record.summary, 'knowledge summary', 4000);
  if (!EVIDENCE_LEVELS.has(record.evidenceLevel)) throw new TypeError('Invalid evidence level');
  if (!KNOWLEDGE_STATUSES.has(record.status)) throw new TypeError('Invalid knowledge status');

  if (!Array.isArray(record.sources) || record.sources.length < 1 || record.sources.length > 20) {
    throw new TypeError('At least one attributable knowledge source is required');
  }
  for (const source of record.sources) {
    if (!isRecord(source)) throw new TypeError('Invalid knowledge source');
    requireHttpsUrl(source.url, 'knowledge source URL');
    requireText(source.title, 'knowledge source title', 300);
    requireText(source.attribution, 'knowledge source attribution', 300);
  }
  requireStringArray(record.limitations, 'knowledge limitations', { max: 50 });
  requireStringArray(record.applicableCapabilities, 'applicable capabilities', {
    max: 100,
    pattern: CAPABILITY_PATTERN,
  });
  return true;
}
