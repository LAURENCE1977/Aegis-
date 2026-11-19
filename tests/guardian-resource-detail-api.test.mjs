import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken } from '../functions/lib/auth.mjs';
import { onRequestGet } from '../functions/api/guardian/resources/[id].js';

const secret = 'guardian-resource-detail-api-test-session-secret-long-enough';
const envBase = { AEGIS_PASSWORD: 'test-password-long-enough', AEGIS_SESSION_SECRET: secret };
const resourceId = 'resource-1234567890abcdef1234567890abcdef';

class GuardianDetailD1 {
  constructor() {
    this.resource = {
      id: resourceId,
      owner_id: 'owner',
      canonical_url: 'https://github.com/example/service',
      source_revision: 'a'.repeat(40),
      record_json: JSON.stringify({
        id: resourceId,
        name: 'Example service',
        canonicalUrl: 'https://github.com/example/service',
        category: 'self-hosted-service',
        sourceRevision: 'a'.repeat(40),
        licence: { identifier: 'MIT', review: 'review-required', evidenceUrl: null },
        pricing: { model: 'free', limits: [], evidenceUrl: 'https://example.org/pricing', checkedAt: '2026-11-18T12:00:00.000Z' },
        hosting: { mode: 'self-hosted', requirements: ['Linux'] },
        limitations: [],
      }),
      review_status: 'draft',
      review_note: '',
      reviewer_id: null,
      created_at: '2026-11-18T10:00:00.000Z',
      updated_at: '2026-11-18T10:00:00.000Z',
    };
    this.events = [
      { id: 'created:' + resourceId, resource_id: resourceId, owner_id: 'owner', event_type: 'created', detail_json: '{"sourceRevision":"' + 'a'.repeat(40) + '","reviewStatus":"draft"}', occurred_at: '2026-11-18T10:00:00.000Z' },
      { id: 'review:' + resourceId, resource_id: resourceId, owner_id: 'owner', event_type: 'reviewed', detail_json: '{"fromStatus":"draft","toStatus":"reviewed","reviewerId":"owner","note":"Reviewed source"}', occurred_at: '2026-11-18T11:00:00.000Z' },
    ];
  }

  prepare(sql) {
    const db = this;
    return {
      values: [],
      bind(...values) { this.values = values; return this; },
      async first() {
        const [ownerId, id] = this.values;
        if (sql.includes('FROM guardian_resources') && ownerId === db.resource.owner_id && id === db.resource.id) return { ...db.resource };
        return null;
      },
      async all() {
        const [ownerId, id, limit] = this.values;
        if (!sql.includes('FROM guardian_resource_events')) return { results: [] };
        return { results: db.events
          .filter(event => event.owner_id === ownerId && event.resource_id === id)
          .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at) || b.id.localeCompare(a.id))
          .slice(0, limit).map(event => ({ ...event })) };
      },
    };
  }
}

async function makeRequest(path, { authenticated = true, origin = 'https://aegis.example' } = {}) {
  const headers = { Origin: origin };
  if (authenticated) headers.Cookie = '__Host-aegis_session=' + await createSessionToken(secret);
  return new Request('https://aegis.example' + path, { method: 'GET', headers });
}

test('Guardian Resource detail requires an authenticated owner session', async () => {
  const db = new GuardianDetailD1();
  const response = await onRequestGet({
    request: await makeRequest('/api/guardian/resources/' + resourceId, { authenticated: false }),
    env: { ...envBase, AEGIS_DB: db },
    params: { id: resourceId },
  });
  assert.equal(response.status, 401);
});

test('Guardian Resource detail returns the owner resource and ordered append-only event history', async () => {
  const db = new GuardianDetailD1();
  const response = await onRequestGet({
    request: await makeRequest('/api/guardian/resources/' + resourceId),
    env: { ...envBase, AEGIS_DB: db },
    params: { id: resourceId },
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.resource.id, resourceId);
  assert.equal(body.resource.status, 'draft');
  assert.deepEqual(body.events.map(event => event.eventType), ['created', 'reviewed']);
  assert.equal(body.events[1].detail.note, 'Reviewed source');
  assert.equal(body.events[1].reviewerId, 'owner');
});

test('Guardian Resource detail returns 404 for missing or non-owner resources', async () => {
  const db = new GuardianDetailD1();
  const response = await onRequestGet({
    request: await makeRequest('/api/guardian/resources/resource-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
    env: { ...envBase, AEGIS_DB: db },
    params: { id: 'resource-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
  });
  assert.equal(response.status, 404);
});

test('Guardian Resource detail validates event limits and rejects repeated query parameters', async () => {
  const db = new GuardianDetailD1();
  for (const path of [
    '/api/guardian/resources/' + resourceId + '?eventLimit=0',
    '/api/guardian/resources/' + resourceId + '?eventLimit=2&eventLimit=3',
    '/api/guardian/resources/' + resourceId + '?unexpected=true',
  ]) {
    const response = await onRequestGet({
      request: await makeRequest(path),
      env: { ...envBase, AEGIS_DB: db },
      params: { id: resourceId },
    });
    assert.equal(response.status, 400);
  }
});

test('Guardian Resource detail bounds event history returned to the caller', async () => {
  const db = new GuardianDetailD1();
  const response = await onRequestGet({
    request: await makeRequest('/api/guardian/resources/' + resourceId + '?eventLimit=1'),
    env: { ...envBase, AEGIS_DB: db },
    params: { id: resourceId },
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.events.length, 1);
  assert.equal(body.events[0].eventType, 'reviewed', 'bounded history should retain the newest event');
});


test('Guardian Resource detail fails closed when stored audit metadata contains unexpected fields', async () => {
  const db = new GuardianDetailD1();
  db.events[0].detail_json = JSON.stringify({
    sourceRevision: 'a'.repeat(40), reviewStatus: 'draft', unexpected: 'must not be exposed',
  });
  const response = await onRequestGet({
    request: await makeRequest('/api/guardian/resources/' + resourceId),
    env: { ...envBase, AEGIS_DB: db },
    params: { id: resourceId },
  });
  assert.equal(response.status, 503, 'stored audit corruption is a server integrity failure, not a client input error');
  assert.doesNotMatch(await response.text(), /must not be exposed/);
});
