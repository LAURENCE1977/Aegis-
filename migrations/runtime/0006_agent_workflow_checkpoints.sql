PRAGMA foreign_keys = ON;

-- Checkpoints are immutable observations, not execution records or approvals.
-- Sequence allocation is enforced atomically by the append store's INSERT ... SELECT.
CREATE TABLE IF NOT EXISTS agent_workflow_checkpoints (
  principal_id TEXT NOT NULL CHECK (length(principal_id) BETWEEN 1 AND 80),
  run_id TEXT NOT NULL CHECK (length(run_id) BETWEEN 1 AND 80),
  sequence INTEGER NOT NULL CHECK (sequence > 0),
  checkpoint_id TEXT NOT NULL CHECK (length(checkpoint_id) BETWEEN 1 AND 80),
  workflow_id TEXT NOT NULL CHECK (length(workflow_id) BETWEEN 1 AND 80),
  definition_digest TEXT NOT NULL CHECK (
    length(definition_digest) = 71 AND substr(definition_digest, 1, 7) = 'sha256:' AND substr(definition_digest, 8) NOT GLOB '*[^0-9a-f]*'
  ),
  checkpoint_digest TEXT NOT NULL CHECK (
    length(checkpoint_digest) = 71 AND substr(checkpoint_digest, 1, 7) = 'sha256:' AND substr(checkpoint_digest, 8) NOT GLOB '*[^0-9a-f]*'
  ),
  checkpoint_json TEXT NOT NULL CHECK (length(checkpoint_json) BETWEEN 2 AND 32768),
  observed_at TEXT NOT NULL,
  PRIMARY KEY (principal_id, run_id, sequence),
  UNIQUE (principal_id, run_id, checkpoint_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_workflow_checkpoints_owner_run
  ON agent_workflow_checkpoints (principal_id, run_id, sequence ASC);

CREATE TRIGGER IF NOT EXISTS agent_workflow_checkpoints_no_update
BEFORE UPDATE ON agent_workflow_checkpoints
BEGIN
  SELECT RAISE(ABORT, 'agent workflow checkpoints are immutable');
END;

CREATE TRIGGER IF NOT EXISTS agent_workflow_checkpoints_no_delete
BEFORE DELETE ON agent_workflow_checkpoints
BEGIN
  SELECT RAISE(ABORT, 'agent workflow checkpoints are append-only');
END;
