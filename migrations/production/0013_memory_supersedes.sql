-- Memory repository persists the supersession link used by lifecycle operations.
ALTER TABLE aegis_memories ADD COLUMN supersedes_id TEXT;
