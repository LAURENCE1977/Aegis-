import test from 'node:test';
import assert from 'node:assert/strict';
import { createEvidenceDescriptor, validateEvidenceDescriptor } from '../functions/lib/evidence-intake.mjs';

const valid = {
  schemaVersion: 1,
  evidenceId: '7f2e8d0a-5a6b-4f2c-9b3e-1d4c6a8f0b2e',
  ownerId: 'owner-123',
  sha256: 'a'.repeat(64),
  byteLength: 4096,
  mediaType: 'application/octet-stream',
  displayName: 'router-firmware.bin',
  acquiredAt: '2026-11-17T12:00:00.000Z',
  source: { kind: 'user-upload', reference: null },
};

test('accepts a provenance-labelled evidence descriptor without storing file bytes', () => {
  assert.equal(validateEvidenceDescriptor(valid), true);
});

test('rejects malformed or non-lowercase SHA-256 digests', () => {
  assert.throws(() => validateEvidenceDescriptor({ ...valid, sha256: 'A'.repeat(64) }));
  assert.throws(() => validateEvidenceDescriptor({ ...valid, sha256: 'abc123' }));
});

test('rejects empty, negative, fractional and unsafe byte lengths', () => {
  for (const byteLength of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => validateEvidenceDescriptor({ ...valid, byteLength }));
  }
});

test('rejects non-canonical timestamps and invalid media types', () => {
  assert.throws(() => validateEvidenceDescriptor({ ...valid, acquiredAt: '17/11/2026' }));
  assert.throws(() => validateEvidenceDescriptor({ ...valid, mediaType: 'application/*' }));
});

test('rejects display names containing paths or control characters', () => {
  assert.throws(() => validateEvidenceDescriptor({ ...valid, displayName: '../secret.txt' }));
  assert.throws(() => validateEvidenceDescriptor({ ...valid, displayName: 'C:\\Users\\person\\secret.txt' }));
  assert.throws(() => validateEvidenceDescriptor({ ...valid, displayName: 'bad\u0000name.bin' }));
});

test('requires a canonical HTTPS reference for repository blobs only', () => {
  assert.equal(validateEvidenceDescriptor({
    ...valid,
    source: { kind: 'repository-blob', reference: 'https://github.com/example/repo/blob/abc/file.bin' },
  }), true);
  assert.throws(() => validateEvidenceDescriptor({
    ...valid,
    source: { kind: 'repository-blob', reference: null },
  }));
  assert.throws(() => validateEvidenceDescriptor({
    ...valid,
    source: { kind: 'repository-blob', reference: 'http://github.com/example/repo/file.bin' },
  }));
  assert.throws(() => validateEvidenceDescriptor({
    ...valid,
    source: { kind: 'user-upload', reference: 'https://example.org/file.bin' },
  }));
});

test('rejects unexpected fields, including embedded bytes or storage paths', () => {
  assert.throws(() => validateEvidenceDescriptor({ ...valid, contentBase64: 'AQID' }));
  assert.throws(() => validateEvidenceDescriptor({ ...valid, storagePath: '/tmp/evidence.bin' }));
  assert.throws(() => validateEvidenceDescriptor({
    ...valid,
    source: { ...valid.source, localPath: '/private/file.bin' },
  }));
});

test('creates a new immutable descriptor and derives its identifier internally', () => {
  const descriptor = createEvidenceDescriptor({
    ownerId: valid.ownerId,
    sha256: valid.sha256,
    byteLength: valid.byteLength,
    mediaType: valid.mediaType,
    displayName: valid.displayName,
    acquiredAt: valid.acquiredAt,
    source: valid.source,
  });

  assert.match(descriptor.evidenceId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.equal(descriptor.schemaVersion, 1);
  assert.equal(descriptor.ownerId, valid.ownerId);
  assert.equal(Object.isFrozen(descriptor), true);
  assert.equal(Object.isFrozen(descriptor.source), true);
  assert.equal(validateEvidenceDescriptor(descriptor), true);
});

test('does not allow callers to supply an evidence identifier or unknown creation fields', () => {
  assert.throws(() => createEvidenceDescriptor({
    ownerId: valid.ownerId,
    evidenceId: valid.evidenceId,
    sha256: valid.sha256,
    byteLength: valid.byteLength,
    mediaType: valid.mediaType,
    displayName: valid.displayName,
    acquiredAt: valid.acquiredAt,
    source: valid.source,
  }));
});


test('rejects descriptors with non-plain object prototypes', () => {
  const descriptor = Object.assign(Object.create({ inherited: true }), valid);
  assert.throws(() => validateEvidenceDescriptor(descriptor));
});

test('rejects unexpected nested source fields during creation instead of silently discarding them', () => {
  assert.throws(() => createEvidenceDescriptor({
    ownerId: valid.ownerId,
    sha256: valid.sha256,
    byteLength: valid.byteLength,
    mediaType: valid.mediaType,
    displayName: valid.displayName,
    acquiredAt: valid.acquiredAt,
    source: { ...valid.source, localPath: '/private/file.bin' },
  }));
});
