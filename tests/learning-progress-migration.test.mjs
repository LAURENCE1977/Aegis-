import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Learning Progress migration binds append-only progress to immutable path versions', async () => {
  const sql = await readFile(new URL('../migrations/forge/0011_learning_progress.sql', import.meta.url), 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS learning_progress/);
  assert.match(sql, /PRIMARY KEY\s*\(owner_id, path_id, path_version, node_id\)/i);
  assert.match(sql, /FOREIGN KEY\s*\(owner_id, path_id, path_version\)\s*REFERENCES learning_paths/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS learning_progress_events/);
  assert.match(sql, /trg_learning_progress_created/);
  assert.match(sql, /trg_learning_progress_transition/);
  assert.match(sql, /trg_learning_progress_prerequisites_insert/);
  assert.match(sql, /trg_learning_progress_prerequisites_update/);
  assert.match(sql, /trg_learning_progress_no_delete/);
  assert.match(sql, /trg_learning_progress_events_no_update/);
  assert.match(sql, /trg_learning_progress_events_no_delete/);
});
