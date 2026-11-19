PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS forge_source_provenance (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL,
  canonical_url TEXT NOT NULL,
  revision TEXT NOT NULL CHECK (length(revision) IN (40, 64)),
  record_json TEXT NOT NULL CHECK (json_valid(record_json)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (owner_id, canonical_url, revision)
);

CREATE INDEX IF NOT EXISTS idx_forge_source_provenance_owner_time
  ON forge_source_provenance (owner_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS forge_source_provenance_events (
  id TEXT PRIMARY KEY NOT NULL,
  record_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('created')),
  occurred_at TEXT NOT NULL,
  FOREIGN KEY (record_id) REFERENCES forge_source_provenance (id)
);

CREATE INDEX IF NOT EXISTS idx_forge_source_provenance_events_owner
  ON forge_source_provenance_events (owner_id, record_id, occurred_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_forge_source_provenance_created
AFTER INSERT ON forge_source_provenance
BEGIN
  INSERT INTO forge_source_provenance_events (
    id, record_id, owner_id, event_type, occurred_at
  ) VALUES (
    lower(hex(randomblob(16))), NEW.id, NEW.owner_id, 'created', NEW.created_at
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_forge_source_provenance_identity_immutable
BEFORE UPDATE ON forge_source_provenance
WHEN OLD.id <> NEW.id
  OR OLD.owner_id <> NEW.owner_id
  OR OLD.canonical_url <> NEW.canonical_url
  OR OLD.revision <> NEW.revision
  OR OLD.record_json <> NEW.record_json
  OR OLD.created_at <> NEW.created_at
  OR OLD.updated_at <> NEW.updated_at
BEGIN
  SELECT RAISE(ABORT, 'AEGIS Forge source provenance records are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_forge_source_provenance_events_no_update
BEFORE UPDATE ON forge_source_provenance_events
BEGIN
  SELECT RAISE(ABORT, 'AEGIS Forge source provenance events are append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_forge_source_provenance_events_no_delete
BEFORE DELETE ON forge_source_provenance_events
BEGIN
  SELECT RAISE(ABORT, 'AEGIS Forge source provenance events are append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_forge_source_provenance_no_delete
BEFORE DELETE ON forge_source_provenance
BEGIN
  SELECT RAISE(ABORT, 'AEGIS Forge source provenance records cannot be deleted');
END;
