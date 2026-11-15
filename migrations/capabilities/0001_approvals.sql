PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS capability_approvals (
  id TEXT PRIMARY KEY NOT NULL,
  principal_id TEXT NOT NULL,
  capability_id TEXT NOT NULL,
  capability_version TEXT NOT NULL,
  action_id TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  connection_id TEXT,
  input_digest TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  requested_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'denied', 'consumed')),
  decided_by TEXT,
  decided_at TEXT,
  consumed_at TEXT,
  CHECK (
    (status = 'pending' AND decided_by IS NULL AND decided_at IS NULL AND consumed_at IS NULL) OR
    (status = 'approved' AND decided_by IS NOT NULL AND decided_at IS NOT NULL AND consumed_at IS NULL) OR
    (status = 'denied' AND decided_by IS NOT NULL AND decided_at IS NOT NULL AND consumed_at IS NULL) OR
    (status = 'consumed' AND decided_by IS NOT NULL AND decided_at IS NOT NULL AND consumed_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_capability_approvals_pending
  ON capability_approvals (status, expires_at);

CREATE INDEX IF NOT EXISTS idx_capability_approvals_principal
  ON capability_approvals (principal_id, requested_at);
