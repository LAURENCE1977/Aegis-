import test from 'node:test';
import assert from 'node:assert/strict';
import { createGuardianResource, listGuardianResources } from '../functions/lib/guardian-catalogue.mjs';

class GuardianResourceD1 {
  constructor() { this.rows = new Map(); this.events = []; }
  prepare(sql) {
    const db = this;
    return {
      values: [],
      bind(...values) { this.values = values; return this; },
      async run() {
        const v = this.values;
        if (sql.includes('INSERT INTO guardian_resources')) {
          const [id, ownerId, canonicalUrl, revision, recordJson, createdAt, updatedAt] = v;
          const key = ownerId + '|' + canonicalUrl + '|' + revision;
          if ([...db.rows.values()].some(row => row.uniqueKey === key)) return { meta: { changes: 0 } };
          const row = {
            id, owner_id: ownerId, canonical_url: canonicalUrl, source_revision: revision,
            record_json: recordJson, review_status: 'draft', created_at: createdAt,
            updated_at: updatedAt, uniqueKey: key,
          };
          db.rows.set(id, row);
          db.events.push({ resource_id: id, owner_id: ownerId, event_type: 'created' });
          return { meta: { changes: 1 } };
        }
        return { meta: { changes: 0 } };
      },
      async first() {
        const v = this.values;
        if (sql.includes('FROM guardian_resources') && sql.includes('canonical_url = ?')) {
          const row = [...db.rows.values()].find(item =>
            item.owner_id === v[0] && item.canonical_url === v[1] && item.source_revision === v[2]);
          return row ? { ...row } : null;
        }
        return null;
      },
      async all() {
        const [ownerId, limit] = this.values;
        return { results: [...db.rows.values()]
          .filter(row => row.owner_id === ownerId)
          .sort((a, b) => b.updated_at.localeCompare(a.updated_at) || a.id.localeCompare(b.id))
          .slice(0, limit).map(row => ({ ...row })) };
      },
    };
  }
}

const input = () => ({
  name: 'Example self-hosted service',
  canonicalUrl: 'https://github.com/example/service',
  category: 'self-hosted-service',
  sourceRevision: 'a'.repeat(40),
  licence: { identifier: 'MIT', review: 'review-required', evidenceUrl: null },
  pricing: {
    model: 'free',
    limits: [],
    evidenceUrl: 'https://example.org/pricing',
    checkedAt: '2026-11-17T12:00:00.000Z',
  },
  hosting: { mode: 'self-hosted', requirements: ['Linux host'] },
  limitations: ['Requires operator maintenance'],
});

test('creates an owner-scoped draft resource with server-generated identity and append-only creation event', async () => {
  const db = new GuardianResourceD1();
  const result = await createGuardianResource(db, 'owner', input(), Date.parse('2026-11-17T12:00:00.000Z'));
  assert.equal(result.created, true);
  assert.match(result.resource.id, /^resource-[a-f0-9]{32}$/);
  assert.equal(result.resource.name, 'Example self-hosted service');
  assert.equal(result.resource.status, 'draft');
  assert.equal(db.events.length, 1);
  assert.equal(db.events[0].event_type, 'created');
});

test('resource creation is idempotent for the same owner, canonical URL and source revision', async () => {
  const db = new GuardianResourceD1();
  const first = await createGuardianResource(db, 'owner', input());
  const second = await createGuardianResource(db, 'owner', input());
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(second.resource.id, first.resource.id);
  assert.equal(db.rows.size, 1);
  assert.equal(db.events.length, 1);
});

test('resource lists are isolated to the authenticated owner', async () => {
  const db = new GuardianResourceD1();
  await createGuardianResource(db, 'owner', input());
  await createGuardianResource(db, 'another-owner', {
    ...input(), canonicalUrl: 'https://github.com/example/other',
  });
  const records = await listGuardianResources(db, 'owner');
  assert.equal(records.length, 1);
  assert.equal(records[0].ownerId, 'owner');
});

test('rejects invalid resources before attempting persistence', async () => {
  const db = new GuardianResourceD1();
  await assert.rejects(() => createGuardianResource(db, 'owner', {
    ...input(), canonicalUrl: 'javascript:alert(1)',
  }), /URL/i);
  assert.equal(db.rows.size, 0);
});

test('resource list enforces a bounded page size', async () => {
  await assert.rejects(() => listGuardianResources(new GuardianResourceD1(), 'owner', 101), /limit/i);
});
