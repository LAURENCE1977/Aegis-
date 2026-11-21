import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { verifyExperimentEvidenceArtifact } from '../workers/runtime/experiment-evidence-verifier.mjs';

const bytes = new TextEncoder().encode('{"result":"synthetic evidence"}');
const digest = 'sha256:' + createHash('sha256').update(bytes).digest('hex');
const expectedEvidence = {
  ref: 'evidence:run-1',
  kind: 'criterion',
  sha256: digest,
  capturedAt: '2026-11-21T10:00:00.000Z',
};
const artifact = {
  ownerId: 'owner',
  recordId: 'record-1',
  ref: expectedEvidence.ref,
  kind: expectedEvidence.kind,
  capturedAt: expectedEvidence.capturedAt,
  mediaType: 'application/json',
  bytes,
};
const options = {
  ownerId: 'owner',
  recordId: 'record-1',
  artifact,
  expectedEvidence,
  now: '2026-11-21T10:05:00.000Z',
};

test('verifies actual artifact bytes and returns a metadata-only attestation', async () => {
  const result = await verifyExperimentEvidenceArtifact(options);

  assert.equal(result.schemaVersion, 'aegis.verified-evidence-artifact.v1');
  assert.equal(result.ownerId, 'owner');
  assert.equal(result.recordId, 'record-1');
  assert.equal(result.ref, expectedEvidence.ref);
  assert.equal(result.kind, 'criterion');
  assert.equal(result.sha256, digest);
  assert.equal(result.byteLength, bytes.byteLength);
  assert.equal(result.mediaType, 'application/json');
  assert.equal(result.verification, 'verified');
  assert.equal(result.verifiedAt, options.now);
  assert.equal('bytes' in result, false);
  assert.equal(Object.isFrozen(result), true);
});

test('rejects bytes whose calculated digest differs from the immutable record manifest', async () => {
  await assert.rejects(
    () => verifyExperimentEvidenceArtifact({
      ...options,
      artifact: { ...artifact, bytes: new TextEncoder().encode('altered evidence') },
    }),
    /digest mismatch/i,
  );
});

test('binds evidence to the authenticated owner and exact source record', async () => {
  await assert.rejects(
    () => verifyExperimentEvidenceArtifact({ ...options, ownerId: 'another-owner' }),
    /owner/i,
  );
  await assert.rejects(
    () => verifyExperimentEvidenceArtifact({
      ...options,
      artifact: { ...artifact, recordId: 'record-2' },
    }),
    /record/i,
  );
});

test('rejects a reference, kind or capture-time mismatch', async () => {
  await assert.rejects(
    () => verifyExperimentEvidenceArtifact({
      ...options,
      artifact: { ...artifact, ref: 'evidence:other' },
    }),
    /reference/i,
  );
  await assert.rejects(
    () => verifyExperimentEvidenceArtifact({
      ...options,
      artifact: { ...artifact, kind: 'runtime' },
    }),
    /kind/i,
  );
  await assert.rejects(
    () => verifyExperimentEvidenceArtifact({
      ...options,
      artifact: { ...artifact, capturedAt: '2026-11-21T10:01:00.000Z' },
    }),
    /capture time/i,
  );
});

test('rejects malformed, future-dated and unsupported evidence metadata', async () => {
  await assert.rejects(
    () => verifyExperimentEvidenceArtifact({ ...options, now: 'not-a-time' }),
    /verification time/i,
  );
  await assert.rejects(
    () => verifyExperimentEvidenceArtifact({
      ...options,
      artifact: { ...artifact, capturedAt: '2026-11-21T10:06:00.000Z' },
    }),
    /future/i,
  );
  await assert.rejects(
    () => verifyExperimentEvidenceArtifact({
      ...options,
      artifact: { ...artifact, mediaType: 'text/html' },
    }),
    /media type/i,
  );
  await assert.rejects(
    () => verifyExperimentEvidenceArtifact({
      ...options,
      artifact: { ...artifact, sha256: digest },
    }),
    /unexpected/i,
  );
});

test('rejects non-byte payloads and artifacts above the configured byte limit', async () => {
  await assert.rejects(
    () => verifyExperimentEvidenceArtifact({
      ...options,
      artifact: { ...artifact, bytes: 'not bytes' },
    }),
    /byte array/i,
  );
  await assert.rejects(
    () => verifyExperimentEvidenceArtifact({
      ...options,
      artifact: { ...artifact, bytes: new Uint8Array(16) },
      maxBytes: 8,
    }),
    /size limit/i,
  );
});

test('rejects an invalid or mismatched expected manifest entry', async () => {
  await assert.rejects(
    () => verifyExperimentEvidenceArtifact({
      ...options,
      expectedEvidence: { ...expectedEvidence, sha256: 'not-a-digest' },
    }),
    /SHA-256/i,
  );
  await assert.rejects(
    () => verifyExperimentEvidenceArtifact({
      ...options,
      expectedEvidence: { ...expectedEvidence, ref: 'evidence:other' },
    }),
    /reference/i,
  );
});
