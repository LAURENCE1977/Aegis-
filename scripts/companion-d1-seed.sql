INSERT INTO companion_profiles (
  id, owner_id, profile_id, version, profile_digest, profile_json, created_at
) VALUES (
  'companion-profile-smoke', 'owner', 'custom-smoke', 1,
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  '{"schemaVersion":1,"id":"custom-smoke","kind":"custom","displayName":"Smoke Companion"}',
  '2026-11-17T12:00:00.000Z'
);

INSERT INTO companion_profile_preferences (
  owner_id, active_profile_id, active_profile_version, updated_at
) VALUES ('owner', 'custom-smoke', 1, '2026-11-17T12:00:00.000Z');

