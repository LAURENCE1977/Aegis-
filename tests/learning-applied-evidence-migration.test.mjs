import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Learning applied-task evidence stores digest-only receipts and append-only submission/withdrawal events', async () => {
  const sql = await readFile(new URL('../migrations/forge/0014_learning_applied_task_evidence.sql', import.meta.url), 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS learning_applied_task_evidence/);
  assert.match(sql, /artifact_digest TEXT NOT NULL CHECK/);
  assert.match(sql, /byte_length INTEGER NOT NULL CHECK/);
  assert.match(sql, /FOREIGN KEY \(owner_id, path_id, path_version\)\s*REFERENCES learning_paths/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS learning_applied_task_evidence_events/);
  assert.match(sql, /trg_learning_applied_evidence_created/);
  assert.match(sql, /trg_learning_applied_evidence_node_limit/);
  assert.match(sql, /trg_learning_applied_evidence_owner_limit/);
  assert.match(sql, /trg_learning_applied_evidence_no_update/);
  assert.match(sql, /trg_learning_applied_evidence_withdrawn/);
  assert.match(sql, /trg_learning_applied_evidence_events_no_update/);
  assert.match(sql, /trg_learning_applied_evidence_events_no_delete/);
  assert.doesNotMatch(sql, /artifact_blob|file_contents|raw_payload/i);
});
