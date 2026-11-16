CREATE INDEX IF NOT EXISTS idx_agent_run_events_timeline
  ON agent_run_events (agent_run_id, created_at DESC, event_id DESC);
