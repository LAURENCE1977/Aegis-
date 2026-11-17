PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS companion_profiles (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL,
  profile_id TEXT NOT NULL CHECK (
    length(profile_id) BETWEEN 8 AND 70 AND substr(profile_id, 1, 7) = 'custom-'
  ),
  version INTEGER NOT NULL CHECK (version >= 1),
  profile_digest TEXT NOT NULL CHECK (
    length(profile_digest) = 64 AND profile_digest NOT GLOB '*[^a-f0-9]*'
  ),
  profile_json TEXT NOT NULL CHECK (json_valid(profile_json)),
  created_at TEXT NOT NULL,
  CHECK (json_extract(profile_json, '$.schemaVersion') = 1),
  CHECK (json_extract(profile_json, '$.id') = profile_id),
  CHECK (json_extract(profile_json, '$.kind') = 'custom'),
  UNIQUE (owner_id, profile_id, version)
);

CREATE INDEX IF NOT EXISTS idx_companion_profiles_owner_latest
  ON companion_profiles(owner_id, profile_id, version DESC);

CREATE TABLE IF NOT EXISTS companion_profile_preferences (
  owner_id TEXT PRIMARY KEY NOT NULL,
  active_profile_id TEXT,
  active_profile_version INTEGER,
  updated_at TEXT NOT NULL,
  CHECK (
    (active_profile_id IS NULL AND active_profile_version IS NULL) OR
    (active_profile_id IS NOT NULL AND active_profile_version IS NOT NULL AND active_profile_version >= 1)
  ),
  FOREIGN KEY (owner_id, active_profile_id, active_profile_version)
    REFERENCES companion_profiles(owner_id, profile_id, version)
);

CREATE TABLE IF NOT EXISTS companion_profile_events (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL,
  profile_id TEXT,
  profile_version INTEGER,
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'updated', 'selected', 'reset')),
  profile_digest TEXT CHECK (
    profile_digest IS NULL OR
    (length(profile_digest) = 64 AND profile_digest NOT GLOB '*[^a-f0-9]*')
  ),
  occurred_at TEXT NOT NULL,
  CHECK (
    (event_type = 'reset' AND profile_id IS NULL AND profile_version IS NULL AND profile_digest IS NULL) OR
    (event_type <> 'reset' AND profile_id IS NOT NULL AND profile_version IS NOT NULL AND profile_version >= 1
      AND profile_digest IS NOT NULL)
  ),
  FOREIGN KEY (owner_id, profile_id, profile_version)
    REFERENCES companion_profiles(owner_id, profile_id, version)
);

CREATE INDEX IF NOT EXISTS idx_companion_profile_events_owner_timeline
  ON companion_profile_events(owner_id, occurred_at DESC, id DESC);

CREATE TRIGGER IF NOT EXISTS trg_companion_profile_registered
AFTER INSERT ON companion_profiles
BEGIN
  INSERT INTO companion_profile_events (
    id, owner_id, profile_id, profile_version, event_type, profile_digest, occurred_at
  ) VALUES (
    'profile:' || NEW.id, NEW.owner_id, NEW.profile_id, NEW.version,
    CASE WHEN NEW.version = 1 THEN 'created' ELSE 'updated' END,
    NEW.profile_digest, NEW.created_at
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_companion_profiles_no_update
BEFORE UPDATE ON companion_profiles
BEGIN
  SELECT RAISE(ABORT, 'Companion Profile revisions are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_companion_profiles_no_delete
BEFORE DELETE ON companion_profiles
BEGIN
  SELECT RAISE(ABORT, 'Companion Profile revisions cannot be deleted');
END;

CREATE TRIGGER IF NOT EXISTS trg_companion_profile_events_no_update
BEFORE UPDATE ON companion_profile_events
BEGIN
  SELECT RAISE(ABORT, 'Companion Profile events are append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_companion_profile_events_no_delete
BEFORE DELETE ON companion_profile_events
BEGIN
  SELECT RAISE(ABORT, 'Companion Profile events are append-only');
END;
