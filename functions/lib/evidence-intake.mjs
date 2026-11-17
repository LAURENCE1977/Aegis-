import { randomUUID } from 'node:crypto';

const SOURCE_KINDS = new Set(['user-upload', 'device-export', 'repository-blob', 'manual-import']);
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MEDIA_TYPE_PATTERN = /^[a-z0-9][a-z0-9!#$&^_.+-]{0,126}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,126}$/;

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, keys, label) {
  if (!isRecord(value) || Object.keys(value).length !== keys.length ||
      Object.keys(value).some((key) => !keys.includes(key))) {
    throw new TypeError('Invalid ' + label + ' fields');
  }
}

function requireText(value, label, maxLength) {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim() ||
      value.length > maxLength || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new TypeError('Invalid ' + label);
  }
}

function validateSource(source) {
  exactKeys(source, ['kind', 'reference'], 'evidence source');
  if (!SOURCE_KINDS.has(source.kind)) throw new TypeError('Invalid evidence source kind');

  if (source.kind === 'repository-blob') {
    requireText(source.reference, 'repository evidence reference', 2048);
    let parsed;
    try {
      parsed = new URL(source.reference);
    } catch {
      throw new TypeError('Invalid repository evidence reference');
    }
    if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.username || parsed.password ||
        parsed.search || parsed.hash) {
      throw new TypeError('Repository evidence reference must be canonical HTTPS');
    }
  } else if (source.reference !== null) {
    throw new TypeError('Only repository evidence may contain a source reference');
  }
}

export function validateEvidenceDescriptor(descriptor) {
  exactKeys(descriptor, [
    'schemaVersion', 'evidenceId', 'ownerId', 'sha256', 'byteLength', 'mediaType',
    'displayName', 'acquiredAt', 'source',
  ], 'evidence descriptor');

  if (descriptor.schemaVersion !== 1 || !UUID_V4_PATTERN.test(descriptor.evidenceId)) {
    throw new TypeError('Invalid evidence descriptor identity or schema version');
  }
  requireText(descriptor.ownerId, 'evidence owner identifier', 80);
  if (!SHA256_PATTERN.test(descriptor.sha256)) throw new TypeError('Invalid SHA-256 digest');
  if (!Number.isSafeInteger(descriptor.byteLength) || descriptor.byteLength <= 0) {
    throw new TypeError('Invalid evidence byte length');
  }
  if (typeof descriptor.mediaType !== 'string' || !MEDIA_TYPE_PATTERN.test(descriptor.mediaType)) {
    throw new TypeError('Invalid evidence media type');
  }
  requireText(descriptor.displayName, 'evidence display name', 160);
  if (descriptor.displayName === '.' || descriptor.displayName === '..' ||
      descriptor.displayName.includes('/') || descriptor.displayName.includes('\\')) {
    throw new TypeError('Evidence display name must not contain a path');
  }
  if (typeof descriptor.acquiredAt !== 'string' || !Number.isFinite(Date.parse(descriptor.acquiredAt)) ||
      new Date(descriptor.acquiredAt).toISOString() !== descriptor.acquiredAt) {
    throw new TypeError('Invalid evidence acquisition timestamp');
  }
  validateSource(descriptor.source);
  return true;
}

/**
 * Create a metadata-only identity for original evidence.
 * ownerId must be derived from the authenticated server-side principal, never trusted from a client request.
 * File bytes and storage locations are deliberately outside this contract.
 */
export function createEvidenceDescriptor(input) {
  exactKeys(input, [
    'ownerId', 'sha256', 'byteLength', 'mediaType', 'displayName', 'acquiredAt', 'source',
  ], 'evidence descriptor input');

  const source = Object.freeze({ kind: input.source?.kind, reference: input.source?.reference });
  const descriptor = {
    schemaVersion: 1,
    evidenceId: randomUUID(),
    ownerId: input.ownerId,
    sha256: input.sha256,
    byteLength: input.byteLength,
    mediaType: input.mediaType,
    displayName: input.displayName,
    acquiredAt: input.acquiredAt,
    source,
  };
  validateEvidenceDescriptor(descriptor);
  return Object.freeze(descriptor);
}
