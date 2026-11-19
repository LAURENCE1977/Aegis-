import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Learning Assessment migration binds immutable assessments to exact learning paths and append-only events', async () => {
  const sql = await readFile(new URL('../migrations/forge/0012_learning_assessments.sql', import.meta.url), 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS learning_assessments/);
  assert.match(sql, /UNIQUE\s*\(owner_id, assessment_id, version\)/i);
  assert.match(sql, /FOREIGN KEY\s*\(owner_id, path_id, path_version\)\s*REFERENCES learning_paths/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS learning_assessment_events/);
  assert.match(sql, /trg_learning_assessment_registered/);
  assert.match(sql, /trg_learning_assessment_node_binding/);
  assert.match(sql, /json_extract\(assessment_json, '\$\.id'\) = assessment_id/i);
  assert.match(sql, /json_extract\(assessment_json, '\$\.pathVersion'\) = path_version/i);
  assert.match(sql, /trg_learning_assessments_no_update/);
  assert.match(sql, /trg_learning_assessments_no_delete/);
  assert.match(sql, /trg_learning_assessment_events_no_update/);
  assert.match(sql, /trg_learning_assessment_events_no_delete/);
});


test('Learning Attempt migration enforces exact assessment binding, private results, rate limits and immutable history', async () => {
  const sql = await readFile(new URL('../migrations/forge/0013_learning_assessment_attempts.sql', import.meta.url), 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS learning_assessment_attempts/);
  assert.match(sql, /UNIQUE\s*\(owner_id, id\)/i);
  assert.match(sql, /FOREIGN KEY\s*\(owner_id, assessment_id, assessment_version\)\s*REFERENCES learning_assessments/i);
  assert.doesNotMatch(sql, /attempt_digest/i);
  assert.match(sql, /mastery_verified INTEGER NOT NULL DEFAULT 0 CHECK \(mastery_verified = 0\)/i);
  assert.match(sql, /trg_learning_assessment_attempt_identity/);
  assert.match(sql, /trg_learning_assessment_attempt_rate_limit/);
  assert.match(sql, /900\.0 \/ 86400\.0/);
  assert.match(sql, /30\.0 \/ 86400\.0/);
  assert.match(sql, /trg_learning_assessment_attempt_submitted/);
  assert.match(sql, /trg_learning_assessment_attempts_no_update/);
  assert.match(sql, /trg_learning_assessment_attempts_no_delete/);
  assert.match(sql, /trg_learning_assessment_attempt_events_no_update/);
  assert.match(sql, /trg_learning_assessment_attempt_events_no_delete/);
});
