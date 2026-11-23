const TASKS = new Set(['simple', 'chat', 'coding', 'research', 'reasoning']);
const KINDS = new Set(['api', 'mcp']);
const EFFECTS = new Set(['read', 'write', 'execute']);
const DEFAULT_MAX_EVIDENCE_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function validIso(value) {
  if (typeof value !== 'string') return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value;
}

function validateCandidate(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate) ||
      typeof candidate.id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(candidate.id) ||
      typeof candidate.name !== 'string' || !candidate.name.trim() || candidate.name.length > 120 ||
      !KINDS.has(candidate.kind) || !Array.isArray(candidate.tasks) ||
      candidate.tasks.some(task => !TASKS.has(task)) ||
      !Array.isArray(candidate.effects) || candidate.effects.some(effect => !EFFECTS.has(effect)) ||
      !Array.isArray(candidate.requiredScopes) || candidate.requiredScopes.some(scope => typeof scope !== 'string') ||
      !Array.isArray(candidate.grantedScopes) || candidate.grantedScopes.some(scope => typeof scope !== 'string')) {
    throw new TypeError('Invalid integration candidate metadata');
  }
}

function assess(candidate, request, nowMs, maxAgeMs) {
  const reasons = [];
  if (candidate.status !== 'ready') reasons.push('Integration is not admitted as ready');
  if (candidate.authStatus !== 'connected') reasons.push('Authentication is not confirmed active');
  if (candidate.securityStatus !== 'verified') reasons.push('Security review is not verified');
  if (!validIso(candidate.verifiedAt)) {
    reasons.push('Capability evidence has no valid verification timestamp');
  } else {
    const age = nowMs - Date.parse(candidate.verifiedAt);
    if (age < 0) reasons.push('Capability evidence is future-dated');
    else if (age > maxAgeMs) reasons.push('Capability evidence is stale');
  }
  if (!candidate.tasks.includes(request.task)) reasons.push('Required task capability is not declared');
  if (!candidate.effects.includes(request.effect)) reasons.push('Required action effect is not declared');
  if (!candidate.requiredScopes.every(scope => candidate.grantedScopes.includes(scope))) {
    reasons.push('One or more required scopes are not granted');
  }

  const eligible = reasons.length === 0;
  if (!eligible) return { eligible: false, score: null, reasons };

  const evidenceAge = nowMs - Date.parse(candidate.verifiedAt);
  const freshness = Math.max(0, 20 * (1 - evidenceAge / maxAgeMs));
  const metadata = Number.isFinite(candidate.costPer1kTokens) && candidate.costPer1kTokens >= 0 &&
    Number.isFinite(candidate.latencyMs) && candidate.latencyMs >= 0 ? 5 : 0;
  const score = Math.round(50 + freshness + 15 + 10 + metadata);
  return { eligible: true, score, reasons: [] };
}

/** Metadata-only ranker. It never probes, reads credentials, grants or executes. */
export function rankIntegrations({
  task,
  effect = 'read',
  candidates = [],
  now = new Date().toISOString(),
  maxEvidenceAgeMs = DEFAULT_MAX_EVIDENCE_AGE_MS,
} = {}) {
  if (!TASKS.has(task)) throw new TypeError('Unsupported integration task');
  if (!EFFECTS.has(effect)) throw new TypeError('Unsupported integration effect');
  if (!Array.isArray(candidates) || candidates.length > 200) {
    throw new TypeError('Invalid integration candidate list');
  }
  if (!validIso(now) || !Number.isSafeInteger(maxEvidenceAgeMs) || maxEvidenceAgeMs < 1) {
    throw new TypeError('Invalid integration assessment clock or evidence age');
  }
  const ids = new Set();
  for (const candidate of candidates) {
    validateCandidate(candidate);
    if (ids.has(candidate.id)) throw new TypeError('Duplicate integration candidate ID');
    ids.add(candidate.id);
  }

  const nowMs = Date.parse(now);
  const ranked = candidates.map(candidate => {
    const result = assess(candidate, { task, effect }, nowMs, maxEvidenceAgeMs);
    return {
      id: candidate.id,
      name: candidate.name,
      kind: candidate.kind,
      eligible: result.eligible,
      score: result.score,
      reasons: result.reasons,
      costPer1kTokens: Number.isFinite(candidate.costPer1kTokens) && candidate.costPer1kTokens >= 0
        ? candidate.costPer1kTokens : null,
      latencyMs: Number.isFinite(candidate.latencyMs) && candidate.latencyMs >= 0
        ? candidate.latencyMs : null,
    };
  });

  ranked.sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    if (a.score !== b.score) return (b.score ?? -1) - (a.score ?? -1);
    if (a.costPer1kTokens !== null && b.costPer1kTokens !== null &&
        a.costPer1kTokens !== b.costPer1kTokens) return a.costPer1kTokens - b.costPer1kTokens;
    if (a.latencyMs !== null && b.latencyMs !== null && a.latencyMs !== b.latencyMs) {
      return a.latencyMs - b.latencyMs;
    }
    return a.id.localeCompare(b.id);
  });

  return Object.freeze({
    task,
    effect,
    assessedAt: now,
    mode: 'metadata-only',
    executionPerformed: false,
    recommendations: Object.freeze(ranked.map((item, index) =>
      Object.freeze({ ...item, rank: index + 1 })
    )),
  });
}
