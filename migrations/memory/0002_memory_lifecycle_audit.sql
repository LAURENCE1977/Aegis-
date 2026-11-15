PRAGMA foreign_keys = ON;

CREATE UNIQUE INDEX IF NOT EXISTS idx_aegis_memories_id_owner
  ON aegis_memories (id, owner_id);

CREATE TABLE IF NOT EXISTS aegis_memory_events (
  id TEXT PRIMARY KEY NOT NULL,
  memory_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  project_id TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'status_changed')),
  from_status TEXT CHECK (from_status IS NULL OR from_status IN ('candidate', 'accepted', 'superseded', 'retracted')),
  to_status TEXT NOT NULL CHECK (to_status IN ('candidate', 'accepted', 'superseded', 'retracted')),
  occurred_at TEXT NOT NULL,
  FOREIGN KEY (memory_id, owner_id)
    REFERENCES aegis_memories (id, owner_id)
);

CREATE INDEX IF NOT EXISTS idx_aegis_memory_events_scope_time
  ON aegis_memory_events (owner_id, project_id, memory_id, occurred_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_aegis_memory_created
AFTER INSERT ON aegis_memories
BEGIN
  INSERT INTO aegis_memory_events (
    id, memory_id, owner_id, project_id, event_type,
    from_status, to_status, occurred_at
  ) VALUES (
    lower(hex(randomblob(16))), NEW.id, NEW.owner_id, NEW.project_id,
    'created', NULL, NEW.status, NEW.created_at
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_aegis_memory_status_changed
AFTER UPDATE OF status ON aegis_memories
WHEN OLD.status <> NEW.status
BEGIN
  INSERT INTO aegis_memory_events (
    id, memory_id, owner_id, project_id, event_type,
    from_status, to_status, occurred_at
  ) VALUES (
    lower(hex(randomblob(16))), NEW.id, NEW.owner_id, NEW.project_id,
    'status_changed', OLD.status, NEW.status, NEW.updated_at
  );
END;

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
