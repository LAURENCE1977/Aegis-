PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS capability_grants (
  id TEXT PRIMARY KEY NOT NULL,
  principal_id TEXT NOT NULL,
  capability_id TEXT NOT NULL,
  capability_version TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  scopes_json TEXT NOT NULL CHECK (json_valid(scopes_json)),
  status TEXT NOT NULL CHECK (status IN ('active', 'revoked')),
  created_by TEXT NOT NULL CHECK (created_by = 'owner'),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  CHECK (
    (status = 'active' AND revoked_at IS NULL) OR
    (status = 'revoked' AND revoked_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_capability_grants_active_unique
  ON capability_grants (principal_id, capability_id, capability_version, resource_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_capability_grants_lookup
  ON capability_grants (principal_id, capability_id, capability_version, resource_id, status, expires_at);
