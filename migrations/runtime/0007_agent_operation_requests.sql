PRAGMA foreign_keys = ON;

-- Immutable inbox requests are proposals for review, never approvals or execution grants.
CREATE TABLE IF NOT EXISTS agent_operation_requests (
  principal_id TEXT NOT NULL CHECK (length(principal_id) BETWEEN 1 AND 80),
  request_id TEXT NOT NULL CHECK (length(request_id) BETWEEN 1 AND 80),
  run_id TEXT NOT NULL CHECK (length(run_id) BETWEEN 1 AND 80),
  workflow_id TEXT NOT NULL CHECK (length(workflow_id) BETWEEN 1 AND 80),
  definition_digest TEXT NOT NULL CHECK (
    length(definition_digest) = 71 AND substr(definition_digest, 1, 7) = 'sha256:' AND substr(definition_digest, 8) NOT GLOB '*[^0-9a-f]*'
  ),
  checkpoint_digest TEXT NOT NULL CHECK (
    length(checkpoint_digest) = 71 AND substr(checkpoint_digest, 1, 7) = 'sha256:' AND substr(checkpoint_digest, 8) NOT GLOB '*[^0-9a-f]*'
  ),
  action_digest TEXT NOT NULL CHECK (
    length(action_digest) = 71 AND substr(action_digest, 1, 7) = 'sha256:' AND substr(action_digest, 8) NOT GLOB '*[^0-9a-f]*'
  ),
  evidence_digest TEXT NOT NULL CHECK (
    length(evidence_digest) = 71 AND substr(evidence_digest, 1, 7) = 'sha256:' AND substr(evidence_digest, 8) NOT GLOB '*[^0-9a-f]*'
  ),
  request_digest TEXT NOT NULL CHECK (
    length(request_digest) = 71 AND substr(request_digest, 1, 7) = 'sha256:' AND substr(request_digest, 8) NOT GLOB '*[^0-9a-f]*'
  ),
  request_json TEXT NOT NULL CHECK (length(request_json) BETWEEN 2 AND 65536),
  created_at TEXT NOT NULL,
  PRIMARY KEY (principal_id, request_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_operation_requests_owner_created
  ON agent_operation_requests (principal_id, created_at DESC, request_id DESC);

CREATE INDEX IF NOT EXISTS idx_agent_operation_requests_owner_run
  ON agent_operation_requests (principal_id, run_id, created_at DESC, request_id DESC);

CREATE TRIGGER IF NOT EXISTS agent_operation_requests_no_update
BEFORE UPDATE ON agent_operation_requests
BEGIN
  SELECT RAISE(ABORT, 'agent operation requests are immutable');
END;

CREATE TRIGGER IF NOT EXISTS agent_operation_requests_no_delete
BEFORE DELETE ON agent_operation_requests
BEGIN
  SELECT RAISE(ABORT, 'agent operation requests are append-only');
END;
