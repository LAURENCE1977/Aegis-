PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS aegis_memories (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL,
  project_id TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('fact', 'preference', 'decision', 'event', 'procedure', 'artifact')),
  content TEXT NOT NULL CHECK (length(trim(content)) BETWEEN 1 AND 4000),
  source_type TEXT NOT NULL CHECK (source_type IN (
    'user-stated', 'conversation', 'project-event', 'document', 'system-observation', 'external-source'
  )),
  source_url TEXT NOT NULL CHECK (length(source_url) BETWEEN 1 AND 2048),
  source_attribution TEXT NOT NULL CHECK (length(trim(source_attribution)) BETWEEN 1 AND 300),
  source_observed_at TEXT NOT NULL,
  confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  sensitivity TEXT NOT NULL CHECK (sensitivity IN ('public', 'internal', 'private', 'restricted')),
  status TEXT NOT NULL CHECK (status IN ('candidate', 'accepted', 'superseded', 'retracted')),
  tags_json TEXT NOT NULL CHECK (length(tags_json) <= 4096),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  expires_at TEXT,
  CHECK (updated_at >= created_at),
  CHECK (expires_at IS NULL OR expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_aegis_memories_owner_scope_status_updated
  ON aegis_memories (owner_id, project_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_aegis_memories_owner_scope_expiry
  ON aegis_memories (owner_id, project_id, status, expires_at);
