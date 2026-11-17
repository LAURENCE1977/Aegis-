CREATE TABLE IF NOT EXISTS eval_runs (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  suite_id TEXT NOT NULL,
  suite_version TEXT NOT NULL,
  suite_digest TEXT NOT NULL CHECK (length(suite_digest) = 64),
  candidate_id TEXT NOT NULL,
  candidate_version TEXT NOT NULL,
  candidate_digest TEXT NOT NULL CHECK (length(candidate_digest) = 64),
  status TEXT NOT NULL CHECK (status IN ('passed', 'failed')),
  score_percent REAL NOT NULL CHECK (score_percent >= 0 AND score_percent <= 100),
  result_digest TEXT NOT NULL CHECK (length(result_digest) = 64),
  result_json TEXT NOT NULL CHECK (json_valid(result_json)),
  CHECK (json_extract(result_json, '$.evidenceVerified') = 1),
  CHECK (json_extract(result_json, '$.id') = run_id),
  CHECK (json_extract(result_json, '$.suiteId') = suite_id),
  CHECK (json_extract(result_json, '$.suiteVersion') = suite_version),
  CHECK (json_extract(result_json, '$.candidateId') = candidate_id),
  CHECK (json_extract(result_json, '$.candidateVersion') = candidate_version),
  CHECK (json_extract(result_json, '$.candidateDigest') = candidate_digest),
  CHECK (json_extract(result_json, '$.status') = status),
  CHECK (json_extract(result_json, '$.scorePercent') = score_percent),
  completed_at TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  evidence_verified INTEGER NOT NULL DEFAULT 1 CHECK (evidence_verified = 1),
  UNIQUE (owner_id, run_id),
  FOREIGN KEY (owner_id, suite_id, suite_version)
    REFERENCES eval_suites(owner_id, suite_id, version)
);

CREATE INDEX IF NOT EXISTS idx_eval_runs_owner_recorded
  ON eval_runs(owner_id, recorded_at DESC, run_id ASC);

CREATE TABLE IF NOT EXISTS eval_run_events (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('recorded')),
  result_digest TEXT NOT NULL CHECK (length(result_digest) = 64),
  occurred_at TEXT NOT NULL,
  UNIQUE (owner_id, run_id, event_type),
  FOREIGN KEY (owner_id, run_id)
    REFERENCES eval_runs(owner_id, run_id)
);

CREATE INDEX IF NOT EXISTS idx_eval_run_events_owner_timeline
  ON eval_run_events(owner_id, occurred_at DESC, id DESC);

CREATE TRIGGER IF NOT EXISTS trg_eval_run_recorded
AFTER INSERT ON eval_runs
BEGIN
  INSERT INTO eval_run_events (
    id, owner_id, run_id, event_type, result_digest, occurred_at
  ) VALUES (
    'recorded:' || NEW.id,
    NEW.owner_id,
    NEW.run_id,
    'recorded',
    NEW.result_digest,
    NEW.recorded_at
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_eval_runs_no_update
BEFORE UPDATE ON eval_runs
BEGIN
  SELECT RAISE(ABORT, 'evaluation run results are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_eval_runs_no_delete
BEFORE DELETE ON eval_runs
BEGIN
  SELECT RAISE(ABORT, 'evaluation run results are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_eval_run_events_no_update
BEFORE UPDATE ON eval_run_events
BEGIN
  SELECT RAISE(ABORT, 'evaluation run events are append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_eval_run_events_no_delete
BEFORE DELETE ON eval_run_events
BEGIN
  SELECT RAISE(ABORT, 'evaluation run events are append-only');
END;
