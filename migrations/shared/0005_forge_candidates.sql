PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS forge_candidates (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('repository','mcp','api','sdk','package','framework','application','document','research','benchmark')),
  source_url TEXT NOT NULL,
  version TEXT NOT NULL,
  licence_identifier TEXT NOT NULL,
  licence_review TEXT NOT NULL CHECK (licence_review IN ('verified','review-required','not-applicable')),
  decision TEXT NOT NULL CHECK (decision IN ('unassessed','reuse','adapt','rebuild','combine','reject')),
  status TEXT NOT NULL CHECK (status IN ('discovered','inspected','assessed','approved','rejected','archived')),
  capabilities_json TEXT NOT NULL CHECK (json_valid(capabilities_json)),
  dependencies_json TEXT NOT NULL CHECK (json_valid(dependencies_json)),
  evidence_json TEXT NOT NULL CHECK (json_valid(evidence_json)),
  metadata_json TEXT NOT NULL CHECK (json_valid(metadata_json)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (owner_id, source_url, version)
);

CREATE INDEX IF NOT EXISTS idx_forge_candidates_owner_status
  ON forge_candidates (owner_id, status, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_forge_candidates_id_owner
  ON forge_candidates (id, owner_id);

CREATE TABLE IF NOT EXISTS forge_candidate_events (
  id TEXT PRIMARY KEY NOT NULL,
  candidate_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('created','review_changed','status_changed')),
  from_status TEXT,
  to_status TEXT NOT NULL,
  from_decision TEXT,
  to_decision TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  FOREIGN KEY (candidate_id, owner_id)
    REFERENCES forge_candidates (id, owner_id)
);

CREATE INDEX IF NOT EXISTS idx_forge_candidate_events_owner_time
  ON forge_candidate_events (owner_id, candidate_id, occurred_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_forge_candidate_created
AFTER INSERT ON forge_candidates
BEGIN
  INSERT INTO forge_candidate_events (
    id, candidate_id, owner_id, event_type,
    from_status, to_status, from_decision, to_decision, occurred_at
  ) VALUES (
    lower(hex(randomblob(16))), NEW.id, NEW.owner_id, 'created',
    NULL, NEW.status, NULL, NEW.decision, NEW.created_at
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_forge_candidate_events_no_update
BEFORE UPDATE ON forge_candidate_events
BEGIN
  SELECT RAISE(ABORT, 'AEGIS Forge candidate events are append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_forge_candidate_events_no_delete
BEFORE DELETE ON forge_candidate_events
BEGIN
  SELECT RAISE(ABORT, 'AEGIS Forge candidate events are append-only');
END;


CREATE TRIGGER IF NOT EXISTS trg_forge_candidate_review_audit
AFTER UPDATE ON forge_candidates
BEGIN
  INSERT INTO forge_candidate_events (
    id, candidate_id, owner_id, event_type,
    from_status, to_status, from_decision, to_decision, occurred_at
  )
  SELECT
    lower(hex(randomblob(16))), NEW.id, NEW.owner_id, 'review_changed',
    OLD.status, NEW.status, OLD.decision, NEW.decision, NEW.updated_at
  WHERE OLD.licence_review <> NEW.licence_review
     OR OLD.decision <> NEW.decision;

  INSERT INTO forge_candidate_events (
    id, candidate_id, owner_id, event_type,
    from_status, to_status, from_decision, to_decision, occurred_at
  )
  SELECT
    lower(hex(randomblob(16))), NEW.id, NEW.owner_id, 'status_changed',
    OLD.status, NEW.status, OLD.decision, NEW.decision, NEW.updated_at
  WHERE OLD.status <> NEW.status;
END;
