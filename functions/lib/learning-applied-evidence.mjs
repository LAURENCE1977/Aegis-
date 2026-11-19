export const MAX_LEARNING_ARTIFACT_BYTES = 2 * 1024 * 1024;

const ALLOWED_MEDIA_TYPES = new Set([
  'application/octet-stream',
  'application/pdf',
  'image/jpeg',
  'image/png',
  'text/plain',
]);

export function validateLearningArtifactUpload(bytes, mediaType) {
  if (!(bytes instanceof Uint8Array)) {
    throw new TypeError('Learning artifact must be supplied as bytes');
  }
  if (bytes.byteLength < 1) throw new TypeError('Learning artifact cannot be empty');
  if (bytes.byteLength > MAX_LEARNING_ARTIFACT_BYTES) {
    throw new TypeError('Learning artifact exceeds the 2 MiB size limit');
  }
  if (typeof mediaType !== 'string' || !ALLOWED_MEDIA_TYPES.has(mediaType)) {
    throw new TypeError('Unsupported Learning artifact media type');
  }
  return Object.freeze({ byteLength: bytes.byteLength, mediaType });
}

export async function hashLearningArtifact(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 1 ||
      bytes.byteLength > MAX_LEARNING_ARTIFACT_BYTES) {
    throw new TypeError('Learning artifact bytes are invalid or outside the size limit');
  }
  if (!globalThis.crypto?.subtle) throw new Error('Web Crypto SHA-256 is unavailable');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
