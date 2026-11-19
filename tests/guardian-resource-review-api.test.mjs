import test from 'node:test';
import assert from 'node:assert/strict';
import { createReviewerSessionToken, reviewerSessionCookie } from '../functions/lib/auth.mjs';
import { onRequestPatch } from '../functions/api/guardian/resources/[id].js';

const secret = 'guardian-resource-review-api-test-session-secret-long-enough';
const env = {
  AEGIS_PASSWORD: 'test-password-long-enough',
  AEGIS_SESSION_SECRET: secret,
  AEGIS_REVIEWER_PASSWORD: 'reviewer-password-long-enough',
  AEGIS_REVIEWER_SESSION_SECRET: 'guardian-reviewer-session-secret-with-enough-entropy',
};

class ReviewApiD1 {
  constructor() {
    const record = { id: 'resource-1234567890abcdef1234567890abcdef', name: 'Example service', canonicalUrl: 'https://github.com/example/service', category: 'self-hosted-service', sourceRevision: 'a'.repeat(40), licence: { identifier: 'MIT', review: 'review-required', evidenceUrl: null }, pricing: { model: 'free', limits: [], evidenceUrl: 'https://example.org/pricing', checkedAt: '2026-11-17T12:00:00.000Z' }, hosting: { mode: 'self-hosted', requirements: ['Linux'] }, limitations: [] };
    this.row = { id: record.id, owner_id: 'owner', canonical_url: record.canonicalUrl, source_revision: record.sourceRevision, record_json: JSON.stringify(record), review_status: 'draft', review_note: '', reviewer_id: null, created_at: '2026-11-17T11:00:00.000Z', updated_at: '2026-11-17T11:00:00.000Z' };
  }
  prepare(sql) {
    const db = this;
    return { values: [], bind(...values) { this.values = values; return this; },
      async first() { const [owner, id] = this.values; return sql.includes('FROM guardian_resources') && db.row.owner_id === owner && db.row.id === id ? { ...db.row } : null; },
      async run() { const [status, note, reviewer, updatedAt, id, owner, expected] = this.values; if (sql.includes('UPDATE guardian_resources') && db.row.id === id && db.row.owner_id === owner && db.row.updated_at === expected) { db.row.review_status = status; db.row.review_note = note; db.row.reviewer_id = reviewer; db.row.updated_at = updatedAt; return { meta: { changes: 1 } }; } return { meta: { changes: 0 } }; },
    };
  }
}

async function request(body, { authenticated = true, origin = 'https://aegis.example' } = {}) {
  const headers = { Origin: origin, 'Content-Type': 'application/json' };
  if (authenticated) headers.Cookie = reviewerSessionCookie(await createReviewerSessionToken(env.AEGIS_REVIEWER_SESSION_SECRET));
  return new Request('https://aegis.example/api/guardian/resources/resource-1234567890abcdef1234567890abcdef', { method: 'PATCH', headers, body: JSON.stringify(body) });
}

test('Guardian Resource review API requires authentication and same-origin writes', async () => {
  const db = new ReviewApiD1();
  const unauth = await onRequestPatch({ request: await request({}, { authenticated: false }), env: { ...env, AEGIS_DB: db }, params: { id: db.row.id } });
  assert.equal(unauth.status, 401);
  const cross = await onRequestPatch({ request: await request({}, { origin: 'https://attacker.example' }), env: { ...env, AEGIS_DB: db }, params: { id: db.row.id } });
  assert.equal(cross.status, 403);
});

test('Guardian Resource review API rejects an acceptance attempt without verified licence evidence', async () => {
  const db = new ReviewApiD1();
  const response = await onRequestPatch({ request: await request({ status: 'reviewed', note: 'Checked source and licence.', expectedUpdatedAt: db.row.updated_at }), env: { ...env, AEGIS_DB: db }, params: { id: db.row.id } });
  assert.equal(response.status, 200);
  db.row.review_status = 'reviewed';
  const accepted = await onRequestPatch({ request: await request({ status: 'accepted', note: 'Accept after review.', expectedUpdatedAt: db.row.updated_at }), env: { ...env, AEGIS_DB: db }, params: { id: db.row.id } });
  assert.equal(accepted.status, 400);
});