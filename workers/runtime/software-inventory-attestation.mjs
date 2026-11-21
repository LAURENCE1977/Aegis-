const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,79}$/;
const NONCE_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
const SIGNATURE_PATTERN = /^[a-f0-9]{64}$/i;
const ECOSYSTEM_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/;
const PACKAGE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._+@/-]{0,254}$/;
const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9.+_~:-]{0,127}$/;
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_ALLOWED_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_INVENTORY_BYTES = 1024 * 1024;
const MAX_PACKAGES = 500;

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function exactFields(value, allowed, label) {
  if (!isRecord(value) || Object.keys(value).some(key => !allowed.includes(key))) {
    throw new TypeError(label + ' contains unexpected fields.');
  }
}

function boundedText(value, label, max, pattern = ID_PATTERN) {
  if (typeof value !== 'string' || value.length < 1 || value.length > max ||
      value.trim() !== value || !pattern.test(value) || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new TypeError(label + ' is invalid.');
  }
  return value;
}

function timestamp(value, label) {
  if (typeof value !== 'string') throw new TypeError(label + ' must be a canonical UTC timestamp.');
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new TypeError(label + ' must be a canonical UTC timestamp.');
  }
  return parsed.getTime();
}

function canonicalize(value, seen = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Inventory contains a non-finite number.');
    return value;
  }
  if (typeof value !== 'object') throw new TypeError('Inventory contains a non-JSON value.');
  if (seen.has(value)) throw new TypeError('Inventory contains a circular reference.');
  seen.add(value);
  let result;
  if (Array.isArray(value)) {
    result = value.map(item => canonicalize(item, seen));
  } else {
    if (!isRecord(value)) throw new TypeError('Inventory contains a non-plain object.');
    result = {};
    for (const key of Object.keys(value).sort()) {
      if (value[key] === undefined) throw new TypeError('Inventory contains an undefined field.');
      result[key] = canonicalize(value[key], seen);
    }
  }
  seen.delete(value);
  return result;
}

