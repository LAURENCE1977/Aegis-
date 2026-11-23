PRAGMA foreign_keys = ON;

ALTER TABLE agent_runs
  ADD COLUMN assigned_device_id TEXT REFERENCES devices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_agent_runs_assigned_device_created
  ON agent_runs (assigned_device_id, created_at DESC);
