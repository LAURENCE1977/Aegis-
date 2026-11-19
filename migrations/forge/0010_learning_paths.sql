CREATE TABLE IF NOT EXISTS learning_paths (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  path_id TEXT NOT NULL,
  version TEXT NOT NULL,
  graph_digest TEXT NOT NULL CHECK (length(graph_digest) = 64),
  graph_json TEXT NOT NULL CHECK (json_valid(graph_json)),
  created_at TEXT NOT NULL,
  UNIQUE (owner_id, path_id, version)
);

CREATE INDEX IF NOT EXISTS idx_learning_paths_owner_created
  ON learning_paths(owner_id, created_at DESC, path_id ASC, version DESC);

CREATE TABLE IF NOT EXISTS learning_path_events (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  path_id TEXT NOT NULL,
  version TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('registered')),
  graph_digest TEXT NOT NULL CHECK (length(graph_digest) = 64),
  occurred_at TEXT NOT NULL,
  UNIQUE (owner_id, path_id, version, event_type),
  FOREIGN KEY (owner_id, path_id, version)
    REFERENCES learning_paths(owner_id, path_id, version)
);

CREATE INDEX IF NOT EXISTS idx_learning_path_events_owner_timeline
  ON learning_path_events(owner_id, occurred_at DESC, id DESC);

CREATE TRIGGER IF NOT EXISTS trg_learning_path_registered
AFTER INSERT ON learning_paths
BEGIN
  INSERT INTO learning_path_events (
    id, owner_id, path_id, version, event_type, graph_digest, occurred_at
  ) VALUES (
    'registered:' || NEW.id,
    NEW.owner_id,
    NEW.path_id,
    NEW.version,
    'registered',
    NEW.graph_digest,
    NEW.created_at
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_learning_paths_no_update
BEFORE UPDATE ON learning_paths
BEGIN
  SELECT RAISE(ABORT, 'Learning Path versions are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_learning_paths_no_delete
BEFORE DELETE ON learning_paths
BEGIN
  SELECT RAISE(ABORT, 'Learning Path versions are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_learning_path_events_no_update
BEFORE UPDATE ON learning_path_events
BEGIN
  SELECT RAISE(ABORT, 'Learning Path events are append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_learning_path_events_no_delete
BEFORE DELETE ON learning_path_events
BEGIN
  SELECT RAISE(ABORT, 'Learning Path events are append-only');
END;
