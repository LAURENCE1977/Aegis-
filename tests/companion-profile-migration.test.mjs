import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Companion Profile migration stores immutable owner-scoped profile revisions and selection history', async () => {
  const sql = await readFile(new URL('../migrations/companion/0001_companion_profiles.sql', import.meta.url), 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS companion_profiles/);
  assert.match(sql, /UNIQUE\s*\(owner_id, profile_id, version\)/i);
  assert.match(sql, /CHECK\s*\(json_valid\(profile_json\)\)/i);
  assert.match(sql, /json_extract\(profile_json, '\$\.kind'\) = 'custom'/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS companion_profile_preferences/);
  assert.match(sql, /FOREIGN KEY\s*\(owner_id, active_profile_id, active_profile_version\)/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS companion_profile_events/);
  assert.match(sql, /trg_companion_profile_registered/);
  assert.match(sql, /trg_companion_profiles_no_update/);
  assert.match(sql, /trg_companion_profiles_no_delete/);
  assert.match(sql, /trg_companion_profile_events_no_update/);
  assert.match(sql, /trg_companion_profile_events_no_delete/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS companion_profile_purge_authorizations/);
  assert.match(sql, /expires_at > strftime\('%Y-%m-%dT%H:%M:%fZ', 'now'\)/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS companion_profile_purge_events/);
  assert.match(sql, /purged_profiles_count INTEGER NOT NULL CHECK/);
  assert.match(sql, /trg_companion_profile_purge_events_no_update/);
  assert.match(sql, /trg_companion_profile_purge_events_no_delete/);
});

test('Companion Profile migration contains executable SQL line breaks, not escaped newline text', async () => {
  const sql = await readFile(new URL('../migrations/companion/0001_companion_profiles.sql', import.meta.url), 'utf8');
  assert.equal(sql.includes('\\n'), false, 'migration must not contain literal backslash-n sequences');
});
