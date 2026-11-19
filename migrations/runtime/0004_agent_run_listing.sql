CREATE INDEX IF NOT EXISTS idx_agent_runs_created_id
  ON agent_runs (created_at DESC, id DESC);
