import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Eval Forge run migration binds immutable run history to registered suite versions', async () => {
  const sql = await readFile(new URL('../migrations/forge/0009_eval_runs.sql', import.meta.url), 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS eval_runs/);
  assert.match(sql, /FOREIGN KEY\s*\(owner_id, suite_id, suite_version\)\s*REFERENCES eval_suites/i);
  assert.match(sql, /CHECK\s*\(evidence_verified = 1\)/i);
  assert.match(sql, /json_extract\(result_json, '\$\.evidenceVerified'\) = 1/i);
  assert.match(sql, /json_extract\(result_json, '\$\.candidateDigest'\) = candidate_digest/i);
  assert.match(sql, /UNIQUE\s*\(owner_id, run_id\)/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS eval_run_events/);
  assert.match(sql, /trg_eval_run_recorded/);
  assert.match(sql, /trg_eval_runs_no_update/);
  assert.match(sql, /trg_eval_runs_no_delete/);
  assert.match(sql, /trg_eval_run_events_no_update/);
  assert.match(sql, /trg_eval_run_events_no_delete/);
});
