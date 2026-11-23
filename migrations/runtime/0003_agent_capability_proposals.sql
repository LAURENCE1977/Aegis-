PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS agent_capability_proposals (
  proposal_id TEXT PRIMARY KEY NOT NULL,
  agent_run_id TEXT NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  principal_id TEXT NOT NULL,
  capability_id TEXT NOT NULL,
  capability_version TEXT NOT NULL,
  action_id TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  input_digest TEXT NOT NULL CHECK (input_digest GLOB 'sha256:*'),
  required_scopes_json TEXT NOT NULL,
  effect TEXT NOT NULL CHECK (effect = 'read'),
  risk TEXT NOT NULL CHECK (risk IN ('low', 'medium', 'high', 'critical')),
  approval TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status = 'proposed'),
  execution TEXT NOT NULL CHECK (execution = 'disabled'),
  created_at TEXT NOT NULL,
  UNIQUE (agent_run_id, capability_id, action_id, resource_id, input_digest)
);

CREATE INDEX IF NOT EXISTS idx_agent_capability_proposals_run_created
  ON agent_capability_proposals (agent_run_id, created_at);

CREATE TRIGGER IF NOT EXISTS agent_capability_proposals_no_update
BEFORE UPDATE ON agent_capability_proposals
BEGIN
  SELECT RAISE(ABORT, 'agent capability proposals are immutable');
END;

CREATE TRIGGER IF NOT EXISTS agent_capability_proposals_no_delete
BEFORE DELETE ON agent_capability_proposals
BEGIN
  SELECT RAISE(ABORT, 'agent capability proposals are immutable');
END;
