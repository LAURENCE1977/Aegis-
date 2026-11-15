PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS project_spaces (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 500),
  status TEXT NOT NULL CHECK (status IN ('active', 'archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (id, owner_id)
);

CREATE INDEX IF NOT EXISTS idx_project_spaces_owner_updated
  ON project_spaces (owner_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS project_space_events (
  id TEXT PRIMARY KEY NOT NULL,
  space_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'note', 'decision', 'research', 'task',
      'agent_handoff', 'agent_result', 'feedback'
    )
  ),
  summary TEXT NOT NULL CHECK (length(trim(summary)) BETWEEN 1 AND 240),
  content TEXT NOT NULL CHECK (length(trim(content)) BETWEEN 1 AND 12000),
  created_at TEXT NOT NULL,
  FOREIGN KEY (space_id, owner_id)
    REFERENCES project_spaces (id, owner_id)
);

CREATE INDEX IF NOT EXISTS idx_project_space_events_timeline
  ON project_space_events (owner_id, space_id, created_at DESC);
