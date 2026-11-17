import test from 'node:test';
import assert from 'node:assert/strict';
import { updateGuardianResourceReview } from '../functions/lib/guardian-catalogue.mjs';

const record = (licenceReview = 'review-required', evidenceUrl = null) => ({
  id: 'resource-1234567890abcdef1234567890abcdef',
  name: 'Example service', canonicalUrl: 'https://github.com/example/service',
  category: 'self-hosted-service', sourceRevision: 'a'.repeat(40),
  licence: { identifier: 'MIT', review: licenceReview, evidenceUrl },
  pricing: { model: 'free', limits: [], evidenceUrl: 'https://example.org/pricing', checkedAt: '2026-11-17T12:00:00.000Z' },
  hosting: { mode: 'self-hosted', requirements: ['Linux'] }, limitations: [],
});

class ReviewD1 {
  constructor(value = record()) {
    this.row = { id: value.id, owner_id: 'owner', canonical_url: value.canonicalUrl, source_revision: value.sourceRevision, record_json: JSON.stringify(value), review_status: 'draft', review_note: '', reviewer_id: null, created_at: '2026-11-17T11:00:00.000Z', updated_at: '2026-11-17T11:00:00.000Z' };
    this.events = [];
  }
  prepare(sql) {
    const db = this;
    return {
      values: [], bind(...values) { this.values = values; return this; },
      async first() {
        const [ownerId, id] = this.values;
        if (sql.includes('FROM guardian_resources') && sql.includes('owner_id = ?') && sql.includes('id = ?')) return db.row && db.row.owner_id === ownerId && db.row.id === id ? { ...db.row } : null;
        return null;
      },
      async run() {
        if (sql.includes('UPDATE guardian_resources')) {
          const [status, note, reviewer, updatedAt, id, ownerId, expected] = this.values;
          if (!db.row || db.row.id !== id || db.row.owner_id !== ownerId || db.row.updated_at !== expected) return { meta: { changes: 0 } };
          const from = db.row.review_status;
          db.row.review_status = status; db.row.review_note = note; db.row.reviewer_id = reviewer; db.row.updated_at = updatedAt;
          db.events.push({ event_type: status, from, to: status, note, reviewer, occurred_at: updatedAt });
          return { meta: { changes: 1 } };
        }
        return { meta: { changes: 0 } };
      },
    };
  }
}

const input = (status, overrides = {}) => ({ status, note: 'Reviewed against upstream evidence.', expectedUpdatedAt: '2026-11-17T11:00:00.000Z', ...overrides });

test('resource review moves draft to reviewed and appends an attributable event', async () => {
  const db = new ReviewD1();
  const result = await updateGuardianResourceReview(db, 'owner', 'resource-1234567890abcdef1234567890abcdef', input('reviewed'), Date.parse('2026-11-17T12:00:00.000Z'));
  assert.equal(result.status, 'reviewed');
  assert.equal(result.reviewNote, 'Reviewed against upstream evidence.');
  assert.equal(result.reviewerId, 'owner');
  assert.equal(db.events.length, 1);
  assert.equal(db.events[0].event_type, 'reviewed');
});

test('resource acceptance is blocked until licence verification and HTTPS evidence exist', async () => {
  const db = new ReviewD1();
  db.row.review_status = 'reviewed';
  db.row.updated_at = '2026-11-17T11:00:00.000Z';
  await assert.rejects(() => updateGuardianResourceReview(db, 'owner', db.row.id, input('accepted'), Date.parse('2026-11-17T12:00:00.000Z')), /licence evidence/i);
  assert.equal(db.row.review_status, 'reviewed');
});

test('resource acceptance succeeds only with verified licence evidence', async () => {
  const db = new ReviewD1(record('verified', 'https://opensource.org/license/mit/'));
  db.row.review_status = 'reviewed'; db.row.updated_at = '2026-11-17T11:00:00.000Z';
  const result = await updateGuardianResourceReview(db, 'owner', db.row.id, input('accepted'), Date.parse('2026-11-17T12:00:00.000Z'));
  assert.equal(result.status, 'accepted');
});

test('review transitions reject stale timestamps, invalid transitions, and empty notes', async () => {
  const db = new ReviewD1();
  await assert.rejects(() => updateGuardianResourceReview(db, 'owner', db.row.id, input('reviewed', { expectedUpdatedAt: '2026-11-17T10:00:00.000Z' }), Date.parse('2026-11-17T12:00:00.000Z')), /conflict/i);
  await assert.rejects(() => updateGuardianResourceReview(db, 'owner', db.row.id, input('accepted'), Date.parse('2026-11-17T12:00:00.000Z')), /transition/i);
  await assert.rejects(() => updateGuardianResourceReview(db, 'owner', db.row.id, input('reviewed', { note: ' ' }), Date.parse('2026-11-17T12:00:00.000Z')), /note/i);
});

test('review transitions are owner-scoped and archived resources are terminal', async () => {
  const db = new ReviewD1();
  await assert.rejects(() => updateGuardianResourceReview(db, 'other-owner', db.row.id, input('reviewed'), Date.parse('2026-11-17T12:00:00.000Z')), /not found/i);
  db.row.review_status = 'archived';
  await assert.rejects(() => updateGuardianResourceReview(db, 'owner', db.row.id, input('reviewed'), Date.parse('2026-11-17T12:00:00.000Z')), /transition/i);
});

test('review note and input fields are strictly bounded', async () => {
  const db = new ReviewD1();
  await assert.rejects(() => updateGuardianResourceReview(db, 'owner', db.row.id, input('reviewed', { extra: true }), Date.parse('2026-11-17T12:00:00.000Z')), /unexpected/i);
  await assert.rejects(() => updateGuardianResourceReview(db, 'owner', db.row.id, input('reviewed', { note: 'x'.repeat(2001) }), Date.parse('2026-11-17T12:00:00.000Z')), /note/i);
});