function normalizeInventory(inventory) {
  exactFields(inventory, ['snapshotId', 'observedAt', 'packages'], 'Inventory snapshot');
  const snapshotId = boundedText(inventory.snapshotId, 'Inventory snapshot identifier', 128);
  const observedAtMs = timestamp(inventory.observedAt, 'Inventory observation time');
  if (!Array.isArray(inventory.packages) || inventory.packages.length < 1 ||
      inventory.packages.length > MAX_PACKAGES) {
    throw new TypeError('Inventory must contain between 1 and 500 package records.');
  }
  const packages = inventory.packages.map(item => {
    exactFields(item, ['ecosystem', 'name', 'version', 'purl'], 'Inventory package');
    const result = {
      ecosystem: boundedText(item.ecosystem, 'Package ecosystem', 64, ECOSYSTEM_PATTERN),
      name: boundedText(item.name, 'Package name', 255, PACKAGE_PATTERN),
      version: boundedText(item.version, 'Package version', 128, VERSION_PATTERN),
    };
    if (item.purl !== undefined) {
      result.purl = boundedText(item.purl, 'Package URL', 512, /^pkg:[a-z0-9.+-]+\/[^\s?#]+$/i);
      if (result.purl.includes('..')) throw new TypeError('Package URL is invalid.');
    }
    return result;
  });
  const normalized = { snapshotId, observedAt: new Date(observedAtMs).toISOString(), packages };
  const canonical = JSON.stringify(canonicalize(normalized));
  const bytes = new TextEncoder().encode(canonical);
  if (bytes.byteLength > MAX_INVENTORY_BYTES) {
    throw new RangeError('Canonical inventory exceeds the 1 MiB limit.');
  }
  return { normalized, observedAtMs, bytes };
}

function hexToBytes(value) {
  const bytes = new Uint8Array(value.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function sha256(bytes) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return 'sha256:' + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify a signed inventory using a trusted source record loaded by the
 * authenticated server from its owner-scoped source registry.
 *
 * A valid HMAC proves integrity and possession of the registered shared key;
 * it does not prove the endpoint is uncompromised or the inventory complete.
 * The caller must atomically consume (ownerId, sourceId, nonce) in persistent
 * storage before using this result. This pure verifier cannot prevent replay.
 */
export async function verifySoftwareInventoryAttestation({
  inventory,
  attestation,
  trustedSource,
  now = new Date().toISOString(),
  maxAgeMs = DEFAULT_MAX_AGE_MS,
  maxFutureSkewMs = 60_000,
} = {}) {
  exactFields(attestation,
    ['ownerId', 'sourceId', 'keyId', 'algorithm', 'nonce', 'signedAt', 'signature'],
    'Inventory attestation');
  exactFields(trustedSource,
    ['ownerId', 'sourceId', 'keyId', 'secretKey', 'status', 'validFrom', 'validUntil', 'revokedAt'],
    'Trusted inventory source');

  const ownerId = boundedText(attestation.ownerId, 'Attestation owner', 80);
  const sourceId = boundedText(attestation.sourceId, 'Attestation source', 80);
  const keyId = boundedText(attestation.keyId, 'Attestation key identifier', 80);
  if (attestation.ownerId !== trustedSource.ownerId) {
    throw new TypeError('Attestation owner does not match the authenticated owner source record.');
  }
  if (sourceId !== trustedSource.sourceId) throw new TypeError('Attestation source does not match the trusted source.');
  if (keyId !== trustedSource.keyId) throw new TypeError('Attestation key does not match the active trusted key.');
  if (trustedSource.status !== 'active' || trustedSource.revokedAt !== null) {
    throw new TypeError('Trusted inventory source key is not active or has been revoked.');
  }
  if (attestation.algorithm !== 'HMAC-SHA-256') throw new TypeError('Inventory signature algorithm is unsupported.');
  const nonce = boundedText(attestation.nonce, 'Attestation nonce', 128, NONCE_PATTERN);
  const signedAtMs = timestamp(attestation.signedAt, 'Attestation signing time');
  const nowMs = timestamp(now, 'Verification time');
  const validFromMs = timestamp(trustedSource.validFrom, 'Trusted key validity start');
  const validUntilMs = timestamp(trustedSource.validUntil, 'Trusted key validity end');
  if (validUntilMs <= validFromMs) throw new TypeError('Trusted key validity interval is invalid.');
  if (signedAtMs < validFromMs || signedAtMs > validUntilMs || nowMs > validUntilMs) {
    throw new TypeError('Trusted inventory source key is outside its validity interval or expired.');
  }
  if (!Number.isSafeInteger(maxAgeMs) || maxAgeMs < 1 || maxAgeMs > MAX_ALLOWED_AGE_MS ||
      !Number.isSafeInteger(maxFutureSkewMs) || maxFutureSkewMs < 0 || maxFutureSkewMs > 5 * 60 * 1000) {
    throw new TypeError('Inventory attestation time limits are invalid.');
  }
  if (signedAtMs > nowMs + maxFutureSkewMs) throw new RangeError('Attestation signing time is in the future.');
  if (nowMs - signedAtMs > maxAgeMs) throw new RangeError('Inventory attestation is stale and outside the allowed age.');
  if (typeof trustedSource.secretKey !== 'string' &&
      !(trustedSource.secretKey instanceof Uint8Array)) {
    throw new TypeError('Trusted source HMAC key must be server-held bytes.');
  }
  const keyBytes = typeof trustedSource.secretKey === 'string'
    ? new TextEncoder().encode(trustedSource.secretKey)
    : new Uint8Array(trustedSource.secretKey);
  if (keyBytes.byteLength < 32 || keyBytes.byteLength > 128) {
    throw new TypeError('Trusted source HMAC key length must be between 32 and 128 bytes.');
  }
  if (typeof attestation.signature !== 'string' || !SIGNATURE_PATTERN.test(attestation.signature)) {
    throw new TypeError('Inventory signature must be a 32-byte hexadecimal HMAC.');
  }

  const normalizedInventory = normalizeInventory(inventory);
  if (normalizedInventory.observedAtMs > signedAtMs) {
    throw new RangeError('Inventory observation time cannot be newer than its signature.');
  }
  if (nowMs - normalizedInventory.observedAtMs > maxAgeMs) {
    throw new RangeError('Inventory snapshot is stale and outside the allowed age.');
  }

  const payload = {
    schemaVersion: 'aegis.software-inventory-attestation.v1',
    ownerId,
    sourceId,
    keyId,
    nonce,
    signedAt: new Date(signedAtMs).toISOString(),
    inventory: normalizedInventory.normalized,
  };
  const payloadBytes = new TextEncoder().encode(JSON.stringify(canonicalize(payload)));
  const key = await globalThis.crypto.subtle.importKey(
    'raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'],
  );
  const signatureValid = await globalThis.crypto.subtle.verify(
    'HMAC', key, hexToBytes(attestation.signature), payloadBytes,
  );
  if (!signatureValid) throw new TypeError('Inventory signature verification failed.');

  const inventoryDigest = await sha256(normalizedInventory.bytes);
  return Object.freeze({
    schemaVersion: 'aegis.software-inventory-signature-verification.v1',
    ownerId,
    sourceId,
    keyId,
    snapshotId: normalizedInventory.normalized.snapshotId,
    observedAt: normalizedInventory.normalized.observedAt,
    signedAt: new Date(signedAtMs).toISOString(),
    nonce,
    inventoryDigest,
    packageCount: normalizedInventory.normalized.packages.length,
    verification: 'signature_valid',
    acceptance: 'pending_atomic_nonce_consumption',
    replayProtection: 'caller_must_atomically_consume_owner_source_nonce',
    authority: Object.freeze({
      inventoryCollection: false,
      executeCode: false,
      installSoftware: false,
      remediate: false,
      changeConfiguration: false,
      sentinelApprovalRequired: true,
      response: 'not_authorised',
    }),
  });
}
