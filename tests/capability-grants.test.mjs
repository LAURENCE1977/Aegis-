import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCapabilityGrant,
  loadCapabilityGrant,
  revokeCapabilityGrant,
} from '../functions/lib/capability-grants.mjs';
import { getCapabilityManifest } from '../functions/lib/capability-registry.mjs';
import { evaluateCapabilityPolicy } from '../functions/lib/capability-policy.mjs';

class MemoryD1 {
  constructor() { this.rows = new Map(); }
  prepare(sql) {
    const db = this;
    return {
      values: [],
      bind(...values) { this.values = values; return this; },
      async run() {
        const v = this.values;
        if (sql.includes('INSERT INTO capability_grants')) {
          const [id, principal, capability, version, resource, scopes, createdBy, createdAt, expiresAt] = v;
          if ([...db.rows.values()].some(row =>
            row.principal_id === principal && row.capability_id === capability &&
            row.capability_version === version && row.resource_id === resource && row.status === 'active')) {
            throw new Error('unique constraint');
          }
          db.rows.set(id, { id, principal_id: principal, capability_id: capability,
            capability_version: version, resource_id: resource, scopes_json: scopes,
            status: 'active', created_by: createdBy, created_at: createdAt,
            expires_at: expiresAt, revoked_at: null });
          return { meta: { changes: 1 } };
        }
        if (sql.includes('UPDATE capability_grants')) {
          const [revokedAt, id, principal] = v;
          const row = db.rows.get(id);
          if (!row || row.principal_id !== principal || row.status !== 'active') return { meta: { changes: 0 } };
          row.status = 'revoked'; row.revoked_at = revokedAt;
          return { meta: { changes: 1 } };
        }
        return { meta: { changes: 0 } };
      },
      async first() {
        const v = this.values;
        if (sql.includes('WHERE principal_id')) {
          const [principal, capability, version, resource, now] = v;
          const row = [...db.rows.values()].find(item =>
            item.principal_id === principal && item.capability_id === capability &&
            item.capability_version === version && item.resource_id === resource &&
            item.status === 'active' && item.expires_at > now);
          return row ? { ...row } : null;
        }
        if (sql.includes('SELECT * FROM capability_grants WHERE id')) {
          const row = db.rows.get(v[0]);
          return row ? { ...row } : null;
        }
        return null;
      },
    };
  }
}

const valid = {
  principalId: 'owner',
  capabilityId: 'aegis-github-public-discovery',
  capabilityVersion: '0.1.0',
  resourceId: 'github:repo:LAURENCE1977/Aegis-',
  scopes: ['github:public-metadata:read'],
  createdBy: 'owner',
  expiresAt: '2027-01-01T00:00:00.000Z',
};

test('creates a bounded, exact-resource capability grant', async () => {
  const db = new MemoryD1();
  const grant = await createCapabilityGrant(db, valid, Date.parse('2026-11-15T00:00:00Z'));
  assert.equal(grant.status, 'active');
  assert.equal(grant.resourceId, valid.resourceId);
  assert.deepEqual(grant.scopes, valid.scopes);
  assert.equal(grant.principalId, 'owner');
});

test('rejects wildcard resources and malformed scopes', async () => {
  const db = new MemoryD1();
  await assert.rejects(() => createCapabilityGrant(db, { ...valid, resourceId: '*' }), /resource/i);
  await assert.rejects(() => createCapabilityGrant(db, { ...valid, scopes: ['*'] }), /scope/i);
  assert.equal(db.rows.size, 0);
});

test('rejects expired grants and grants with excessive lifetime', async () => {
  const now = Date.parse('2026-11-15T00:00:00Z');
  await assert.rejects(() => createCapabilityGrant(new MemoryD1(), {
    ...valid, expiresAt: '2026-11-14T00:00:00Z',
  }, now), /expiry/i);
  await assert.rejects(() => createCapabilityGrant(new MemoryD1(), {
    ...valid, expiresAt: '2028-01-01T00:00:00Z',
  }, now), /expiry/i);
});

