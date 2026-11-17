CREATE TABLE IF NOT EXISTS learning_assessments (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  assessment_id TEXT NOT NULL,
  version TEXT NOT NULL,
  path_id TEXT NOT NULL,
  path_version TEXT NOT NULL,
  node_id TEXT NOT NULL,
  assessment_digest TEXT NOT NULL CHECK (length(assessment_digest) = 64),
  assessment_json TEXT NOT NULL CHECK (json_valid(assessment_json)),
  created_at TEXT NOT NULL,
  UNIQUE (owner_id, assessment_id, version),
  FOREIGN KEY (owner_id, path_id, path_version)
    REFERENCES learning_paths(owner_id, path_id, version)
);

CREATE INDEX IF NOT EXISTS idx_learning_assessments_owner_created
  ON learning_assessments(owner_id, created_at DESC, assessment_id ASC, version DESC);

CREATE TABLE IF NOT EXISTS learning_assessment_events (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  assessment_id TEXT NOT NULL,
  version TEXT NOT NULL,
  path_id TEXT NOT NULL,
  path_version TEXT NOT NULL,
  node_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('registered')),
  assessment_digest TEXT NOT NULL CHECK (length(assessment_digest) = 64),
  occurred_at TEXT NOT NULL,
  UNIQUE (owner_id, assessment_id, version, event_type),
  FOREIGN KEY (owner_id, assessment_id, version)
    REFERENCES learning_assessments(owner_id, assessment_id, version)
);

CREATE INDEX IF NOT EXISTS idx_learning_assessment_events_owner_timeline
  ON learning_assessment_events(owner_id, occurred_at DESC, id DESC);

CREATE TRIGGER IF NOT EXISTS trg_learning_assessment_registered
AFTER INSERT ON learning_assessments
BEGIN
  INSERT INTO learning_assessment_events (
    id, owner_id, assessment_id, version, path_id, path_version,
    node_id, event_type, assessment_digest, occurred_at
  ) VALUES (
    'registered:' || NEW.id, NEW.owner_id, NEW.assessment_id, NEW.version,
    NEW.path_id, NEW.path_version, NEW.node_id, 'registered',
    NEW.assessment_digest, NEW.created_at
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_learning_assessments_no_update
BEFORE UPDATE ON learning_assessments
BEGIN
  SELECT RAISE(ABORT, 'Learning Assessment versions are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_learning_assessments_no_delete
BEFORE DELETE ON learning_assessments
BEGIN
  SELECT RAISE(ABORT, 'Learning Assessment versions are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_learning_assessment_events_no_update
BEFORE UPDATE ON learning_assessment_events
BEGIN
  SELECT RAISE(ABORT, 'Learning Assessment events are append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_learning_assessment_events_no_delete
BEFORE DELETE ON learning_assessment_events
BEGIN
  SELECT RAISE(ABORT, 'Learning Assessment events are append-only');
END;
