const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;
const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,79}$/;
const EVIDENCE_KINDS = new Set(['safety', 'criterion', 'benchmark', 'cost', 'runtime']);
const MEDIA_TYPES = new Set([
  'application/json',
  'application/octet-stream',
  'text/plain',
]);
const DEFAULT_MAX_BYTES = 1024 * 1024;
const MAX_ALLOWED_BYTES = 10 * 1024 * 1024;

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value, allowed, label) {
  if (!isRecord(value) || Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new TypeError(label + ' contains unexpected fields.');
  }
}

function validateId(value, label) {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    throw new TypeError(label + ' must be a bounded identifier.');
  }
}

function validateText(value, label, maxLength = 500) {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength ||
      /[\u0000-\u001f\u007f]/.test(value)) {
    throw new TypeError(label + ' must be bounded safe text.');
  }
}

function validateUtcTimestamp(value, label) {
  if (typeof value !== 'string') throw new TypeError(label + ' must be a UTC timestamp.');
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) {
    throw new TypeError(label + ' must be a canonical UTC timestamp.');
  }
  return date.getTime();
}

function validateEvidenceEntry(value) {
  hasExactKeys(value, ['ref', 'kind', 'sha256', 'capturedAt'], 'Expected evidence manifest entry');
  validateText(value.ref, 'Evidence reference');
  if (!EVIDENCE_KINDS.has(value.kind)) throw new TypeError('Evidence kind is unsupported.');
  if (typeof value.sha256 !== 'string' || !DIGEST_PATTERN.test(value.sha256)) {
    throw new TypeError('Expected evidence must contain a valid SHA-256 digest.');
  }
  validateUtcTimestamp(value.capturedAt, 'Evidence capture time');
}

async function digestBytes(bytes) {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto SHA-256 support is required to verify evidence artifacts.');
  }
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return 'sha256:' + Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
}

/**
 * Verify bytes supplied by an authenticated source adapter against the
 * immutable evidence manifest of one owner-scoped experiment record.
 *
 * This function performs no I/O and never resolves a URL. It returns only
 * metadata; callers remain responsible for authenticated artifact retrieval
 * and for persisting the resulting attestation under the same owner boundary.
 */
export async function verifyExperimentEvidenceArtifact({
  ownerId,
  recordId,
  artifact,
  expectedEvidence,
  now = new Date().toISOString(),
  maxBytes = DEFAULT_MAX_BYTES,
} = {}) {
  validateId(ownerId, 'Authenticated owner ID');
  validateId(recordId, 'Experiment record ID');
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > MAX_ALLOWED_BYTES) {
    throw new TypeError('Evidence artifact size limit must be between 1 byte and 10 MiB.');
  }

  hasExactKeys(
    artifact,
    ['ownerId', 'recordId', 'ref', 'kind', 'capturedAt', 'mediaType', 'bytes'],
    'Evidence artifact',
  );
  validateId(artifact.ownerId, 'Artifact owner ID');
  validateId(artifact.recordId, 'Artifact source record ID');
  validateText(artifact.ref, 'Artifact evidence reference');
  if (!EVIDENCE_KINDS.has(artifact.kind)) throw new TypeError('Artifact evidence kind is unsupported.');
  validateUtcTimestamp(artifact.capturedAt, 'Artifact capture time');
  if (!MEDIA_TYPES.has(artifact.mediaType)) {
    throw new TypeError('Artifact media type is unsupported.');
  }
  if (!(artifact.bytes instanceof Uint8Array)) {
    throw new TypeError('Evidence artifact payload must be a Uint8Array byte array.');
  }
  if (artifact.bytes.byteLength < 1 || artifact.bytes.byteLength > maxBytes) {
    throw new RangeError('Evidence artifact exceeds the configured size limit or is empty.');
  }

  validateEvidenceEntry(expectedEvidence);
  const verifiedAtMs = validateUtcTimestamp(now, 'Evidence verification time');
  const capturedAtMs = Date.parse(artifact.capturedAt);

  if (artifact.ownerId !== ownerId) throw new TypeError('Artifact owner does not match the authenticated owner.');
  if (artifact.recordId !== recordId) throw new TypeError('Artifact source record does not match the requested record.');
  if (artifact.ref !== expectedEvidence.ref) throw new TypeError('Artifact reference does not match the record manifest.');
  if (artifact.kind !== expectedEvidence.kind) throw new TypeError('Artifact kind does not match the record manifest.');
  if (artifact.capturedAt !== expectedEvidence.capturedAt) {
    throw new TypeError('Artifact capture time does not match the record manifest.');
  }
  if (capturedAtMs > verifiedAtMs) throw new TypeError('Artifact capture time cannot be in the future.');

  // Snapshot caller-owned memory before the asynchronous digest operation.
  const stableBytes = new Uint8Array(artifact.bytes);
  const actualDigest = await digestBytes(stableBytes);
  if (actualDigest !== expectedEvidence.sha256) {
    throw new TypeError('Evidence artifact digest mismatch.');
  }

  return Object.freeze({
    schemaVersion: 'aegis.verified-evidence-artifact.v1',
    ownerId,
    recordId,
    ref: artifact.ref,
    kind: artifact.kind,
    sha256: actualDigest,
    capturedAt: artifact.capturedAt,
    verifiedAt: now,
    mediaType: artifact.mediaType,
    byteLength: stableBytes.byteLength,
    verification: 'verified',
  });
}
