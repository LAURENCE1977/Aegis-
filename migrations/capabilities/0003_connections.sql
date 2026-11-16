PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS capability_connections (
  id TEXT PRIMARY KEY NOT NULL,
  principal_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  secret_ref TEXT NOT NULL CHECK (length(secret_ref) BETWEEN 12 AND 140),
  scopes_json TEXT NOT NULL,
  created_by TEXT NOT NULL CHECK (created_by = 'owner'),
  created_at TEXT NOT NULL,
  expires_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'revoked')),
  revoked_at TEXT,
  CHECK (
    (status = 'active' AND revoked_at IS NULL) OR
    (status = 'revoked' AND revoked_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_capability_connections_one_active_provider
  ON capability_connections (principal_id, provider_id)
  WHERE status = 'active' AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_capability_connections_lookup
  ON capability_connections (principal_id, provider_id, status, expires_at);
