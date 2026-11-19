import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Eval Forge suite migration enforces immutable owner-scoped versions and append-only events', async () => {
  const sql = await readFile(new URL('../migrations/forge/0008_eval_suites.sql', import.meta.url), 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS eval_suites/);
  assert.match(sql, /UNIQUE\s*\(owner_id, suite_id, version\)/i);
  assert.match(sql, /CHECK\s*\(json_valid\(suite_json\)\)/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS eval_suite_events/);
  assert.match(sql, /trg_eval_suite_registered/);
  assert.match(sql, /trg_eval_suites_no_update/);
  assert.match(sql, /trg_eval_suites_no_delete/);
  assert.match(sql, /trg_eval_suite_events_no_update/);
  assert.match(sql, /trg_eval_suite_events_no_delete/);
});
