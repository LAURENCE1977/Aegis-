const OWNER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,79}$/;
const SOURCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,79}$/;
const KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,79}$/;
const SNAPSHOT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,127}$/;
const NONCE_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;

function validateText(value, pattern, label) {
  if (typeof value !== 'string' || !pattern.test(value)) {
    throw new TypeError(label + ' is invalid.');
  }
  return value;
}

function validateTimestamp(value, label) {
  if (typeof value !== 'string') throw new TypeError(label + ' must be a canonical UTC timestamp.');
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new TypeError(label + ' must be a canonical UTC timestamp.');
  }
  return value;
}

/**
 * Atomically consume a nonce after cryptographic signature verification.
 *
 * The database primary key (owner_id, source_id, nonce) is the concurrency
 * boundary: concurrent attempts can produce at most one inserted row.
 * Nonce rows are append-only and intentionally have no TTL; purging them
 * would permit a previously valid signed request to be replayed.
 *
 * This function does not verify signatures or load trusted source keys. The
 * caller must pass only the immutable result returned by
 * verifySoftwareInventoryAttestation and must derive ownerId through its
 * authenticated server context before calling the signature verifier.
 */
export async function consumeSoftwareInventoryNonce({
  db,
  verifiedAttestation,
  now = new Date().toISOString(),
} = {}) {
  if (!db || typeof db.prepare !== 'function') {
    throw new TypeError('A D1-compatible database binding is required for nonce replay protection.');
  }
  if (!verifiedAttestation || typeof verifiedAttestation !== 'object' ||
      Array.isArray(verifiedAttestation)) {
    throw new TypeError('A verified software inventory signature result is required.');
  }
  if (verifiedAttestation.schemaVersion !== 'aegis.software-inventory-signature-verification.v1' ||
      verifiedAttestation.verification !== 'signature_valid' ||
      verifiedAttestation.acceptance !== 'pending_atomic_nonce_consumption') {
    throw new TypeError('Only a signature-valid inventory pending atomic nonce consumption can be accepted.');
  }
  if (!verifiedAttestation.authority ||
      verifiedAttestation.authority.sentinelApprovalRequired !== true ||
      verifiedAttestation.authority.response !== 'not_authorised' ||
      verifiedAttestation.authority.executeCode !== false ||
      verifiedAttestation.authority.installSoftware !== false ||
      verifiedAttestation.authority.remediate !== false ||
      verifiedAttestation.authority.changeConfiguration !== false) {
    throw new TypeError('Inventory nonce acceptance requires the non-authorising Sentinel boundary.');
  }

  const ownerId = validateText(verifiedAttestation.ownerId, OWNER_PATTERN, 'Inventory owner');
  const sourceId = validateText(verifiedAttestation.sourceId, SOURCE_PATTERN, 'Inventory source');
  const keyId = validateText(verifiedAttestation.keyId, KEY_PATTERN, 'Inventory key identifier');
  const snapshotId = validateText(verifiedAttestation.snapshotId, SNAPSHOT_PATTERN, 'Inventory snapshot identifier');
  const nonce = validateText(verifiedAttestation.nonce, NONCE_PATTERN, 'Inventory source nonce');
  if (typeof verifiedAttestation.inventoryDigest !== 'string' ||
      !DIGEST_PATTERN.test(verifiedAttestation.inventoryDigest)) {
    throw new TypeError('Inventory snapshot digest is invalid.');
  }
  const signedAt = validateTimestamp(verifiedAttestation.signedAt, 'Inventory signature timestamp');
  const acceptedAt = validateTimestamp(now, 'Inventory nonce acceptance timestamp');
  if (new Date(signedAt).getTime() > new Date(acceptedAt).getTime()) {
    throw new RangeError('Inventory signature timestamp cannot be newer than nonce acceptance.');
  }

  const result = await db.prepare(
    'INSERT INTO software_inventory_nonces (owner_id, source_id, nonce, key_id, snapshot_id, inventory_digest, signed_at, accepted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(owner_id, source_id, nonce) DO NOTHING'
  ).bind(
    ownerId,
    sourceId,
    nonce,
    keyId,
    snapshotId,
    verifiedAttestation.inventoryDigest,
    signedAt,
    acceptedAt,
  ).run();

  const inserted = Number(result?.meta?.changes || 0) === 1;
  return Object.freeze({
    schemaVersion: 'aegis.software-inventory-nonce-consumption.v1',
    status: inserted ? 'accepted' : 'replay_rejected',
    accepted: inserted,
    ownerId,
    sourceId,
    nonce,
    ...(inserted ? {
      keyId,
      snapshotId,
      inventoryDigest: verifiedAttestation.inventoryDigest,
      signedAt,
      acceptedAt,
    } : {}),
    authority: Object.freeze({
      inventoryAcceptance: inserted,
      executeCode: false,
      installSoftware: false,
      remediate: false,
      changeConfiguration: false,
      sentinelApprovalRequired: true,
      response: 'not_authorised',
    }),
  });
}
