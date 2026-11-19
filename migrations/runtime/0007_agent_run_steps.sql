CREATE TABLE IF NOT EXISTS agent_run_steps (
  id TEXT PRIMARY KEY NOT NULL,
  agent_run_id TEXT NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  step_index INTEGER NOT NULL CHECK (step_index BETWEEN 1 AND 5),
  specialist TEXT NOT NULL CHECK (specialist IN ('researcher', 'planner', 'engineer', 'security', 'reviewer')),
  status TEXT NOT NULL CHECK (status IN ('planned', 'pending_dispatch', 'queued', 'running', 'succeeded', 'failed', 'cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  step_json TEXT NOT NULL CHECK (json_valid(step_json) AND length(step_json) <= 4096),
  checkpoint_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(checkpoint_json) AND length(checkpoint_json) <= 8192),
  result_json TEXT CHECK (result_json IS NULL OR (json_valid(result_json) AND length(result_json) <= 8192)),
  error_code TEXT,
  lease_until TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (agent_run_id, step_index),
  UNIQUE (id, agent_run_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_run_steps_run_order
  ON agent_run_steps (agent_run_id, step_index);

CREATE INDEX IF NOT EXISTS idx_agent_run_steps_status_lease
  ON agent_run_steps (status, lease_until);

CREATE TABLE IF NOT EXISTS agent_run_step_events (
  event_id TEXT PRIMARY KEY NOT NULL,
  agent_run_step_id TEXT NOT NULL,
  agent_run_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  detail_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(detail_json) AND length(detail_json) <= 4096),
  created_at TEXT NOT NULL,
  FOREIGN KEY (agent_run_step_id, agent_run_id)
    REFERENCES agent_run_steps (id, agent_run_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agent_run_step_events_run_created
  ON agent_run_step_events (agent_run_id, created_at, event_id);

CREATE TRIGGER IF NOT EXISTS agent_run_step_events_no_update
BEFORE UPDATE ON agent_run_step_events
BEGIN
  SELECT RAISE(ABORT, 'agent run step events are append-only');
END;

CREATE TRIGGER IF NOT EXISTS agent_run_step_events_no_delete
BEFORE DELETE ON agent_run_step_events
BEGIN
  SELECT RAISE(ABORT, 'agent run step events are append-only');
END;
