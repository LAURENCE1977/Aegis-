const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/i;
const RESOURCE_CATEGORIES = new Set([
  'developer-tool', 'self-hosted-service', 'model', 'dataset',
  'learning-resource', 'api', 'framework', 'security-tool',
]);
const LICENCE_STATES = new Set(['verified', 'review-required', 'unknown', 'incompatible']);
const PRICING_MODELS = new Set(['free', 'free-tier', 'trial', 'paid', 'unknown']);
const HOSTING_MODES = new Set(['self-hosted', 'hosted', 'both', 'none']);
const DIFFICULTIES = new Set(['beginner', 'intermediate', 'advanced']);
const CONTENT_LICENCE_STATES = new Set(['link-only', 'permissive', 'restricted', 'unknown']);
const FINDING_SEVERITIES = new Set(['info', 'low', 'medium', 'high', 'critical']);
const FINDING_CONFIDENCE = new Set(['low', 'medium', 'high']);
const FINDING_STATUSES = new Set([
  'suspected', 'reproduced', 'verified', 'false-positive',
  'inconclusive', 'remediated', 'retested',
]);
const FINDING_METHODS = new Set([
  'static-analysis', 'dependency-audit', 'configuration-review', 'dynamic-test',
]);
const EVIDENCE_KINDS = new Set([
  'source-location', 'tool-output-digest', 'advisory-reference', 'test-case',
]);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, allowed, label) {
  if (!isRecord(value) || Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new TypeError('Invalid or unexpected ' + label + ' fields');
  }
}

function requireText(value, label, maxLength = 500) {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) {
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
  let url;
  try { url = new URL(value); } catch { throw new TypeError('Invalid ' + label); }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) {
    throw new TypeError('Invalid ' + label);
  }
}

function requireTimestamp(value, label) {
  requireText(value, label, 40);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) ||
      !Number.isFinite(Date.parse(value))) {
    throw new TypeError('Invalid ' + label + ' timestamp');
  }
}

function requireStringArray(value, label, { min = 0, max = 50, maxItemLength = 300 } = {}) {
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    throw new TypeError('Invalid ' + label);
  }
  for (const item of value) requireText(item, label + ' item', maxItemLength);
  if (new Set(value).size !== value.length) throw new TypeError('Duplicate ' + label);
}

export function validateResourceRecord(record) {
  exactKeys(record, [
    'id', 'name', 'canonicalUrl', 'category', 'sourceRevision',
    'licence', 'pricing', 'hosting', 'limitations',
  ], 'resource record');
  requireSlug(record.id, 'resource identifier');
  requireText(record.name, 'resource name', 200);
  requireHttpsUrl(record.canonicalUrl, 'resource canonical URL');
  if (!RESOURCE_CATEGORIES.has(record.category)) throw new TypeError('Invalid resource category');
  requireText(record.sourceRevision, 'resource source revision', 128);

  exactKeys(record.licence, ['identifier', 'review', 'evidenceUrl'], 'resource licence');
  requireText(record.licence.identifier, 'licence identifier', 100);
  if (!LICENCE_STATES.has(record.licence.review)) throw new TypeError('Invalid licence review state');
  if (record.licence.evidenceUrl !== null) {
    requireHttpsUrl(record.licence.evidenceUrl, 'licence evidence URL');
  }
  if (record.licence.review === 'verified' && !record.licence.evidenceUrl) {
    throw new TypeError('Verified licence requires HTTPS licence evidence');
  }

  exactKeys(record.pricing, ['model', 'limits', 'evidenceUrl', 'checkedAt'], 'resource pricing');
  if (!PRICING_MODELS.has(record.pricing.model)) throw new TypeError('Invalid resource pricing model');
  requireStringArray(record.pricing.limits, 'resource pricing limits', { max: 30, maxItemLength: 300 });
  requireHttpsUrl(record.pricing.evidenceUrl, 'pricing evidence URL');
  requireTimestamp(record.pricing.checkedAt, 'pricing checkedAt');
  if (['free-tier', 'trial'].includes(record.pricing.model) && record.pricing.limits.length === 0) {
    throw new TypeError('Free-tier and trial resources require explicit limits');
  }

  exactKeys(record.hosting, ['mode', 'requirements'], 'resource hosting');
  if (!HOSTING_MODES.has(record.hosting.mode)) throw new TypeError('Invalid hosting mode');
  requireStringArray(record.hosting.requirements, 'hosting requirements', { max: 30 });
  requireStringArray(record.limitations, 'resource limitations', { max: 30 });
  return true;
}

