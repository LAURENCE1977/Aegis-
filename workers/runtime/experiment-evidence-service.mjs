import { getExperimentRecord } from './experiment-record-store.mjs';
import { readExperimentEvidenceArtifact } from './experiment-evidence-source.mjs';
import { verifyExperimentEvidenceArtifact } from './experiment-evidence-verifier.mjs';

function validateEvidenceRef(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 500 ||
      /[\u0000-\u001f\u007f]/.test(value)) {
    throw new TypeError('Evidence reference must be bounded safe text.');
  }
}

/**
 * Resolve and verify one evidence artifact using only owner-scoped stored data.
 *
 * principalId must be derived from the authenticated server session. The
 * experiment record and manifest entry are loaded from the digest-verifying
 * D1 store; callers cannot supply a replacement manifest or object key.
 *
 * The result never includes artifact bytes. Missing source objects are
 * reported distinctly; corrupt metadata or digest mismatches throw so an API
 * boundary can fail closed with a sanitized response.
 */
export async function getVerifiedExperimentEvidenceArtifact({
  db,
  bucket,
  principalId,
  recordId,
  ref,
  now = new Date().toISOString(),
  maxBytes,
} = {}) {
  validateEvidenceRef(ref);

  const record = await getExperimentRecord(db, principalId, recordId);
  if (!record) return Object.freeze({ status: 'record_not_found' });

  const expectedEvidence = record.evidence.find((entry) => entry.ref === ref);
  if (!expectedEvidence) return Object.freeze({ status: 'evidence_not_found' });

  const artifact = await readExperimentEvidenceArtifact({
    bucket,
    ownerId: principalId,
    recordId: record.id,
    expectedEvidence,
    ...(maxBytes === undefined ? {} : { maxBytes }),
  });
  if (!artifact) {
    return Object.freeze({
      status: 'artifact_missing',
      recordId: record.id,
      ref: expectedEvidence.ref,
      kind: expectedEvidence.kind,
      sha256: expectedEvidence.sha256,
    });
  }

  const attestation = await verifyExperimentEvidenceArtifact({
    ownerId: principalId,
    recordId: record.id,
    artifact,
    expectedEvidence,
    now,
    ...(maxBytes === undefined ? {} : { maxBytes }),
  });

  return Object.freeze({
    status: 'verified',
    attestation,
  });
}
