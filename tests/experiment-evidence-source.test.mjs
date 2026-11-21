import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  evidenceArtifactObjectKey,
  readExperimentEvidenceArtifact,
} from '../workers/runtime/experiment-evidence-source.mjs';

const expectedEvidence = {
  ref: 'evidence:benchmark/run-1',
  kind: 'benchmark',
  sha256: 'sha256:' + 'a'.repeat(64),
  capturedAt: '2026-11-21T10:00:00.000Z',
};
const ownerId = 'owner';
const recordId = 'record-1';
const bytes = new TextEncoder().encode('synthetic benchmark payload');
const metadata = {
  ownerId,
  recordId,
  ref: expectedEvidence.ref,
  kind: expectedEvidence.kind,
  capturedAt: expectedEvidence.capturedAt,
};

function bucketWith(object, onGet = () => {}) {
  return {
    async get(key) {
      onGet(key);
      return object;
    },
  };
}

function objectWith(overrides = {}) {
  return {
    size: bytes.byteLength,
    customMetadata: { ...metadata, ...(overrides.customMetadata || {}) },
    httpMetadata: { contentType: 'application/json' },
    async arrayBuffer() {
      return bytes.slice().buffer;
    },
    ...overrides,
  };
}

test('derives an opaque deterministic object key scoped to owner and record', async () => {
  const key = await evidenceArtifactObjectKey({ ownerId, recordId, ref: expectedEvidence.ref });
  const digest = createHash('sha256').update(expectedEvidence.ref).digest('hex');

  assert.equal(key, `aegis/evidence/v1/owner/record-1/${digest}`);
  assert.equal(
    await evidenceArtifactObjectKey({ ownerId, recordId, ref: expectedEvidence.ref }),
    key,
  );
  assert.notEqual(
    await evidenceArtifactObjectKey({ ownerId: 'other-owner', recordId, ref: expectedEvidence.ref }),
    key,
  );
  assert.notEqual(
    await evidenceArtifactObjectKey({ ownerId, recordId: 'other-record', ref: expectedEvidence.ref }),
    key,
  );
});

test('reads only the object derived from the trusted owner, record and manifest reference', async () => {
  let requestedKey;
  const artifact = await readExperimentEvidenceArtifact({
    bucket: bucketWith(objectWith(), (key) => { requestedKey = key; }),
    ownerId,
    recordId,
    expectedEvidence,
  });

  assert.equal(requestedKey, await evidenceArtifactObjectKey({ ownerId, recordId, ref: expectedEvidence.ref }));
  assert.equal(artifact.ownerId, ownerId);
  assert.equal(artifact.recordId, recordId);
  assert.equal(artifact.ref, expectedEvidence.ref);
  assert.equal(artifact.kind, expectedEvidence.kind);
  assert.equal(artifact.capturedAt, expectedEvidence.capturedAt);
  assert.equal(artifact.mediaType, 'application/json');
  assert.deepEqual(artifact.bytes, bytes);
});

test('returns null when the trusted evidence object does not exist', async () => {
  const artifact = await readExperimentEvidenceArtifact({
    bucket: bucketWith(null),
    ownerId,
    recordId,
    expectedEvidence,
  });

  assert.equal(artifact, null);
});

test('rejects object metadata belonging to another owner or record', async () => {
  await assert.rejects(
    () => readExperimentEvidenceArtifact({
      bucket: bucketWith(objectWith({ customMetadata: { ownerId: 'other-owner' } })),
      ownerId,
      recordId,
      expectedEvidence,
    }),
    /owner/i,
  );
  await assert.rejects(
    () => readExperimentEvidenceArtifact({
      bucket: bucketWith(objectWith({ customMetadata: { recordId: 'other-record' } })),
      ownerId,
      recordId,
      expectedEvidence,
    }),
    /record/i,
  );
});

test('rejects a reference, kind or capture timestamp mismatch', async () => {
  for (const customMetadata of [
    { ref: 'evidence:other' },
    { kind: 'runtime' },
    { capturedAt: '2026-11-21T10:01:00.000Z' },
  ]) {
    await assert.rejects(
      () => readExperimentEvidenceArtifact({
        bucket: bucketWith(objectWith({ customMetadata })),
        ownerId,
        recordId,
        expectedEvidence,
      }),
      /manifest|reference|kind|capture/i,
    );
  }
});

test('rejects absent or unsupported content type and malformed object metadata', async () => {
  await assert.rejects(
    () => readExperimentEvidenceArtifact({
      bucket: bucketWith(objectWith({ httpMetadata: {} })),
      ownerId,
      recordId,
      expectedEvidence,
    }),
    /media type/i,
  );
  await assert.rejects(
    () => readExperimentEvidenceArtifact({
      bucket: bucketWith(objectWith({ httpMetadata: { contentType: 'text/html' } })),
      ownerId,
      recordId,
      expectedEvidence,
    }),
    /media type/i,
  );
  await assert.rejects(
    () => readExperimentEvidenceArtifact({
      bucket: bucketWith(objectWith({ customMetadata: { capturedAt: undefined } })),
      ownerId,
      recordId,
      expectedEvidence,
    }),
    /metadata/i,
  );
});

test('rejects oversized objects before reading their body', async () => {
  let bodyRead = false;
  const object = objectWith({
    size: 1024,
    async arrayBuffer() {
      bodyRead = true;
      return bytes.slice().buffer;
    },
  });
  await assert.rejects(
    () => readExperimentEvidenceArtifact({
      bucket: bucketWith(object),
      ownerId,
      recordId,
      expectedEvidence,
      maxBytes: 64,
    }),
    /size limit/i,
  );
  assert.equal(bodyRead, false);
});

test('rejects object bodies whose actual length differs from stored object size', async () => {
  const object = objectWith({
    size: bytes.byteLength + 1,
  });
  await assert.rejects(
    () => readExperimentEvidenceArtifact({
      bucket: bucketWith(object),
      ownerId,
      recordId,
      expectedEvidence,
    }),
    /size metadata/i,
  );
});

test('rejects arbitrary bucket keys and invalid owner or record identifiers', async () => {
  let called = false;
  const bucket = bucketWith(objectWith(), () => { called = true; });
  await assert.rejects(
    () => readExperimentEvidenceArtifact({
      bucket,
      ownerId: '../other-owner',
      recordId,
      expectedEvidence,
    }),
    /owner/i,
  );
  await assert.rejects(
    () => readExperimentEvidenceArtifact({
      bucket,
      ownerId,
      recordId: '../other-record',
      expectedEvidence,
    }),
    /record/i,
  );
  assert.equal(called, false);
});
