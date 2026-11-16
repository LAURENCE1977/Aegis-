ALTER TABLE agent_runs ADD COLUMN authorization_approval_id TEXT;
ALTER TABLE agent_runs ADD COLUMN execution_authorized_at TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_runs_authorization_approval
  ON agent_runs (authorization_approval_id)
  WHERE authorization_approval_id IS NOT NULL;
