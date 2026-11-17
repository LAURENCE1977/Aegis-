import { scoreEvaluationRun, validateEvaluationSuite } from './eval-forge.mjs';

const MAX_CANDIDATE_BYTES = 64 * 1024 * 1024;
const MAX_EVIDENCE_BYTES = 1024 * 1024;
const MAX_TOTAL_EVIDENCE_BYTES = 4 * 1024 * 1024;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

function requireBytes(value, label, maximum) {
  if (!(value instanceof Uint8Array) || value.byteLength < 1 || value.byteLength > maximum) {
    throw new TypeError('Invalid ' + label + ' bytes');
  }
  return value;
}

async function sha256Hex(bytes) {
  if (!globalThis.crypto?.subtle || typeof globalThis.crypto.subtle.digest !== 'function') {
    throw new Error('Web Crypto SHA-256 is unavailable');
  }
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Verifies the candidate artifact and every per-case evidence payload against
 * the digests declared by the run before allowing the deterministic scorer to
 * calculate a result. This verifies byte integrity, not runner identity or
 * execution honesty; callers must still obtain bytes from a trusted,
 * isolated runner and persist its authenticated receipt separately.
 */
export async function verifyEvaluationRunEvidence(suite, run, input) {
  validateEvaluationSuite(suite);
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).some(key => !['candidateBytes', 'evidenceByCase'].includes(key)) ||
      !Object.hasOwn(input, 'candidateBytes') || !Object.hasOwn(input, 'evidenceByCase')) {
    throw new TypeError('Invalid evaluation evidence verification input');
  }

  const candidateBytes = requireBytes(input.candidateBytes, 'candidate artifact', MAX_CANDIDATE_BYTES);
  if (!run || typeof run !== 'object' || typeof run.candidateDigest !== 'string' ||
      !SHA256_PATTERN.test(run.candidateDigest)) {
    throw new TypeError('Invalid candidate artifact digest');
  }
  const candidateDigest = await sha256Hex(candidateBytes);
  if (candidateDigest !== run.candidateDigest) {
    throw new TypeError('Candidate artifact digest does not match supplied bytes');
  }

  const evidenceByCase = input.evidenceByCase;
  if (!evidenceByCase || typeof evidenceByCase !== 'object' || Array.isArray(evidenceByCase) ||
      Object.getPrototypeOf(evidenceByCase) !== Object.prototype) {
    throw new TypeError('Invalid evaluation evidence collection');
  }
  const expectedIds = new Set(suite.cases.map(item => item.id));
  const suppliedIds = Object.keys(evidenceByCase);
  if (suppliedIds.length !== expectedIds.size ||
      suppliedIds.some(id => !expectedIds.has(id))) {
    throw new TypeError('Missing or unexpected evaluation evidence payload');
  }

  let totalEvidenceBytes = 0;
  for (const result of run.results ?? []) {
    const bytes = requireBytes(evidenceByCase[result.caseId], 'evaluation evidence', MAX_EVIDENCE_BYTES);
    totalEvidenceBytes += bytes.byteLength;
    if (totalEvidenceBytes > MAX_TOTAL_EVIDENCE_BYTES) {
      throw new TypeError('Evaluation evidence exceeds the total byte limit');
    }
    if (typeof result.evidenceDigest !== 'string' || !SHA256_PATTERN.test(result.evidenceDigest)) {
      throw new TypeError('Invalid evaluation evidence digest');
    }
    const actualDigest = await sha256Hex(bytes);
    if (actualDigest !== result.evidenceDigest) {
      throw new TypeError('Evaluation evidence digest does not match supplied bytes');
    }
  }

  const scored = scoreEvaluationRun(suite, run);
  return Object.freeze({ ...scored, evidenceVerified: true });
}
