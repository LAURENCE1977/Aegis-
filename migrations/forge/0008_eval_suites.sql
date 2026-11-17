CREATE TABLE IF NOT EXISTS eval_suites (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  suite_id TEXT NOT NULL,
  version TEXT NOT NULL,
  suite_digest TEXT NOT NULL CHECK (length(suite_digest) = 64),
  suite_json TEXT NOT NULL CHECK (json_valid(suite_json)),
  created_at TEXT NOT NULL,
  UNIQUE (owner_id, suite_id, version)
);

CREATE INDEX IF NOT EXISTS idx_eval_suites_owner_created
  ON eval_suites(owner_id, created_at DESC, suite_id ASC, version DESC);

CREATE TABLE IF NOT EXISTS eval_suite_events (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  suite_id TEXT NOT NULL,
  version TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('registered')),
  suite_digest TEXT NOT NULL CHECK (length(suite_digest) = 64),
  occurred_at TEXT NOT NULL,
  UNIQUE (owner_id, suite_id, version, event_type),
  FOREIGN KEY (owner_id, suite_id, version)
    REFERENCES eval_suites(owner_id, suite_id, version)
);

CREATE INDEX IF NOT EXISTS idx_eval_suite_events_owner_timeline
  ON eval_suite_events(owner_id, occurred_at DESC, id DESC);

CREATE TRIGGER IF NOT EXISTS trg_eval_suite_registered
AFTER INSERT ON eval_suites
BEGIN
  INSERT INTO eval_suite_events (
    id, owner_id, suite_id, version, event_type, suite_digest, occurred_at
  ) VALUES (
    'registered:' || NEW.id,
    NEW.owner_id,
    NEW.suite_id,
    NEW.version,
    'registered',
    NEW.suite_digest,
    NEW.created_at
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_eval_suites_no_update
BEFORE UPDATE ON eval_suites
BEGIN
  SELECT RAISE(ABORT, 'evaluation suite versions are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_eval_suites_no_delete
BEFORE DELETE ON eval_suites
BEGIN
  SELECT RAISE(ABORT, 'evaluation suite versions are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_eval_suite_events_no_update
BEFORE UPDATE ON eval_suite_events
BEGIN
  SELECT RAISE(ABORT, 'evaluation suite events are append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_eval_suite_events_no_delete
BEFORE DELETE ON eval_suite_events
BEGIN
  SELECT RAISE(ABORT, 'evaluation suite events are append-only');
END;
