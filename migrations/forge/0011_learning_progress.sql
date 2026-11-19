CREATE TABLE IF NOT EXISTS learning_progress (
  owner_id TEXT NOT NULL,
  path_id TEXT NOT NULL,
  path_version TEXT NOT NULL,
  node_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('in_progress', 'self_reported_complete')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (owner_id, path_id, path_version, node_id),
  FOREIGN KEY (owner_id, path_id, path_version)
    REFERENCES learning_paths(owner_id, path_id, version)
);

CREATE INDEX IF NOT EXISTS idx_learning_progress_owner_path_status
  ON learning_progress(owner_id, path_id, path_version, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS learning_progress_events (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  path_id TEXT NOT NULL,
  path_version TEXT NOT NULL,
  node_id TEXT NOT NULL,
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL CHECK (to_status IN ('in_progress', 'self_reported_complete')),
  occurred_at TEXT NOT NULL,
  FOREIGN KEY (owner_id, path_id, path_version, node_id)
    REFERENCES learning_progress(owner_id, path_id, path_version, node_id)
);

CREATE INDEX IF NOT EXISTS idx_learning_progress_events_owner_timeline
  ON learning_progress_events(owner_id, path_id, path_version, occurred_at DESC, id DESC);

CREATE TRIGGER IF NOT EXISTS trg_learning_progress_created
AFTER INSERT ON learning_progress
BEGIN
  INSERT INTO learning_progress_events (
    id, owner_id, path_id, path_version, node_id,
    from_status, to_status, occurred_at
  ) VALUES (
    lower(hex(randomblob(16))), NEW.owner_id, NEW.path_id, NEW.path_version,
    NEW.node_id, 'not_started', NEW.status, NEW.created_at
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_learning_progress_transition
BEFORE UPDATE ON learning_progress
WHEN NOT (
  (OLD.status = 'in_progress' AND NEW.status = 'self_reported_complete') OR
  (OLD.status = 'self_reported_complete' AND NEW.status = 'in_progress')
) OR NEW.owner_id <> OLD.owner_id OR NEW.path_id <> OLD.path_id OR
  NEW.path_version <> OLD.path_version OR NEW.node_id <> OLD.node_id OR
  NEW.created_at <> OLD.created_at OR NEW.updated_at <= OLD.updated_at
BEGIN
  SELECT RAISE(ABORT, 'invalid or non-advancing Learning Progress transition');
END;

CREATE TRIGGER IF NOT EXISTS trg_learning_progress_updated
AFTER UPDATE ON learning_progress
WHEN OLD.status <> NEW.status
BEGIN
  INSERT INTO learning_progress_events (
    id, owner_id, path_id, path_version, node_id,
    from_status, to_status, occurred_at
  ) VALUES (
    lower(hex(randomblob(16))), NEW.owner_id, NEW.path_id, NEW.path_version,
    NEW.node_id, OLD.status, NEW.status, NEW.updated_at
  );
END;


CREATE TRIGGER IF NOT EXISTS trg_learning_progress_prerequisites_insert
BEFORE INSERT ON learning_progress
WHEN NEW.status = 'self_reported_complete' AND EXISTS (
  SELECT 1
  FROM learning_paths AS path,
       json_each(path.graph_json, '$.nodes') AS node,
       json_each(node.value, '$.prerequisites') AS prerequisite
  WHERE path.owner_id = NEW.owner_id
    AND path.path_id = NEW.path_id
    AND path.version = NEW.path_version
    AND json_extract(node.value, '$.id') = NEW.node_id
    AND NOT EXISTS (
      SELECT 1 FROM learning_progress AS prior
      WHERE prior.owner_id = NEW.owner_id
        AND prior.path_id = NEW.path_id
        AND prior.path_version = NEW.path_version
        AND prior.node_id = prerequisite.value
        AND prior.status = 'self_reported_complete'
    )
)
BEGIN
  SELECT RAISE(ABORT, 'Learning prerequisites must be self-reported complete');
END;

CREATE TRIGGER IF NOT EXISTS trg_learning_progress_prerequisites_update
BEFORE UPDATE OF status ON learning_progress
WHEN NEW.status = 'self_reported_complete' AND EXISTS (
  SELECT 1
  FROM learning_paths AS path,
       json_each(path.graph_json, '$.nodes') AS node,
       json_each(node.value, '$.prerequisites') AS prerequisite
  WHERE path.owner_id = NEW.owner_id
    AND path.path_id = NEW.path_id
    AND path.version = NEW.path_version
    AND json_extract(node.value, '$.id') = NEW.node_id
    AND NOT EXISTS (
      SELECT 1 FROM learning_progress AS prior
      WHERE prior.owner_id = NEW.owner_id
        AND prior.path_id = NEW.path_id
        AND prior.path_version = NEW.path_version
        AND prior.node_id = prerequisite.value
        AND prior.status = 'self_reported_complete'
    )
)
BEGIN
  SELECT RAISE(ABORT, 'Learning prerequisites must be self-reported complete');
END;

CREATE TRIGGER IF NOT EXISTS trg_learning_progress_no_delete
BEFORE DELETE ON learning_progress
BEGIN
  SELECT RAISE(ABORT, 'Learning Progress history cannot be deleted');
END;

CREATE TRIGGER IF NOT EXISTS trg_learning_progress_events_no_update
BEFORE UPDATE ON learning_progress_events
BEGIN
  SELECT RAISE(ABORT, 'Learning Progress events are append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_learning_progress_events_no_delete
BEFORE DELETE ON learning_progress_events
BEGIN
  SELECT RAISE(ABORT, 'Learning Progress events are append-only');
END;
