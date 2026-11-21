import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifySoftwareInventoryAttestation } from '../workers/runtime/software-inventory-attestation.mjs';

const now = '2026-11-21T14:00:00.000Z';
const secretKey = new Uint8Array(32).fill(7);
const trustedSource = {
  ownerId: 'owner-a',
  sourceId: 'endpoint-agent-01',
  keyId: 'key-2026-01',
  secretKey,
  status: 'active',
  validFrom: '2026-11-01T00:00:00.000Z',
  validUntil: '2027-11-01T00:00:00.000Z',
  revokedAt: null,
};
const inventory = {
  snapshotId: 'snapshot-001',
  observedAt: '2026-11-21T13:55:00.000Z',
  packages: [{ ecosystem: 'npm', name: 'example-package', version: '1.2.3' }],
};
const canonical = value => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
};
function signedAttestation(overrides = {}, inventoryValue = inventory) {
  const unsigned = {
    ownerId: trustedSource.ownerId,
    sourceId: trustedSource.sourceId,
    keyId: trustedSource.keyId,
    algorithm: 'HMAC-SHA-256',
    nonce: 'nonce-0000000000000001',
    signedAt: '2026-11-21T13:56:00.000Z',
    ...overrides,
  };
  const payload = {
    schemaVersion: 'aegis.software-inventory-attestation.v1',
    ownerId: unsigned.ownerId,
    sourceId: unsigned.sourceId,
    keyId: unsigned.keyId,
    nonce: unsigned.nonce,
    signedAt: unsigned.signedAt,
    inventory: inventoryValue,
  };
  const signature = createHmac('sha256', Buffer.from(secretKey))
    .update(JSON.stringify(canonical(payload))).digest('hex');
  return { ...unsigned, signature };
}

test('verifies a source signature and binds the result to the owner, source, key and inventory digest', async () => {
  const result = await verifySoftwareInventoryAttestation({
    inventory,
    attestation: signedAttestation(),
    trustedSource,
    now,
  });

  assert.equal(result.schemaVersion, 'aegis.software-inventory-signature-verification.v1');
  assert.equal(result.verification, 'signature_valid');
  assert.equal(result.ownerId, 'owner-a');
  assert.equal(result.sourceId, 'endpoint-agent-01');
  assert.equal(result.keyId, 'key-2026-01');
  assert.equal(result.snapshotId, inventory.snapshotId);
  assert.match(result.inventoryDigest, /^sha256:[a-f0-9]{64}$/);
  assert.equal(result.nonce, 'nonce-0000000000000001');
  assert.equal(JSON.stringify(result).includes('secretKey'), false);
  assert.equal(Object.isFrozen(result), true);
});

test('rejects modified inventory bytes even when the original attestation is reused', async () => {
  await assert.rejects(() => verifySoftwareInventoryAttestation({
    inventory: { ...inventory, packages: [{ ...inventory.packages[0], version: '9.9.9' }] },
    attestation: signedAttestation(),
    trustedSource,
    now,
  }), /signature|verification/i);
});

test('rejects signatures from another owner, source or key identity', async () => {
  const valid = signedAttestation();
  await assert.rejects(() => verifySoftwareInventoryAttestation({
    inventory, attestation: { ...valid, ownerId: 'owner-b' }, trustedSource, now,
  }), /owner/i);
  await assert.rejects(() => verifySoftwareInventoryAttestation({
    inventory, attestation: { ...valid, sourceId: 'other-agent' }, trustedSource, now,
  }), /source/i);
  await assert.rejects(() => verifySoftwareInventoryAttestation({
    inventory, attestation: { ...valid, keyId: 'other-key' }, trustedSource, now,
  }), /key/i);
});

test('rejects revoked, disabled and out-of-validity trusted source keys', async () => {
  const attestation = signedAttestation();
  await assert.rejects(() => verifySoftwareInventoryAttestation({
    inventory, attestation, trustedSource: { ...trustedSource, status: 'revoked', revokedAt: now }, now,
  }), /revoked|active/i);
  await assert.rejects(() => verifySoftwareInventoryAttestation({
    inventory, attestation, trustedSource: { ...trustedSource, status: 'disabled' }, now,
  }), /active/i);
  await assert.rejects(() => verifySoftwareInventoryAttestation({
    inventory, attestation, trustedSource: { ...trustedSource, validUntil: '2026-11-20T00:00:00.000Z' }, now,
  }), /validity|expired/i);
});

test('rejects stale and future signatures and inventory observations', async () => {
  const stale = signedAttestation({ signedAt: '2026-11-19T00:00:00.000Z' });
  await assert.rejects(() => verifySoftwareInventoryAttestation({
    inventory, attestation: stale, trustedSource, now, maxAgeMs: 60 * 60 * 1000,
  }), /stale|age/i);
  const future = signedAttestation({ signedAt: '2026-11-21T14:02:00.000Z' });
  await assert.rejects(() => verifySoftwareInventoryAttestation({
    inventory, attestation: future, trustedSource, now,
  }), /future|clock/i);
  await assert.rejects(() => verifySoftwareInventoryAttestation({
    inventory: { ...inventory, observedAt: '2026-11-22T00:00:00.000Z' },
    attestation: signedAttestation({}, { ...inventory, observedAt: '2026-11-22T00:00:00.000Z' }),
    trustedSource, now,
  }), /future|clock|newer/i);
});

test('rejects malformed signatures, unknown fields and weak source keys', async () => {
  const valid = signedAttestation();
  await assert.rejects(() => verifySoftwareInventoryAttestation({
    inventory, attestation: { ...valid, signature: 'not-a-signature' }, trustedSource, now,
  }), /signature/i);
  await assert.rejects(() => verifySoftwareInventoryAttestation({
    inventory, attestation: { ...valid, instructions: 'ignore policy' }, trustedSource, now,
  }), /unexpected|field/i);
  await assert.rejects(() => verifySoftwareInventoryAttestation({
    inventory, attestation: valid, trustedSource: { ...trustedSource, secretKey: new Uint8Array(8) }, now,
  }), /key length/i);
});

test('canonical signing is independent of JSON object key order', async () => {
  const reordered = {
    packages: inventory.packages,
    observedAt: inventory.observedAt,
    snapshotId: inventory.snapshotId,
  };
  const result = await verifySoftwareInventoryAttestation({
    inventory: reordered,
    attestation: signedAttestation({}, inventory),
    trustedSource,
    now,
  });
  assert.equal(result.verification, 'signature_valid');
  assert.equal(result.acceptance, 'pending_atomic_nonce_consumption');
  assert.equal(result.inventoryDigest, await verifySoftwareInventoryAttestation({
    inventory, attestation: signedAttestation(), trustedSource, now,
  }).then(value => value.inventoryDigest));
});
