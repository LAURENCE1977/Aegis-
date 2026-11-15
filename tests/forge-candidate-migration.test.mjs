import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(new URL('../migrations/shared/0005_forge_candidates.sql', import.meta.url), 'utf8');

test('Forge candidate creation, review and status changes are append-only audited', () => {
  assert.match(migration, /trg_forge_candidate_created/);
  assert.match(migration, /trg_forge_candidate_review_changed/);
  assert.match(migration, /trg_forge_candidate_status_changed/);
  assert.match(migration, /trg_forge_candidate_events_no_update/);
  assert.match(migration, /trg_forge_candidate_events_no_delete/);
  assert.match(migration, /'review_changed'/);
  assert.match(migration, /'status_changed'/);
});
