import { validateLearningGraph } from './guardian-intelligence.mjs';

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VERSION_PATTERN = /^(0|[1-9][0-9]*)[.](0|[1-9][0-9]*)[.](0|[1-9][0-9]*)$/;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const POLICY_VERSION = '1.0.0';
const MAX_EVIDENCE = 100;

function exactObject(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some(key => !keys.includes(key)) ||
      !keys.every(key => Object.hasOwn(value, key))) {
    throw new TypeError('Invalid Learning Mastery ' + label + ' fields');
  }
}
function validId(value, label) {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    throw new TypeError('Invalid Learning Mastery ' + label);
  }
}
function validVersion(value, label) {
  if (typeof value !== 'string' || !VERSION_PATTERN.test(value)) {
    throw new TypeError('Invalid Learning Mastery ' + label);
  }
}
function validTimestamp(value, label, now) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) ||
      !Number.isFinite(Date.parse(value)) || new Date(Date.parse(value)).toISOString() !== value) {
    throw new TypeError('Invalid Learning Mastery ' + label + ' timestamp');
  }
  if (Date.parse(value) > now) throw new TypeError('Learning Mastery evidence cannot be future dated');
  return Date.parse(value);
}

function validateEvidence(item, path, nodeId, now) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    throw new TypeError('Invalid Learning Mastery evidence record');
  }
  const common = ['id', 'kind', 'pathId', 'pathVersion', 'nodeId', 'occurredAt'];
  const fields = item.kind === 'assessment_pass'
    ? [...common, 'assessmentId', 'assessmentVersion', 'attemptId', 'passed', 'masteryVerified']
    : item.kind === 'applied_task'
      ? [...common, 'artifactDigest']
      : item.kind === 'human_review'
        ? [...common, 'reviewerId', 'decision', 'evidenceRefs']
        : null;
  if (!fields) throw new TypeError('Unsupported Learning Mastery evidence kind');
  exactObject(item, fields, 'evidence');
  validId(item.id, 'evidence identifier');
  validId(item.pathId, 'path identifier');
  validVersion(item.pathVersion, 'path version');
  validId(item.nodeId, 'node identifier');
  const occurredAt = validTimestamp(item.occurredAt, item.kind, now);
  if (item.pathId !== path.id || item.pathVersion !== path.version || item.nodeId !== nodeId) {
    throw new TypeError('Learning Mastery evidence must match the exact path version and node');
  }
  if (item.kind === 'assessment_pass') {
    validId(item.assessmentId, 'assessment identifier');
    validVersion(item.assessmentVersion, 'assessment version');
    validId(item.attemptId, 'attempt identifier');
    if (typeof item.passed !== 'boolean' || item.masteryVerified !== false) {
      throw new TypeError('Learning Mastery assessment evidence must be a server-scored non-mastery result');
    }
  } else if (item.kind === 'applied_task') {
    if (typeof item.artifactDigest !== 'string' || !DIGEST_PATTERN.test(item.artifactDigest)) {
      throw new TypeError('Learning Mastery applied-task evidence requires a SHA-256 artifact digest');
    }
  } else {
    validId(item.reviewerId, 'human reviewer identifier');
    if (item.decision !== 'approved' || !Array.isArray(item.evidenceRefs) ||
        item.evidenceRefs.length < 1 || item.evidenceRefs.length > MAX_EVIDENCE ||
        item.evidenceRefs.some(id => typeof id !== 'string' || !ID_PATTERN.test(id)) ||
        new Set(item.evidenceRefs).size !== item.evidenceRefs.length) {
      throw new TypeError('Learning Mastery human review must approve and reference its evidence');
    }
  }
  return { item, occurredAt };
}

/**
 * Produces a review candidate only. Evidence provenance must be authenticated by
 * the caller against the immutable Learning Forge stores before this policy runs.
 * This function never certifies mastery or grants a capability.
 */
export function buildLearningMasteryCandidate(path, nodeId, evidence, now = Date.now()) {
  if (!path || typeof path !== 'object' || Array.isArray(path)) {
    throw new TypeError('Invalid Learning Mastery path');
  }
  validId(path.id, 'path identifier');
  validVersion(path.version, 'path version');
  validateLearningGraph(path.nodes);
  validId(nodeId, 'node identifier');
  if (!path.nodes.some(node => node.id === nodeId)) {
    throw new TypeError('Learning Mastery node is not in the exact path version');
  }
  if (!Number.isFinite(now)) throw new TypeError('Invalid Learning Mastery clock');
  if (!Array.isArray(evidence) || evidence.length > MAX_EVIDENCE) {
    throw new TypeError('Learning Mastery evidence must contain at most 100 records');
  }

  const validated = evidence.map(item => validateEvidence(item, path, nodeId, now));
  const ids = new Set();
  for (const { item } of validated) {
    if (ids.has(item.id)) throw new TypeError('Duplicate Learning Mastery evidence identifier');
    ids.add(item.id);
  }

  const assessments = validated.filter(({ item }) => item.kind === 'assessment_pass' && item.passed);
  const attempts = new Set(assessments.map(({ item }) => item.attemptId));
  const assessmentDays = new Set(assessments.map(({ item }) => item.occurredAt.slice(0, 10)));
  const applications = validated.filter(({ item }) => item.kind === 'applied_task');
  const reviews = validated.filter(({ item }) => item.kind === 'human_review');

  const requiredIds = new Set([
    ...assessments.map(({ item }) => item.id),
    ...applications.map(({ item }) => item.id),
  ]);
  const qualifyingReview = reviews.find(({ item }) =>
    requiredIds.size >= 3 &&
    item.evidenceRefs.length === requiredIds.size &&
    item.evidenceRefs.every(id => requiredIds.has(id)) &&
    [...requiredIds].every(id => item.evidenceRefs.includes(id))
  );

  if (attempts.size < 2 || assessmentDays.size < 2 || applications.length < 1 || !qualifyingReview) {
    return Object.freeze({
      status: 'insufficient_evidence',
      policyVersion: POLICY_VERSION,
      pathId: path.id,
      pathVersion: path.version,
      nodeId,
      masteryVerified: false,
      missing: Object.freeze([
        ...(attempts.size < 2 ? ['two_distinct_passed_attempts'] : []),
        ...(assessmentDays.size < 2 ? ['assessment_repetition_on_separate_utc_dates'] : []),
        ...(applications.length < 1 ? ['applied_task_evidence'] : []),
        ...(!qualifyingReview ? ['independent_human_review_of_all_evidence'] : []),
      ]),
    });
  }

  const selected = [
    ...assessments,
    ...applications,
    qualifyingReview,
  ].sort((a, b) => a.occurredAt - b.occurredAt || a.item.id.localeCompare(b.item.id));

  return Object.freeze({
    status: 'candidate_for_human_confirmation',
    policyVersion: POLICY_VERSION,
    pathId: path.id,
    pathVersion: path.version,
    nodeId,
    evidenceIds: Object.freeze(selected.map(({ item }) => item.id)),
    reviewerId: qualifyingReview.item.reviewerId,
    masteryVerified: false,
  });
}
