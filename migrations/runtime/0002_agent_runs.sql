PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS agent_runs (
  id TEXT PRIMARY KEY NOT NULL,
  objective TEXT NOT NULL CHECK (length(objective) BETWEEN 1 AND 2000),
  specialists_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending_dispatch', 'queued', 'running', 'planned', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  idempotency_key TEXT UNIQUE,
  plan_json TEXT,
  error_code TEXT,
  lease_until TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_status_created
  ON agent_runs (status, created_at);

CREATE INDEX IF NOT EXISTS idx_agent_runs_running_lease
  ON agent_runs (status, lease_until);

CREATE TABLE IF NOT EXISTS agent_run_events (
  event_id TEXT PRIMARY KEY NOT NULL,
  agent_run_id TEXT NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_run_events_run_created
  ON agent_run_events (agent_run_id, created_at);
