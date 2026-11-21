-- Proposal review events are human observations, not Sentinel approvals.
-- They are append-only and remain scoped to the authenticated principal.
CREATE TABLE IF NOT EXISTS experiment_proposal_review_events (
  event_id TEXT NOT NULL CHECK (length(event_id) BETWEEN 8 AND 100),
  principal_id TEXT NOT NULL CHECK (length(principal_id) BETWEEN 1 AND 80),
  proposal_id TEXT NOT NULL CHECK (length(proposal_id) BETWEEN 1 AND 512),
  decision TEXT NOT NULL CHECK (
    decision IN ('accepted_for_further_review', 'rejected', 'needs_more_evidence', 'withdrawn')
  ),
  note TEXT NOT NULL CHECK (length(note) BETWEEN 1 AND 1000),
  first_record_id TEXT NOT NULL CHECK (length(first_record_id) BETWEEN 1 AND 80),
  last_record_id TEXT NOT NULL CHECK (length(last_record_id) BETWEEN 1 AND 80),
  workload_digest TEXT NOT NULL CHECK (
    length(workload_digest) = 71 AND substr(workload_digest, 1, 7) = 'sha256:' AND substr(workload_digest, 8) NOT GLOB '*[^0-9a-f]*'
  ),
  created_at TEXT NOT NULL,
  PRIMARY KEY (principal_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_experiment_proposal_reviews_owner_proposal_created
  ON experiment_proposal_review_events (principal_id, proposal_id, created_at DESC, event_id DESC);

CREATE TRIGGER IF NOT EXISTS experiment_proposal_review_events_no_update
BEFORE UPDATE ON experiment_proposal_review_events
BEGIN
  SELECT RAISE(ABORT, 'proposal review events are append-only');
END;

CREATE TRIGGER IF NOT EXISTS experiment_proposal_review_events_no_delete
BEFORE DELETE ON experiment_proposal_review_events
BEGIN
  SELECT RAISE(ABORT, 'proposal review events are append-only');
END;
