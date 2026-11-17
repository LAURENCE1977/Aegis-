import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Learning Forge migration enforces immutable owner-scoped graph versions and append-only events', async () => {
  const sql = await readFile(new URL('../migrations/forge/0010_learning_paths.sql', import.meta.url), 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS learning_paths/);
  assert.match(sql, /UNIQUE\s*\(owner_id, path_id, version\)/i);
  assert.match(sql, /CHECK\s*\(json_valid\(graph_json\)\)/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS learning_path_events/);
  assert.match(sql, /trg_learning_path_registered/);
  assert.match(sql, /trg_learning_paths_no_update/);
  assert.match(sql, /trg_learning_paths_no_delete/);
  assert.match(sql, /trg_learning_path_events_no_update/);
  assert.match(sql, /trg_learning_path_events_no_delete/);
});
