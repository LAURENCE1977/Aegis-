const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const TASK_TYPES = new Set(['simple', 'chat', 'coding', 'research', 'reasoning', 'security']);
const RESULT_STATUSES = new Set(['passed', 'failed', 'skipped']);
const MAX_CASES = 200;
const MAX_TOTAL_WEIGHT = 10000;
const MAX_DURATION_MS = 60 * 60 * 1000;

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireExactKeys(value, allowed, label) {
  if (!isRecord(value) || Object.keys(value).some(key => !allowed.has(key))) {
    throw new TypeError('Invalid ' + label + ' fields');
  }
}

function requireSlug(value, label) {
  if (typeof value !== 'string' || value.length > 80 || !SLUG_PATTERN.test(value)) {
    throw new TypeError('Invalid ' + label);
  }
}

function requireVersion(value, label) {
  if (typeof value !== 'string' || !SEMVER_PATTERN.test(value)) {
    throw new TypeError('Invalid ' + label + ' version');
  }
}

function requireDigest(value, label) {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) {
    throw new TypeError('Invalid ' + label + ' SHA-256 digest');
  }
}

function requireCanonicalTimestamp(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    throw new TypeError('Invalid ' + label + ' timestamp');
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) {
    throw new TypeError('Invalid ' + label + ' timestamp');
  }
}

export function validateEvaluationSuite(suite) {
  requireExactKeys(suite, new Set([
    'id', 'version', 'title', 'taskType', 'minimumScore', 'cases',
  ]), 'evaluation suite');
  requireSlug(suite.id, 'evaluation suite identifier');
  requireVersion(suite.version, 'evaluation suite');
  if (typeof suite.title !== 'string' || !suite.title.trim() || suite.title.length > 200) {
    throw new TypeError('Invalid evaluation suite title');
  }
  if (!TASK_TYPES.has(suite.taskType)) throw new TypeError('Invalid evaluation task type');
  if (!Number.isInteger(suite.minimumScore) || suite.minimumScore < 0 || suite.minimumScore > 100) {
    throw new TypeError('Invalid evaluation minimum score');
  }
  if (!Array.isArray(suite.cases) || suite.cases.length < 1 || suite.cases.length > MAX_CASES) {
    throw new TypeError('Invalid evaluation case collection');
  }

  const ids = new Set();
  let totalWeight = 0;
  for (const item of suite.cases) {
    requireExactKeys(item, new Set(['id', 'weight', 'required']), 'evaluation case');
    requireSlug(item.id, 'evaluation case identifier');
    if (ids.has(item.id)) throw new TypeError('Duplicate evaluation case identifier');
    if (!Number.isInteger(item.weight) || item.weight < 1 || item.weight > 1000) {
      throw new TypeError('Invalid evaluation case weight');
    }
    if (typeof item.required !== 'boolean') throw new TypeError('Invalid evaluation case requirement');
    ids.add(item.id);
    totalWeight += item.weight;
  }
  if (totalWeight > MAX_TOTAL_WEIGHT) throw new TypeError('Evaluation case weights exceed the suite limit');
  return true;
}

export function scoreEvaluationRun(suite, run) {
  validateEvaluationSuite(suite);
  requireExactKeys(run, new Set([
    'id', 'candidateId', 'candidateVersion', 'candidateDigest', 'completedAt', 'results',
  ]), 'evaluation run');
  requireSlug(run.id, 'evaluation run identifier');
  requireSlug(run.candidateId, 'evaluation candidate identifier');
  requireVersion(run.candidateVersion, 'candidate');
  requireDigest(run.candidateDigest, 'candidate artifact');
  requireCanonicalTimestamp(run.completedAt, 'evaluation completion');
  if (!Array.isArray(run.results) || run.results.length > MAX_CASES) {
    throw new TypeError('Invalid evaluation result collection');
  }

  const casesById = new Map(suite.cases.map(item => [item.id, item]));
  const seen = new Set();
  const resultsById = new Map();
  let passedWeight = 0;
  let totalWeight = 0;
  const requiredFailures = [];

  for (const result of run.results) {
    requireExactKeys(result, new Set(['caseId', 'status', 'evidenceDigest', 'durationMs']), 'evaluation result');
    requireSlug(result.caseId, 'evaluation result case identifier');
    if (seen.has(result.caseId)) throw new TypeError('Duplicate evaluation case result');
    const evaluationCase = casesById.get(result.caseId);
    if (!evaluationCase) throw new TypeError('Unknown evaluation case result');
    if (!RESULT_STATUSES.has(result.status)) throw new TypeError('Invalid evaluation result status');
    requireDigest(result.evidenceDigest, 'evaluation evidence');
    if (!Number.isSafeInteger(result.durationMs) || result.durationMs < 0 ||
        result.durationMs > MAX_DURATION_MS) {
      throw new TypeError('Invalid evaluation result duration');
    }

    seen.add(result.caseId);
    totalWeight += evaluationCase.weight;
    if (result.status === 'passed') passedWeight += evaluationCase.weight;
    if (evaluationCase.required && result.status !== 'passed') requiredFailures.push(result.caseId);
    resultsById.set(result.caseId, Object.freeze({
      caseId: result.caseId,
      status: result.status,
      evidenceDigest: result.evidenceDigest,
      durationMs: result.durationMs,
      weight: evaluationCase.weight,
      required: evaluationCase.required,
    }));
  }

  if (seen.size !== suite.cases.length) throw new TypeError('Missing evaluation case result');
  const scorePercent = Math.round((passedWeight / totalWeight) * 10000) / 100;
  const status = requiredFailures.length === 0 && scorePercent >= suite.minimumScore
    ? 'passed'
    : 'failed';
  const results = suite.cases.map(item => resultsById.get(item.id));

  return Object.freeze({
    id: run.id,
    suiteId: suite.id,
    suiteVersion: suite.version,
    candidateId: run.candidateId,
    candidateVersion: run.candidateVersion,
    candidateDigest: run.candidateDigest,
    completedAt: run.completedAt,
    status,
    scorePercent,
    passedWeight,
    totalWeight,
    requiredFailures: Object.freeze([...requiredFailures].sort()),
    results: Object.freeze(results),
  });
}
