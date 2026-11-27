PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS capability_invocation_limits (
  principal_id TEXT NOT NULL,
  capability_id TEXT NOT NULL,
  action_id TEXT NOT NULL,
  window_start_ms INTEGER NOT NULL CHECK (window_start_ms >= 0),
  request_count INTEGER NOT NULL CHECK (request_count BETWEEN 1 AND 10000),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (principal_id, capability_id, action_id, window_start_ms)
);

CREATE INDEX IF NOT EXISTS idx_capability_invocation_limits_window
  ON capability_invocation_limits (window_start_ms);
