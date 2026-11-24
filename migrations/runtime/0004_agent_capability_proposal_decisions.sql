PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS agent_capability_proposal_decisions (
  decision_id TEXT PRIMARY KEY NOT NULL,
  proposal_id TEXT NOT NULL REFERENCES agent_capability_proposals(proposal_id) ON DELETE CASCADE,
  principal_id TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
  reason TEXT CHECK (reason IS NULL OR length(reason) <= 500),
  created_at TEXT NOT NULL,
  UNIQUE (proposal_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_capability_proposal_decisions_created
  ON agent_capability_proposal_decisions (created_at);

CREATE TRIGGER IF NOT EXISTS agent_capability_proposal_decisions_no_update
BEFORE UPDATE ON agent_capability_proposal_decisions
BEGIN
  SELECT RAISE(ABORT, 'agent capability proposal decisions are immutable');
END;

CREATE TRIGGER IF NOT EXISTS agent_capability_proposal_decisions_no_delete
BEFORE DELETE ON agent_capability_proposal_decisions
BEGIN
  SELECT RAISE(ABORT, 'agent capability proposal decisions are immutable');
END;
