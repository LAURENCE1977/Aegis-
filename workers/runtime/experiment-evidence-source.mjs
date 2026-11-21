const PRINCIPAL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,79}$/;
const RECORD_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/;
const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;
const EVIDENCE_KINDS = new Set(['safety', 'criterion', 'benchmark', 'cost', 'runtime']);
const MEDIA_TYPES = new Set([
  'application/json',
  'application/octet-stream',
  'text/plain',
]);
const DEFAULT_MAX_BYTES = 1024 * 1024;
const MAX_ALLOWED_BYTES = 10 * 1024 * 1024;
const OBJECT_PREFIX = 'aegis/evidence/v1';

function validateOwnerId(value) {
  if (typeof value !== 'string' || !PRINCIPAL_PATTERN.test(value)) {
    throw new TypeError('Authenticated owner ID must be a bounded principal identifier.');
  }
}

function validateRecordId(value) {
  if (typeof value !== 'string' || !RECORD_ID_PATTERN.test(value)) {
    throw new TypeError('Experiment record ID must be a bounded identifier.');
  }
}

function validateRef(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 500 ||
      /[\u0000-\u001f\u007f]/.test(value)) {
    throw new TypeError('Evidence reference must be bounded safe text.');
  }
}

function validateTimestamp(value, label) {
  if (typeof value !== 'string') throw new TypeError(label + ' must be a canonical UTC timestamp.');
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) {
    throw new TypeError(label + ' must be a canonical UTC timestamp.');
  }
}

function validateManifestEntry(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('An immutable evidence manifest entry is required.');
  }
  validateRef(value.ref);
  if (!EVIDENCE_KINDS.has(value.kind)) throw new TypeError('Evidence manifest kind is unsupported.');
  if (typeof value.sha256 !== 'string' || !DIGEST_PATTERN.test(value.sha256)) {
    throw new TypeError('Evidence manifest SHA-256 digest is invalid.');
  }
  validateTimestamp(value.capturedAt, 'Evidence manifest capture time');
}

async function sha256Hex(value) {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto SHA-256 support is required for evidence object keys.');
  }
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Derive the only permitted object key for an owner/record/manifest reference.
 * The evidence reference is hashed so it is never interpreted as a path.
 */
export async function evidenceArtifactObjectKey({ ownerId, recordId, ref } = {}) {
  validateOwnerId(ownerId);
  validateRecordId(recordId);
  validateRef(ref);
  return OBJECT_PREFIX + '/' + ownerId + '/' + recordId + '/' + await sha256Hex(ref);
}

/**
 * Read an evidence object from a trusted object-storage binding (for example,
 * a private Cloudflare R2 bucket). ownerId must come from the authenticated
 * server context and expectedEvidence from a digest-verified stored record.
 *
 * No caller-provided URL, bucket name or object key is accepted. The object
 * metadata is checked before the bounded body is read. The returned bytes
 * still require verifyExperimentEvidenceArtifact before being trusted.
 */
export async function readExperimentEvidenceArtifact({
  bucket,
  ownerId,
  recordId,
  expectedEvidence,
  maxBytes = DEFAULT_MAX_BYTES,
} = {}) {
  validateOwnerId(ownerId);
  validateRecordId(recordId);
  validateManifestEntry(expectedEvidence);
  if (!bucket || typeof bucket.get !== 'function') {
    throw new TypeError('A trusted object-storage bucket binding is required.');
  }
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > MAX_ALLOWED_BYTES) {
    throw new TypeError('Evidence artifact size limit must be between 1 byte and 10 MiB.');
  }

  const key = await evidenceArtifactObjectKey({
    ownerId,
    recordId,
    ref: expectedEvidence.ref,
  });
  const object = await bucket.get(key);
  if (object === null || object === undefined) return null;

  if (!Number.isSafeInteger(object.size) || object.size < 1) {
    throw new TypeError('Evidence object size metadata is invalid.');
  }
  if (object.size > maxBytes) {
    throw new RangeError('Evidence object exceeds the configured size limit.');
  }

  const metadata = object.customMetadata;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new TypeError('Evidence object metadata is missing or invalid.');
  }
  if (metadata.ownerId !== ownerId) throw new TypeError('Evidence object owner does not match the authenticated owner.');
  if (metadata.recordId !== recordId) throw new TypeError('Evidence object record does not match the requested record.');
  if (metadata.ref !== expectedEvidence.ref) throw new TypeError('Evidence object reference does not match the record manifest.');
  if (metadata.kind !== expectedEvidence.kind) throw new TypeError('Evidence object kind does not match the record manifest.');
  if (metadata.capturedAt !== expectedEvidence.capturedAt) {
    throw new TypeError('Evidence object capture time does not match the record manifest.');
  }

  const mediaType = object.httpMetadata?.contentType;
  if (typeof mediaType !== 'string' || !MEDIA_TYPES.has(mediaType.toLowerCase())) {
    throw new TypeError('Evidence object media type is unsupported.');
  }
  if (typeof object.arrayBuffer !== 'function') {
    throw new TypeError('Evidence object body cannot be read.');
  }

  const body = await object.arrayBuffer();
  if (!(body instanceof ArrayBuffer) || body.byteLength !== object.size) {
    throw new TypeError('Evidence object body does not match its stored size metadata.');
  }
  if (body.byteLength > maxBytes || body.byteLength < 1) {
    throw new RangeError('Evidence object body exceeds the configured size limit or is empty.');
  }

  return {
    ownerId,
    recordId,
    ref: metadata.ref,
    kind: metadata.kind,
    capturedAt: metadata.capturedAt,
    mediaType: mediaType.toLowerCase(),
    bytes: new Uint8Array(body),
  };
}
