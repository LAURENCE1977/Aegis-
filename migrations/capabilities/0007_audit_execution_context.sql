-- Optional execution lineage and exact authority identifiers.
-- Existing append-only rows remain immutable and receive NULL for these fields.
ALTER TABLE capability_invocation_audit ADD COLUMN grant_id TEXT;
ALTER TABLE capability_invocation_audit ADD COLUMN connection_id TEXT;
ALTER TABLE capability_invocation_audit ADD COLUMN approval_id TEXT;
ALTER TABLE capability_invocation_audit ADD COLUMN task_id TEXT;
ALTER TABLE capability_invocation_audit ADD COLUMN session_id TEXT;
ALTER TABLE capability_invocation_audit ADD COLUMN parent_session_id TEXT;
ALTER TABLE capability_invocation_audit ADD COLUMN worker_id TEXT;
ALTER TABLE capability_invocation_audit ADD COLUMN adapter_receipt_id TEXT;

CREATE INDEX IF NOT EXISTS idx_capability_invocation_audit_task
  ON capability_invocation_audit (task_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_capability_invocation_audit_session
  ON capability_invocation_audit (session_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_capability_invocation_audit_grant
  ON capability_invocation_audit (grant_id, occurred_at DESC);
