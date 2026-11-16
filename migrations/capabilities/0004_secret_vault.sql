PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS capability_secrets (
  secret_id TEXT PRIMARY KEY NOT NULL,
  principal_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  key_version TEXT NOT NULL,
  iv_b64 TEXT,
  ciphertext_b64 TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'revoked')),
  revoked_at TEXT,
  CHECK (
    (status = 'active' AND iv_b64 IS NOT NULL AND ciphertext_b64 IS NOT NULL AND revoked_at IS NULL) OR
    (status = 'revoked' AND iv_b64 IS NULL AND ciphertext_b64 IS NULL AND revoked_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_capability_secrets_owner_provider
  ON capability_secrets (principal_id, provider_id, status);
