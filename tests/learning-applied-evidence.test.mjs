import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  hashLearningArtifact,
  validateLearningArtifactUpload,
} from '../functions/lib/learning-applied-evidence.mjs';

test('hashes artifact bytes with SHA-256 without retaining or transforming the payload', async () => {
  const bytes = new TextEncoder().encode('a small learner work sample');
  const result = await hashLearningArtifact(bytes);
  assert.equal(result, createHash('sha256').update(bytes).digest('hex'));
});

test('accepts only bounded non-empty artifact bytes and a supported media type', () => {
  const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
  assert.deepEqual(validateLearningArtifactUpload(bytes, 'application/pdf'), {
    byteLength: 4,
    mediaType: 'application/pdf',
  });
});

test('rejects empty, oversized, non-byte and unsupported artifact uploads', () => {
  assert.throws(() => validateLearningArtifactUpload(new Uint8Array(), 'text/plain'), /empty/i);
  assert.throws(() => validateLearningArtifactUpload(new Uint8Array(2 * 1024 * 1024 + 1), 'application/pdf'), /size/i);
  assert.throws(() => validateLearningArtifactUpload('not bytes', 'text/plain'), /byte/i);
  assert.throws(() => validateLearningArtifactUpload(new Uint8Array([1]), 'text/html'), /media type/i);
});

test('normalises case and surrounding whitespace in a supported media type', () => {
  assert.equal(validateLearningArtifactUpload(new Uint8Array([1]), ' Application/PDF ').mediaType, 'application/pdf');
});

test('rejects caller-controlled media-type parameters', () => {
  assert.throws(() => validateLearningArtifactUpload(new Uint8Array([1]), 'text/plain; charset=utf-8'), /media type/i);
});
