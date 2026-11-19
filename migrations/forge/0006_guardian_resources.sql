CREATE TABLE IF NOT EXISTS guardian_resources (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  canonical_url TEXT NOT NULL,
  source_revision TEXT NOT NULL,
  record_json TEXT NOT NULL CHECK (json_valid(record_json)),
  review_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (review_status IN ('draft', 'reviewed', 'accepted', 'archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (owner_id, canonical_url, source_revision)
);

CREATE INDEX IF NOT EXISTS idx_guardian_resources_owner_updated
  ON guardian_resources(owner_id, updated_at DESC, id ASC);

CREATE TABLE IF NOT EXISTS guardian_resource_events (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL REFERENCES guardian_resources(id),
  owner_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'reviewed', 'accepted', 'archived')),
  detail_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(detail_json)),
  occurred_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_guardian_resource_events_owner_resource
  ON guardian_resource_events(owner_id, resource_id, occurred_at DESC, id DESC);

CREATE TRIGGER IF NOT EXISTS trg_guardian_resource_created
AFTER INSERT ON guardian_resources
BEGIN
  INSERT INTO guardian_resource_events (
    id, resource_id, owner_id, event_type, detail_json, occurred_at
  ) VALUES (
    'created:' || NEW.id,
    NEW.id,
    NEW.owner_id,
    'created',
    json_object('sourceRevision', NEW.source_revision, 'reviewStatus', NEW.review_status),
    NEW.created_at
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_guardian_resource_events_no_update
BEFORE UPDATE ON guardian_resource_events
BEGIN
  SELECT RAISE(ABORT, 'guardian resource events are append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_guardian_resource_events_no_delete
BEFORE DELETE ON guardian_resource_events
BEGIN
  SELECT RAISE(ABORT, 'guardian resource events are append-only');
END;