test('loads only an exact active, unexpired grant for the requested resource', async () => {
  const db = new MemoryD1();
  await createCapabilityGrant(db, valid, Date.parse('2026-11-15T00:00:00Z'));
  const grant = await loadCapabilityGrant(db, {
    principalId: valid.principalId, capabilityId: valid.capabilityId,
    capabilityVersion: valid.capabilityVersion, resourceId: valid.resourceId,
  }, Date.parse('2026-11-16T00:00:00Z'));
  assert.equal(grant.status, 'active');
  assert.equal(await loadCapabilityGrant(db, {
    principalId: valid.principalId, capabilityId: valid.capabilityId,
    capabilityVersion: valid.capabilityVersion, resourceId: 'github:repo:other/project',
  }), null);
});

test('revokes a grant and makes it unavailable to Sentinel loaders', async () => {
  const db = new MemoryD1();
  const grant = await createCapabilityGrant(db, valid, Date.parse('2026-11-15T00:00:00Z'));
  assert.equal(await revokeCapabilityGrant(db, grant.id, 'owner', Date.parse('2026-11-16T00:00:00Z')), true);
  assert.equal(await loadCapabilityGrant(db, {
    principalId: valid.principalId, capabilityId: valid.capabilityId,
    capabilityVersion: valid.capabilityVersion, resourceId: valid.resourceId,
  }, Date.parse('2026-11-17T00:00:00Z')), null);
  assert.equal(await revokeCapabilityGrant(db, grant.id, 'owner'), false);
});


test('persisted grant records match the exact resource shape required by Sentinel policy', async()=>{
  const db=new MemoryD1();
  const now=Date.parse('2026-11-15T00:00:00Z');
  const grant=await createCapabilityGrant(db,valid,now);
  const manifest=getCapabilityManifest(valid.capabilityId);
  const decision=evaluateCapabilityPolicy({
    manifest,
    actionId:'discover',
    principalId:valid.principalId,
    resourceId:valid.resourceId,
    inputDigest:'sha256:'+'a'.repeat(64),
    grant,
    now,
  });
  assert.deepEqual(grant.resourceIds,[valid.resourceId]);
  assert.equal(decision.allowed,true,decision.reasonCode);
});

test('an owner can reissue a grant after revocation without reviving the old grant',async()=>{
  const db=new MemoryD1();
  const now=Date.parse('2026-11-15T00:00:00Z');
  const original=await createCapabilityGrant(db,valid,now);
  assert.equal(await revokeCapabilityGrant(db,original.id,'owner',now+1000),true);
  const renewed=await createCapabilityGrant(db,{
    ...valid,
    expiresAt:'2027-02-01T00:00:00.000Z',
  },now+2000);
  assert.notEqual(renewed.id,original.id);
  assert.equal(renewed.status,'active');
  assert.equal(await loadCapabilityGrant(db,{
    principalId:valid.principalId,
    capabilityId:valid.capabilityId,
    capabilityVersion:valid.capabilityVersion,
    resourceId:valid.resourceId,
  },now+3000).then(item=>item.id),renewed.id);
  assert.equal(db.rows.size,2);
});

test('requires a trusted owner actor and strict input fields', async () => {
  await assert.rejects(() => createCapabilityGrant(new MemoryD1(), {
    ...valid, createdBy: 'agent:planner',
  }), /owner/i);
  await assert.rejects(() => createCapabilityGrant(new MemoryD1(), {
    ...valid, admin: true,
  }), /field/i);
});
test('a principal cannot revoke another owner\'s capability grant', async () => {
  const db = new MemoryD1();
  const now = Date.parse('2026-11-15T00:00:00Z');
  const grant = await createCapabilityGrant(db, valid, now);
  assert.equal(await revokeCapabilityGrant(db, grant.id, 'other-owner', now + 1000), false);
  assert.equal(await loadCapabilityGrant(db, {
    principalId: valid.principalId,
    capabilityId: valid.capabilityId,
    capabilityVersion: valid.capabilityVersion,
    resourceId: valid.resourceId,
  }, now + 2000).then(Boolean), true);
  assert.equal(await revokeCapabilityGrant(db, grant.id, 'owner', now + 3000), true);
});
