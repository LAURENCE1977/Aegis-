import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appendExperimentProposalReview,
  listExperimentProposalReviews,
} from '../workers/runtime/experiment-proposal-review-store.mjs';

class FakeD1 {
  constructor() { this.events = new Map(); }
  prepare(sql) {
    const db = this;
    let values = [];
    return {
      bind(...args) {
        values = args;
        return {
          async run() {
            if (!sql.startsWith('INSERT INTO experiment_proposal_review_events')) {
              throw new Error('Unexpected SQL: ' + sql);
            }
            const [eventId, principalId, proposalId, decision, note, firstRecordId, lastRecordId, workloadDigest, createdAt] = values;
            const key = principalId + ':' + eventId;
            if (db.events.has(key)) return { meta: { changes: 0 } };
            db.events.set(key, {
              event_id: eventId, principal_id: principalId, proposal_id: proposalId,
              decision, note, first_record_id: firstRecordId, last_record_id: lastRecordId,
              workload_digest: workloadDigest, created_at: createdAt,
            });
            return { meta: { changes: 1 } };
          },
          async first() {
            const [principalId, eventId] = values;
            return db.events.get(principalId + ':' + eventId) || null;
          },
          async all() {
            const [principalId, proposalId, limit] = values;
            return {
              results: [...db.events.values()]
                .filter((event) => event.principal_id === principalId &&
                  (proposalId === null || event.proposal_id === proposalId))
                .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.event_id.localeCompare(a.event_id))
                .slice(0, limit),
            };
          },
        };
      },
    };
  }
}

const review = {
  eventId: 'review-event-0001',
  proposalId: 'proposal:benchmark:aaaaaaaaaaaa:candidate-a:old:new',
  decision: 'accepted_for_further_review',
  note: 'Please inspect the underlying benchmark evidence.',
  firstRecordId: 'record-old',
  lastRecordId: 'record-new',
  workloadDigest: 'sha256:' + 'a'.repeat(64),
  createdAt: '2026-11-21T09:00:00.000Z',
};

test('appends an owner-scoped review event with evidence lineage', async () => {
  const db = new FakeD1();
  const result = await appendExperimentProposalReview(db, 'owner', review);
  assert.equal(result.created, true);
  assert.equal(result.review.ownerId, 'owner');
  assert.equal(result.review.proposalId, review.proposalId);
  assert.equal(result.review.decision, 'accepted_for_further_review');
  assert.equal(result.review.approvalGranted, false);
  assert.equal(result.review.execution, 'not_authorised');
  assert.equal((await listExperimentProposalReviews(db, 'owner', review.proposalId)).length, 1);
});

test('is idempotent for the same event and rejects event ID reuse with different content', async () => {
  const db = new FakeD1();
  assert.equal((await appendExperimentProposalReview(db, 'owner', review)).created, true);
  assert.equal((await appendExperimentProposalReview(db, 'owner', review)).created, false);
  assert.equal((await appendExperimentProposalReview(db, 'owner', { ...review, createdAt: '2026-11-21T09:01:00.000Z' })).created, false);
  await assert.rejects(
    () => appendExperimentProposalReview(db, 'owner', { ...review, note: 'Changed decision note.' }),
    /different immutable content/i,
  );
  assert.equal(db.events.size, 1);
});

test('rejects invalid decisions, unsafe notes, malformed lineage and caller-selected owner', async () => {
  const db = new FakeD1();
  await assert.rejects(() => appendExperimentProposalReview(db, 'owner', { ...review, decision: 'approved' }), /decision/i);
  await assert.rejects(() => appendExperimentProposalReview(db, 'owner', { ...review, note: '   ' }), /note/i);
  await assert.rejects(() => appendExperimentProposalReview(db, 'owner', { ...review, workloadDigest: 'bad' }), /digest/i);
  await assert.rejects(() => appendExperimentProposalReview(db, 'owner', { ...review, ownerId: 'attacker' }), /owner/i);
  assert.equal(db.events.size, 0);
});

test('isolates review history by owner and validates pagination bounds', async () => {
  const db = new FakeD1();
  await appendExperimentProposalReview(db, 'owner', review);
  assert.equal((await listExperimentProposalReviews(db, 'other-owner')).length, 0);
  await assert.rejects(() => listExperimentProposalReviews(db, 'owner', null, { limit: 101 }), /limit/i);
});

test('returns review events in immutable chronological order', async () => {
  const db = new FakeD1();
  await appendExperimentProposalReview(db, 'owner', review);
  await appendExperimentProposalReview(db, 'owner', {
    ...review, eventId: 'review-event-0002', decision: 'needs_more_evidence',
    createdAt: '2026-11-21T10:00:00.000Z',
  });
  const events = await listExperimentProposalReviews(db, 'owner', review.proposalId);
  assert.deepEqual(events.map((event) => event.decision), [
    'needs_more_evidence', 'accepted_for_further_review',
  ]);
});
