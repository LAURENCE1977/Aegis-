ALTER TABLE aegis_memories
  ADD COLUMN supersedes_id TEXT REFERENCES aegis_memories(id);

CREATE INDEX IF NOT EXISTS idx_aegis_memories_supersedes
  ON aegis_memories (owner_id, project_id, supersedes_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_aegis_memories_one_pending_correction
  ON aegis_memories (supersedes_id)
  WHERE supersedes_id IS NOT NULL AND status = 'candidate';

CREATE TRIGGER IF NOT EXISTS trg_aegis_memory_supersedes_scope
BEFORE INSERT ON aegis_memories
WHEN NEW.supersedes_id IS NOT NULL
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM aegis_memories prior
    WHERE prior.id = NEW.supersedes_id
      AND prior.owner_id = NEW.owner_id
      AND prior.project_id IS NEW.project_id
      AND prior.status = 'accepted'
  ) THEN RAISE(ABORT, 'invalid memory supersession target') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_aegis_memory_accept_replacement
AFTER UPDATE OF status ON aegis_memories
WHEN OLD.status <> 'accepted'
  AND NEW.status = 'accepted'
  AND NEW.supersedes_id IS NOT NULL
BEGIN
  UPDATE aegis_memories
  SET status = 'superseded', updated_at = NEW.updated_at
  WHERE id = NEW.supersedes_id
    AND owner_id = NEW.owner_id
    AND project_id IS NEW.project_id
    AND status = 'accepted';
END;
