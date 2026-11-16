-- Cancellation is a durable overlay so existing status constraints and event
-- foreign keys remain intact. A cancelled run is never dispatched or claimed.
ALTER TABLE agent_runs ADD COLUMN cancelled_at TEXT;

CREATE INDEX IF NOT EXISTS idx_agent_runs_cancelled_pending
  ON agent_runs (status, cancelled_at, created_at);
