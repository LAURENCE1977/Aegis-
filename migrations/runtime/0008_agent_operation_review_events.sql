PRAGMA foreign_keys = ON;

-- Human review events are append-only observations, never Sentinel approvals.
CREATE TABLE IF NOT EXISTS agent_operation_review_events (
  event_id TEXT NOT NULL CHECK (length(event_id) BETWEEN 8 AND 100),
  principal_id TEXT NOT NULL CHECK (length(principal_id) BETWEEN 1 AND 80),
  request_id TEXT NOT NULL CHECK (length(request_id) BETWEEN 1 AND 80),
  request_digest TEXT NOT NULL CHECK (
    length(request_digest) = 71 AND substr(request_digest, 1, 7) = 'sha256:' AND substr(request_digest, 8) NOT GLOB '*[^0-9a-f]*'
  ),
  action_digest TEXT NOT NULL CHECK (
    length(action_digest) = 71 AND substr(action_digest, 1, 7) = 'sha256:' AND substr(action_digest, 8) NOT GLOB '*[^0-9a-f]*'
  ),
  evidence_digest TEXT NOT NULL CHECK (
    length(evidence_digest) = 71 AND substr(evidence_digest, 1, 7) = 'sha256:' AND substr(evidence_digest, 8) NOT GLOB '*[^0-9a-f]*'
  ),
  decision TEXT NOT NULL CHECK (
    decision IN ('accepted_for_sentinel_evaluation', 'rejected', 'needs_more_evidence', 'withdrawn')
  ),
  note TEXT NOT NULL CHECK (length(note) BETWEEN 1 AND 1000),
  created_at TEXT NOT NULL,
  PRIMARY KEY (principal_id, event_id),
  FOREIGN KEY (principal_id, request_id)
    REFERENCES agent_operation_requests (principal_id, request_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_operation_reviews_owner_request_created
  ON agent_operation_review_events (principal_id, request_id, created_at DESC, event_id DESC);

CREATE TRIGGER IF NOT EXISTS agent_operation_review_events_no_update
BEFORE UPDATE ON agent_operation_review_events
BEGIN
  SELECT RAISE(ABORT, 'agent operation review events are immutable');
END;

CREATE TRIGGER IF NOT EXISTS agent_operation_review_events_no_delete
BEFORE DELETE ON agent_operation_review_events
BEGIN
  SELECT RAISE(ABORT, 'agent operation review events are append-only');
END;
