CREATE TABLE IF NOT EXISTS learning_applied_task_evidence (
  id TEXT PRIMARY KEY CHECK (
    length(id) = 41 AND substr(id, 1, 9) = 'evidence-' AND
    substr(id, 10) NOT GLOB '*[^0-9a-f]*'
  ),
  owner_id TEXT NOT NULL,
  path_id TEXT NOT NULL,
  path_version TEXT NOT NULL,
  node_id TEXT NOT NULL,
  artifact_digest TEXT NOT NULL CHECK (length(artifact_digest) = 64 AND artifact_digest NOT GLOB '*[^0-9a-f]*'),
  byte_length INTEGER NOT NULL CHECK (byte_length BETWEEN 1 AND 2097152),
  media_type TEXT NOT NULL CHECK (media_type IN (
    'application/octet-stream', 'application/pdf', 'image/jpeg', 'image/png', 'text/plain'
  )),
  submitted_at TEXT NOT NULL,
  FOREIGN KEY (owner_id, path_id, path_version)
    REFERENCES learning_paths(owner_id, path_id, version)
);

CREATE INDEX IF NOT EXISTS idx_learning_applied_evidence_owner_target
  ON learning_applied_task_evidence(owner_id, path_id, path_version, node_id, submitted_at ASC);

CREATE TABLE IF NOT EXISTS learning_applied_task_evidence_events (
  id TEXT PRIMARY KEY,
  evidence_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  path_id TEXT NOT NULL,
  path_version TEXT NOT NULL,
  node_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('submitted', 'withdrawn')),
  occurred_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_learning_applied_evidence_events_owner_timeline
  ON learning_applied_task_evidence_events(owner_id, path_id, path_version, node_id, occurred_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_learning_applied_evidence_created
AFTER INSERT ON learning_applied_task_evidence
BEGIN
  INSERT INTO learning_applied_task_evidence_events (
    id, evidence_id, owner_id, path_id, path_version, node_id, event_type, occurred_at
  ) VALUES (
    'submitted:' || NEW.id, NEW.id, NEW.owner_id, NEW.path_id,
    NEW.path_version, NEW.node_id, 'submitted', NEW.submitted_at
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_learning_applied_evidence_no_update
BEFORE UPDATE ON learning_applied_task_evidence
BEGIN
  SELECT RAISE(ABORT, 'Learning applied-task evidence receipts are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_learning_applied_evidence_withdrawn
AFTER DELETE ON learning_applied_task_evidence
BEGIN
  INSERT INTO learning_applied_task_evidence_events (
    id, evidence_id, owner_id, path_id, path_version, node_id, event_type, occurred_at
  ) VALUES (
    'withdrawn:' || OLD.id || ':' || strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    OLD.id, OLD.owner_id, OLD.path_id, OLD.path_version,
    OLD.node_id, 'withdrawn', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_learning_applied_evidence_events_no_update
BEFORE UPDATE ON learning_applied_task_evidence_events
BEGIN
  SELECT RAISE(ABORT, 'Learning applied-task evidence events are append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_learning_applied_evidence_events_no_delete
BEFORE DELETE ON learning_applied_task_evidence_events
BEGIN
  SELECT RAISE(ABORT, 'Learning applied-task evidence events are append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_learning_applied_evidence_node_limit
BEFORE INSERT ON learning_applied_task_evidence
WHEN (
  SELECT COUNT(*) FROM learning_applied_task_evidence
  WHERE owner_id = NEW.owner_id AND path_id = NEW.path_id
    AND path_version = NEW.path_version AND node_id = NEW.node_id
) >= 100
BEGIN
  SELECT RAISE(ABORT, 'Learning applied-task evidence limit reached for this node');
END;

CREATE TRIGGER IF NOT EXISTS trg_learning_applied_evidence_owner_limit
BEFORE INSERT ON learning_applied_task_evidence
WHEN (
  SELECT COUNT(*) FROM learning_applied_task_evidence
  WHERE owner_id = NEW.owner_id
) >= 500
BEGIN
  SELECT RAISE(ABORT, 'Learning applied-task evidence limit reached for this owner');
END;
