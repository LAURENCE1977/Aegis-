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
  assert.match(sql, /trg_learning_assessments_no_update/);
  assert.match(sql, /trg_learning_assessments_no_delete/);
  assert.match(sql, /trg_learning_assessment_events_no_update/);
  assert.match(sql, /trg_learning_assessment_events_no_delete/);
});