export function validateLearningGraph(nodes) {
  if (!Array.isArray(nodes) || nodes.length < 1 || nodes.length > 500) {
    throw new TypeError('Invalid learning graph size');
  }
  const byId = new Map();
  for (const node of nodes) {
    exactKeys(node, [
      'id', 'title', 'outcomes', 'prerequisites', 'difficulty',
      'sourceRefs', 'contentLicenseStatus',
    ], 'learning node');
    requireSlug(node.id, 'learning node identifier');
    if (byId.has(node.id)) throw new TypeError('Duplicate learning node identifier');
    requireText(node.title, 'learning node title', 200);
    requireStringArray(node.outcomes, 'learning outcomes', { min: 1, max: 20, maxItemLength: 300 });
    requireStringArray(node.prerequisites, 'learning prerequisites', { max: 50, maxItemLength: 80 });
    if (node.prerequisites.some((id) => !ID_PATTERN.test(id) || id === node.id)) {
      throw new TypeError('Invalid learning prerequisite');
    }
    if (!DIFFICULTIES.has(node.difficulty)) throw new TypeError('Invalid learning difficulty');
    if (!Array.isArray(node.sourceRefs) || node.sourceRefs.length < 1 || node.sourceRefs.length > 20) {
      throw new TypeError('Learning node requires attributable source URLs');
    }
    for (const source of node.sourceRefs) requireHttpsUrl(source, 'learning source URL');
    if (!CONTENT_LICENCE_STATES.has(node.contentLicenseStatus)) {
      throw new TypeError('Invalid learning content licence status');
    }
    byId.set(node.id, node);
  }

  for (const node of nodes) {
    for (const prerequisite of node.prerequisites) {
      if (!byId.has(prerequisite)) throw new TypeError('Missing learning prerequisite: ' + prerequisite);
    }
  }

  const visiting = new Set();
  const visited = new Set();
  function visit(id) {
    if (visiting.has(id)) throw new TypeError('Learning prerequisite cycle detected');
    if (visited.has(id)) return;
    visiting.add(id);
    for (const prerequisite of byId.get(id).prerequisites) visit(prerequisite);
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of byId.keys()) visit(id);
  return true;
}

function validateEvidenceReference(value) {
  requireText(value, 'security evidence reference', 2048);
  if (value.startsWith('https://')) {
    requireHttpsUrl(value, 'security evidence URL');
    return;
  }
  if (value.startsWith('/') || value.includes('\\') ||
      value.split('/').some((part) => part === '..' || part === '.' || !part)) {
    throw new TypeError('Invalid relative security evidence reference');
  }
}

export function validateSecurityFinding(finding) {
  exactKeys(finding, [
    'id', 'target', 'category', 'severity', 'confidence', 'status',
    'method', 'authorization', 'evidence', 'summary', 'remediation', 'observedAt',
  ], 'security finding');
  requireSlug(finding.id, 'security finding identifier');

  exactKeys(finding.target, ['ownerId', 'resourceId', 'scopeDigest'], 'security finding target');
  requireSlug(finding.target.ownerId, 'security finding owner');
  requireSlug(finding.target.resourceId, 'security finding resource');
  if (!DIGEST_PATTERN.test(finding.target.scopeDigest)) {
    throw new TypeError('Invalid target scope digest');
  }

  requireSlug(finding.category, 'security finding category');
  if (!FINDING_SEVERITIES.has(finding.severity)) throw new TypeError('Invalid finding severity');
  if (!FINDING_CONFIDENCE.has(finding.confidence)) throw new TypeError('Invalid finding confidence');
  if (!FINDING_STATUSES.has(finding.status)) throw new TypeError('Invalid finding status');
  if (!FINDING_METHODS.has(finding.method)) throw new TypeError('Invalid finding method');

  if (finding.authorization !== null) {
    exactKeys(finding.authorization, ['grantId', 'approvalId', 'scopeDigest'], 'security authorization');
    for (const field of ['grantId', 'approvalId']) {
      requireText(finding.authorization[field], 'security ' + field, 128);
      if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(finding.authorization[field])) {
        throw new TypeError('Invalid security ' + field);
      }
    }
    if (!DIGEST_PATTERN.test(finding.authorization.scopeDigest) ||
        finding.authorization.scopeDigest !== finding.target.scopeDigest) {
      throw new TypeError('Security authorization scope does not match target scope');
    }
  }
  if (finding.method === 'dynamic-test' && !finding.authorization) {
    throw new TypeError('Dynamic security testing requires Sentinel authorization lineage');
  }

  if (!Array.isArray(finding.evidence) || finding.evidence.length < 1 || finding.evidence.length > 20) {
    throw new TypeError('Security finding requires bounded evidence references');
  }
  for (const evidence of finding.evidence) {
    exactKeys(evidence, ['kind', 'reference', 'digest'], 'security evidence');
    if (!EVIDENCE_KINDS.has(evidence.kind)) throw new TypeError('Invalid security evidence kind');
    validateEvidenceReference(evidence.reference);
    if (!DIGEST_PATTERN.test(evidence.digest)) throw new TypeError('Invalid security evidence digest');
  }

  requireText(finding.summary, 'security finding summary', 1000);
  if (finding.remediation !== null) requireText(finding.remediation, 'security remediation', 1000);
  requireTimestamp(finding.observedAt, 'security finding observedAt');
  return true;
}
