PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS device_pairing_invites (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL,
  code_hash TEXT NOT NULL UNIQUE CHECK (length(code_hash) = 64 AND code_hash NOT GLOB '*[^0-9a-f]*'),
  platform TEXT NOT NULL CHECK (platform IN ('android', 'chromebook')),
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 48),
  capabilities_json TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  revoked_at TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_device_pairing_invites_owner_created
  ON device_pairing_invites (owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_device_pairing_invites_expiry
  ON device_pairing_invites (expires_at, consumed_at, revoked_at);

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY NOT NULL,
  invite_id TEXT NOT NULL UNIQUE REFERENCES device_pairing_invites(id) ON DELETE RESTRICT,
  owner_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('android', 'chromebook')),
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 48),
  token_hash TEXT NOT NULL UNIQUE CHECK (length(token_hash) = 64 AND token_hash NOT GLOB '*[^0-9a-f]*'),
  token_version INTEGER NOT NULL DEFAULT 1 CHECK (token_version >= 1),
  capabilities_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'revoked')),
  last_seen_at TEXT,
  app_version TEXT,
  connectivity TEXT CHECK (connectivity IN ('online', 'limited', 'offline')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_devices_owner_status
  ON devices (owner_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_devices_status_last_seen
  ON devices (status, last_seen_at);

CREATE TABLE IF NOT EXISTS device_events (
  event_id TEXT PRIMARY KEY NOT NULL,
  device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'paired', 'heartbeat', 'token_rotated', 'revoked', 'permission_changed'
  )),
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_device_events_device_created
  ON device_events (device_id, created_at DESC);

CREATE TRIGGER IF NOT EXISTS device_events_no_update
BEFORE UPDATE ON device_events
BEGIN
  SELECT RAISE(ABORT, 'device events are append-only');
END;

CREATE TRIGGER IF NOT EXISTS device_events_no_delete
BEFORE DELETE ON device_events
BEGIN
  SELECT RAISE(ABORT, 'device events are append-only');
END;
