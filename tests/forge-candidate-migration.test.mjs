import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(new URL('../migrations/forge/0001_candidates.sql', import.meta.url), 'utf8');
const reviewMigration = readFileSync(new URL('../migrations/forge/0002_candidate_review.sql', import.meta.url), 'utf8');

test('Forge candidate creation, review and status changes are append-only audited', () => {
  assert.match(migration, /trg_forge_candidate_created/);
  assert.match(reviewMigration, /trg_forge_candidate_review_event/);
  assert.match(reviewMigration, /trg_forge_candidate_status_event/);
  assert.match(reviewMigration, /trg_forge_candidate_licence_gate/);
  assert.match(reviewMigration, /trg_forge_candidate_identity_immutable/);
  assert.match(migration, /trg_forge_candidate_events_no_update/);
  assert.match(migration, /trg_forge_candidate_events_no_delete/);
  assert.match(reviewMigration, /'review_changed'/);
  assert.match(reviewMigration, /'status_changed'/);
});

test('review audit is not duplicated and identity protection permits only review-history metadata changes', () => {
  assert.doesNotMatch(migration, /trg_forge_candidate_review_audit/);
  assert.match(reviewMigration, /json_remove\(OLD\.metadata_json, '\$\.licenceReviewHistory'\)/);
  assert.match(reviewMigration, /json_remove\(NEW\.metadata_json, '\$\.licenceReviewHistory'\)/);
});
