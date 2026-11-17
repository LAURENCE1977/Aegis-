CREATE TABLE IF NOT EXISTS learning_assessment_attempts (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  assessment_id TEXT NOT NULL,
  assessment_version TEXT NOT NULL,
  path_id TEXT NOT NULL,
  path_version TEXT NOT NULL,
  node_id TEXT NOT NULL,
  assessment_digest TEXT NOT NULL CHECK (length(assessment_digest) = 64),
  result_json TEXT NOT NULL CHECK (json_valid(result_json)),
  score_percent INTEGER NOT NULL CHECK (score_percent BETWEEN 0 AND 100),
  passed INTEGER NOT NULL CHECK (passed IN (0, 1)),
  mastery_verified INTEGER NOT NULL DEFAULT 0 CHECK (mastery_verified = 0),
  occurred_at TEXT NOT NULL,
  CHECK (json_extract(result_json, '$.attemptId') = id),
  CHECK (json_extract(result_json, '$.assessmentId') = assessment_id),
  CHECK (json_extract(result_json, '$.assessmentVersion') = assessment_version),
  CHECK (json_extract(result_json, '$.pathId') = path_id),
  CHECK (json_extract(result_json, '$.pathVersion') = path_version),
  CHECK (json_extract(result_json, '$.nodeId') = node_id),
  CHECK (json_extract(result_json, '$.scorePercent') = score_percent),
  CHECK (json_extract(result_json, '$.passed') = passed),
  CHECK (json_extract(result_json, '$.masteryVerified') = 0),
  UNIQUE (owner_id, id),
  FOREIGN KEY (owner_id, assessment_id, assessment_version)
    REFERENCES learning_assessments(owner_id, assessment_id, version)
);

CREATE INDEX IF NOT EXISTS idx_learning_attempts_owner_assessment_timeline
  ON learning_assessment_attempts(owner_id, assessment_id, assessment_version, occurred_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS learning_assessment_attempt_events (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  attempt_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('submitted')),
  occurred_at TEXT NOT NULL,
  UNIQUE (owner_id, attempt_id, event_type),
  FOREIGN KEY (owner_id, attempt_id)
    REFERENCES learning_assessment_attempts(owner_id, id)
);

CREATE INDEX IF NOT EXISTS idx_learning_attempt_events_owner_timeline
  ON learning_assessment_attempt_events(owner_id, occurred_at DESC, id DESC);

CREATE TRIGGER IF NOT EXISTS trg_learning_assessment_attempt_identity
BEFORE INSERT ON learning_assessment_attempts
WHEN NOT EXISTS (
  SELECT 1 FROM learning_assessments AS assessment
  WHERE assessment.owner_id = NEW.owner_id
    AND assessment.assessment_id = NEW.assessment_id
    AND assessment.version = NEW.assessment_version
    AND assessment.path_id = NEW.path_id
    AND assessment.path_version = NEW.path_version
    AND assessment.node_id = NEW.node_id
    AND assessment.assessment_digest = NEW.assessment_digest
)
BEGIN
  SELECT RAISE(ABORT, 'Learning Attempt must match an exact registered assessment version');
END;

CREATE TRIGGER IF NOT EXISTS trg_learning_assessment_attempt_rate_limit
BEFORE INSERT ON learning_assessment_attempts
WHEN EXISTS (
  SELECT 1 FROM learning_assessment_attempts AS prior
  WHERE prior.owner_id = NEW.owner_id
    AND prior.assessment_id = NEW.assessment_id
    AND prior.assessment_version = NEW.assessment_version
    AND julianday(NEW.occurred_at) <= julianday(prior.occurred_at)
) OR EXISTS (
  SELECT 1 FROM learning_assessment_attempts AS prior
  WHERE prior.owner_id = NEW.owner_id
    AND prior.assessment_id = NEW.assessment_id
    AND prior.assessment_version = NEW.assessment_version
    AND julianday(NEW.occurred_at) - julianday(prior.occurred_at) < (30.0 / 86400.0)
) OR (
  SELECT COUNT(*) FROM learning_assessment_attempts AS prior
  WHERE prior.owner_id = NEW.owner_id
    AND prior.assessment_id = NEW.assessment_id
    AND prior.assessment_version = NEW.assessment_version
    AND julianday(NEW.occurred_at) - julianday(prior.occurred_at) <= (900.0 / 86400.0)
) >= 5
BEGIN
  SELECT RAISE(ABORT, 'Learning Assessment attempt rate limit exceeded');
END;

CREATE TRIGGER IF NOT EXISTS trg_learning_assessment_attempt_submitted
AFTER INSERT ON learning_assessment_attempts
BEGIN
  INSERT INTO learning_assessment_attempt_events (
    id, owner_id, attempt_id, event_type, occurred_at
  ) VALUES (
    'submitted:' || NEW.id, NEW.owner_id, NEW.id, 'submitted', NEW.occurred_at
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_learning_assessment_attempts_no_update
BEFORE UPDATE ON learning_assessment_attempts
BEGIN
  SELECT RAISE(ABORT, 'Learning Assessment Attempts are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_learning_assessment_attempts_no_delete
BEFORE DELETE ON learning_assessment_attempts
BEGIN
  SELECT RAISE(ABORT, 'Learning Assessment Attempts cannot be deleted');
END;

CREATE TRIGGER IF NOT EXISTS trg_learning_assessment_attempt_events_no_update
BEFORE UPDATE ON learning_assessment_attempt_events
BEGIN
  SELECT RAISE(ABORT, 'Learning Assessment Attempt events are append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_learning_assessment_attempt_events_no_delete
BEFORE DELETE ON learning_assessment_attempt_events
BEGIN
  SELECT RAISE(ABORT, 'Learning Assessment Attempt events are append-only');
END;
