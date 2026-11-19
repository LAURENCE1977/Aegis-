import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken } from '../functions/lib/auth.mjs';
import { onRequestGet as listResources, onRequestPost as createResource } from '../functions/api/guardian/resources.js';

const secret = 'guardian-resource-api-test-session-secret-long-enough';
const envBase = { AEGIS_PASSWORD: 'test-password-long-enough', AEGIS_SESSION_SECRET: secret };

class ResourceApiD1 {
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
          db.rows.set(id, {
            id, owner_id: ownerId, canonical_url: canonicalUrl, source_revision: revision,
            record_json: recordJson, review_status: 'draft', created_at: createdAt,
            updated_at: updatedAt, uniqueKey: key,
          });
          db.events.push({ resource_id: id, owner_id: ownerId, event_type: 'created' });
          return { meta: { changes: 1 } };
        }
        return { meta: { changes: 0 } };
      },
      async first() {
        const [ownerId, canonicalUrl, revision] = this.values;
        const row = [...db.rows.values()].find(item =>
          item.owner_id === ownerId && item.canonical_url === canonicalUrl && item.source_revision === revision);
        return row ? { ...row } : null;
      },
      async all() {
        const [ownerId, limit] = this.values;
        return { results: [...db.rows.values()].filter(row => row.owner_id === ownerId)
          .sort((a, b) => b.updated_at.localeCompare(a.updated_at) || a.id.localeCompare(b.id))
          .slice(0, limit).map(row => ({ ...row })) };
      },
    };
  }
}

async function makeRequest(path, body, { authenticated = true, origin = 'https://aegis.example' } = {}) {
  const headers = { Origin: origin, 'Content-Type': 'application/json' };
  if (authenticated) headers.Cookie = '__Host-aegis_session=' + await createSessionToken(secret);
  return new Request('https://aegis.example' + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

const input = {
  name: 'Example self-hosted service',
  canonicalUrl: 'https://github.com/example/service',
  category: 'self-hosted-service',
  sourceRevision: 'a'.repeat(40),
  licence: { identifier: 'MIT', review: 'review-required', evidenceUrl: null },
  pricing: {
    model: 'free', limits: [], evidenceUrl: 'https://example.org/pricing',
    checkedAt: '2026-11-17T12:00:00.000Z',
  },
  hosting: { mode: 'self-hosted', requirements: ['Linux host'] },
  limitations: ['Requires operator maintenance'],
};

test('Guardian Resource API requires authentication and same-origin writes', async () => {
  const db = new ResourceApiD1();
  const unauth = await listResources({
    request: await makeRequest('/api/guardian/resources', undefined, { authenticated: false }),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(unauth.status, 401);
  const crossOrigin = await createResource({
    request: await makeRequest('/api/guardian/resources', input, { origin: 'https://attacker.example' }),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(crossOrigin.status, 403);
  assert.equal(db.rows.size, 0);
});

test('Guardian Resource API creates and lists owner-scoped draft resources', async () => {
  const db = new ResourceApiD1();
  const created = await createResource({
    request: await makeRequest('/api/guardian/resources', input),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(created.status, 201);
  const body = await created.json();
  assert.equal(body.resource.status, 'draft');

  const listed = await listResources({
    request: await makeRequest('/api/guardian/resources'),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(listed.status, 200);
  assert.equal((await listed.json()).total, 1);
});

test('Guardian Resource API rejects client identity, unknown fields and invalid query parameters', async () => {
  const db = new ResourceApiD1();
  const invalid = await createResource({
    request: await makeRequest('/api/guardian/resources', { ...input, id: 'attacker-selected-id' }),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(invalid.status, 400);
  const repeated = await listResources({
    request: await makeRequest('/api/guardian/resources?limit=5&limit=10'),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(repeated.status, 400);
});
