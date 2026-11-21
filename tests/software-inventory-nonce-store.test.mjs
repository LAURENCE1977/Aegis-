import test from 'node:test';
import assert from 'node:assert/strict';
import { consumeSoftwareInventoryNonce } from '../workers/runtime/software-inventory-nonce-store.mjs';

const verified = {
  schemaVersion: 'aegis.software-inventory-signature-verification.v1',
  ownerId: 'owner-a',
  sourceId: 'endpoint-agent-01',
  keyId: 'key-2026-01',
  snapshotId: 'snapshot-001',
  signedAt: '2026-11-21T13:56:00.000Z',
  nonce: 'nonce-0000000000000001',
  inventoryDigest: 'sha256:' + 'a'.repeat(64),
  verification: 'signature_valid',
  acceptance: 'pending_atomic_nonce_consumption',
};
const now = '2026-11-21T14:00:00.000Z';

class FakeD1 {
  constructor() { this.rows = new Map(); this.sql = []; }
  prepare(sql) {
    const db = this;
    return {
      bind(...values) {
        return {
          async run() {
            db.sql.push({ sql, values });
            const [ownerId, sourceId, nonce, keyId, snapshotId, digest, signedAt, acceptedAt] = values;
            const key = JSON.stringify([ownerId, sourceId, nonce]);
            if (db.rows.has(key)) return { success: true, meta: { changes: 0 } };
            db.rows.set(key, { ownerId, sourceId, nonce, keyId, snapshotId, digest, signedAt, acceptedAt });
            return { success: true, meta: { changes: 1 } };
          },
        };
      },
    };
  }
}

test('atomically consumes a verified source nonce once and returns metadata only', async () => {
  const db = new FakeD1();
  const result = await consumeSoftwareInventoryNonce({ db, verifiedAttestation: verified, now });

  assert.equal(result.status, 'accepted');
  assert.equal(result.ownerId, verified.ownerId);
  assert.equal(result.sourceId, verified.sourceId);
  assert.equal(result.snapshotId, verified.snapshotId);
  assert.equal(result.inventoryDigest, verified.inventoryDigest);
  assert.equal(result.acceptedAt, now);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(JSON.stringify(result).includes('secretKey'), false);
  assert.equal(db.rows.size, 1);
  assert.match(db.sql[0].sql, /ON CONFLICT\s*\(owner_id, source_id, nonce\) DO NOTHING/i);
});

test('rejects replay of the same nonce even if the replay carries altered snapshot metadata', async () => {
  const db = new FakeD1();
  await consumeSoftwareInventoryNonce({ db, verifiedAttestation: verified, now });
  const replay = await consumeSoftwareInventoryNonce({
    db,
    verifiedAttestation: { ...verified, snapshotId: 'snapshot-tampered', inventoryDigest: 'sha256:' + 'b'.repeat(64) },
    now,
  });

  assert.equal(replay.status, 'replay_rejected');
  assert.equal(replay.accepted, false);
  assert.equal(db.rows.size, 1);
});

test('nonce uniqueness is scoped to both owner and source identity', async () => {
  const db = new FakeD1();
  const first = await consumeSoftwareInventoryNonce({ db, verifiedAttestation: verified, now });
  const otherOwner = await consumeSoftwareInventoryNonce({
    db, verifiedAttestation: { ...verified, ownerId: 'owner-b' }, now,
  });
  const otherSource = await consumeSoftwareInventoryNonce({
    db, verifiedAttestation: { ...verified, sourceId: 'endpoint-agent-02' }, now,
  });

  assert.equal(first.status, 'accepted');
  assert.equal(otherOwner.status, 'accepted');
  assert.equal(otherSource.status, 'accepted');
  assert.equal(db.rows.size, 3);
});

test('fails closed unless the signature verifier marked the exact pending acceptance state', async () => {
  const db = new FakeD1();
  for (const invalid of [
    { ...verified, verification: 'unverified' },
    { ...verified, acceptance: 'accepted' },
    { ...verified, authority: { response: 'authorised' } },
    { ...verified, inventoryDigest: 'bad-digest' },
    { ...verified, nonce: 'short' },
    { ...verified, ownerId: '../other-owner' },
  ]) {
    await assert.rejects(
      () => consumeSoftwareInventoryNonce({ db, verifiedAttestation: invalid, now }),
    );
  }
  assert.equal(db.rows.size, 0);
});

test('requires a D1 binding and canonical acceptance timestamp', async () => {
  await assert.rejects(() => consumeSoftwareInventoryNonce({
    db: null, verifiedAttestation: verified, now,
  }), /D1/i);
  await assert.rejects(() => consumeSoftwareInventoryNonce({
    db: new FakeD1(), verifiedAttestation: verified, now: 'not-a-time',
  }), /timestamp/i);
});
