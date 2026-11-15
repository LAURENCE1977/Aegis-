PRAGMA foreign_keys = ON;

CREATE TABLE aegis_memory_events_v2 (
  id TEXT PRIMARY KEY NOT NULL,
  memory_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  project_id TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('created','status_changed','supersession_unlinked','purged')),
  from_status TEXT CHECK (from_status IS NULL OR from_status IN ('candidate','accepted','superseded','retracted')),
  to_status TEXT NOT NULL CHECK (to_status IN ('candidate','accepted','superseded','retracted')),
  occurred_at TEXT NOT NULL
);

INSERT INTO aegis_memory_events_v2 (
  id, memory_id, owner_id, project_id, event_type,
  from_status, to_status, occurred_at
)
SELECT
  id, memory_id, owner_id, project_id, event_type,
  from_status, to_status, occurred_at
FROM aegis_memory_events;

DROP TABLE aegis_memory_events;
ALTER TABLE aegis_memory_events_v2 RENAME TO aegis_memory_events;

CREATE INDEX IF NOT EXISTS idx_aegis_memory_events_scope_time
  ON aegis_memory_events (owner_id, project_id, memory_id, occurred_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_aegis_memory_events_no_update
BEFORE UPDATE ON aegis_memory_events
BEGIN
  SELECT RAISE(ABORT, 'AEGIS memory events are append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_aegis_memory_events_no_delete
BEFORE DELETE ON aegis_memory_events
BEGIN
  SELECT RAISE(ABORT, 'AEGIS memory events are append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_aegis_memory_supersession_unlinked
AFTER UPDATE OF supersedes_id ON aegis_memories
WHEN OLD.supersedes_id IS NOT NULL AND NEW.supersedes_id IS NULL
BEGIN
  INSERT INTO aegis_memory_events (
    id, memory_id, owner_id, project_id, event_type,
    from_status, to_status, occurred_at
  ) VALUES (
    lower(hex(randomblob(16))), NEW.id, NEW.owner_id, NEW.project_id,
    'supersession_unlinked', OLD.status, NEW.status, NEW.updated_at
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_aegis_memory_purged
AFTER DELETE ON aegis_memories
BEGIN
  INSERT INTO aegis_memory_events (
    id, memory_id, owner_id, project_id, event_type,
    from_status, to_status, occurred_at
  ) VALUES (
    lower(hex(randomblob(16))), OLD.id, OLD.owner_id, OLD.project_id,
    'purged', OLD.status, 'retracted', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  );
END;
