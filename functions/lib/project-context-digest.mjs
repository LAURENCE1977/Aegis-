import { digestCanonicalInput } from './canonical-input.mjs';

// The generation clock is presentation metadata, not part of the content identity.
// Excluding it keeps idempotent retries stable while any real project/memory change
// still produces a different digest.
export async function digestProjectBrief(brief) {
  if (!brief || typeof brief !== 'object' || Array.isArray(brief)) {
    throw new TypeError('Project brief is required');
  }
  const { generatedAt, ...stableBrief } = brief;
  return digestCanonicalInput(stableBrief);
}
