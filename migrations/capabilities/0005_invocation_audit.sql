PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS capability_invocation_audit (
  id TEXT PRIMARY KEY NOT NULL,
  invocation_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'invocation_denied',
    'invocation_policy_allowed',
    'invocation_authorized',
    'invocation_failed',
    'invocation_succeeded'
  )),
  principal_id TEXT NOT NULL,
  capability_id TEXT NOT NULL,
  capability_version TEXT NOT NULL,
  action_id TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  input_digest TEXT NOT NULL CHECK (length(input_digest) = 71 AND substr(input_digest, 1, 7) = 'sha256:'),
  reason_code TEXT NOT NULL,
  occurred_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_capability_invocation_audit_principal_time
  ON capability_invocation_audit (principal_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_capability_invocation_audit_invocation
  ON capability_invocation_audit (invocation_id, occurred_at);

CREATE TRIGGER IF NOT EXISTS capability_invocation_audit_no_update
BEFORE UPDATE ON capability_invocation_audit
BEGIN
  SELECT RAISE(ABORT, 'capability invocation audit is append-only');
END;

CREATE TRIGGER IF NOT EXISTS capability_invocation_audit_no_delete
BEFORE DELETE ON capability_invocation_audit
BEGIN
  SELECT RAISE(ABORT, 'capability invocation audit is append-only');
END;
