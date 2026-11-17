import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Guardian resource migration enforces owner/source uniqueness and append-only events', async () => {
  const sql = await readFile(new URL('../migrations/forge/0006_guardian_resources.sql', import.meta.url), 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS guardian_resources/);
  assert.match(sql, /UNIQUE\s*\(owner_id, canonical_url, source_revision\)/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS guardian_resource_events/);
  assert.match(sql, /trg_guardian_resource_events_no_update/);
  assert.match(sql, /trg_guardian_resource_events_no_delete/);
  assert.match(sql, /trg_guardian_resource_created/);
});
