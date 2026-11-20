PRAGMA foreign_keys = ON;

-- The record payload is immutable. A logical deletion is represented by an
-- append-only tombstone event; payload erasure is deliberately not implied.
CREATE TABLE IF NOT EXISTS experiment_records (
  principal_id TEXT NOT NULL CHECK (length(principal_id) BETWEEN 1 AND 128),
  record_id TEXT NOT NULL CHECK (length(record_id) BETWEEN 1 AND 80),
  schema_version TEXT NOT NULL CHECK (schema_version = 'aegis.experiment-record.v1'),
  record_digest TEXT NOT NULL CHECK (
    length(record_digest) = 71 AND substr(record_digest, 1, 7) = 'sha256:' AND substr(record_digest, 8) NOT GLOB '*[^0-9a-f]*'
  ),
  record_json TEXT NOT NULL CHECK (length(record_json) BETWEEN 2 AND 262144),
  created_at TEXT NOT NULL,
  PRIMARY KEY (principal_id, record_id)
);

CREATE INDEX IF NOT EXISTS idx_experiment_records_principal_created
  ON experiment_records (principal_id, created_at DESC, record_id DESC);

CREATE TABLE IF NOT EXISTS experiment_record_events (
  event_id TEXT PRIMARY KEY NOT NULL,
  principal_id TEXT NOT NULL,
  record_id TEXT NOT NULL,
  actor_principal_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'tombstoned')),
  record_digest TEXT NOT NULL CHECK (
    length(record_digest) = 71 AND substr(record_digest, 1, 7) = 'sha256:' AND substr(record_digest, 8) NOT GLOB '*[^0-9a-f]*'
  ),
  created_at TEXT NOT NULL,
  FOREIGN KEY (principal_id, record_id)
    REFERENCES experiment_records (principal_id, record_id)
);

CREATE INDEX IF NOT EXISTS idx_experiment_record_events_owner_record
  ON experiment_record_events (principal_id, record_id, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_experiment_record_single_tombstone
  ON experiment_record_events (principal_id, record_id)
  WHERE event_type = 'tombstoned';

CREATE TRIGGER IF NOT EXISTS experiment_records_no_update
BEFORE UPDATE ON experiment_records
BEGIN
  SELECT RAISE(ABORT, 'experiment records are immutable');
END;

CREATE TRIGGER IF NOT EXISTS experiment_records_no_delete
BEFORE DELETE ON experiment_records
BEGIN
  SELECT RAISE(ABORT, 'experiment records require a separately approved retention purge');
END;

CREATE TRIGGER IF NOT EXISTS experiment_record_events_no_update
BEFORE UPDATE ON experiment_record_events
BEGIN
  SELECT RAISE(ABORT, 'experiment record events are append-only');
END;

CREATE TRIGGER IF NOT EXISTS experiment_record_events_no_delete
BEFORE DELETE ON experiment_record_events
BEGIN
  SELECT RAISE(ABORT, 'experiment record events are append-only');
END;
