PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS forge_knowledge_records (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 1 AND 80 AND id NOT GLOB '*[^a-z0-9-]*'),
  owner_id TEXT NOT NULL CHECK (length(owner_id) BETWEEN 1 AND 80),
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
  domain TEXT NOT NULL CHECK (length(domain) BETWEEN 1 AND 80 AND domain NOT GLOB '*[^a-z0-9-]*'),
  knowledge_type TEXT NOT NULL CHECK (knowledge_type IN ('research','practice','standard','benchmark','pattern','technique')),
  summary TEXT NOT NULL CHECK (length(trim(summary)) BETWEEN 1 AND 4000),
  evidence_level TEXT NOT NULL CHECK (evidence_level IN ('high','medium','low','experimental')),
  status TEXT NOT NULL CHECK (status IN ('draft','reviewed','accepted','superseded')),
  sources_json TEXT NOT NULL CHECK (json_valid(sources_json) AND json_type(sources_json) = 'array' AND json_array_length(sources_json) BETWEEN 1 AND 20 AND length(sources_json) <= 65536),
  limitations_json TEXT NOT NULL CHECK (json_valid(limitations_json) AND json_type(limitations_json) = 'array' AND length(limitations_json) <= 16384),
  applicable_capabilities_json TEXT NOT NULL CHECK (json_valid(applicable_capabilities_json) AND json_type(applicable_capabilities_json) = 'array' AND length(applicable_capabilities_json) <= 16384),
  review_note TEXT CHECK (review_note IS NULL OR length(review_note) <= 1000),
  reviewer_id TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  reviewed_at TEXT,
  accepted_at TEXT,
  superseded_at TEXT,
  UNIQUE (owner_id, id),
  CHECK (status = 'draft' OR (review_note IS NOT NULL AND length(trim(review_note)) >= 10 AND reviewer_id IS NOT NULL)),
  CHECK (status <> 'reviewed' OR reviewed_at IS NOT NULL),
  CHECK (status <> 'accepted' OR (accepted_at IS NOT NULL AND evidence_level IN ('high','medium'))),
  CHECK (status <> 'superseded' OR superseded_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_forge_knowledge_owner_status_domain
  ON forge_knowledge_records (owner_id, status, domain, updated_at DESC, id ASC);

CREATE INDEX IF NOT EXISTS idx_forge_knowledge_owner_type_status
  ON forge_knowledge_records (owner_id, knowledge_type, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS forge_knowledge_events (
  id TEXT PRIMARY KEY NOT NULL,
  record_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('created','reviewed','accepted','superseded')),
  from_status TEXT,
  to_status TEXT NOT NULL,
  detail_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(detail_json) AND length(detail_json) <= 4096),
  occurred_at TEXT NOT NULL,
  FOREIGN KEY (record_id, owner_id)
    REFERENCES forge_knowledge_records (id, owner_id)
);

CREATE INDEX IF NOT EXISTS idx_forge_knowledge_events_owner_record_time
  ON forge_knowledge_events (owner_id, record_id, occurred_at DESC, id DESC);

CREATE TRIGGER IF NOT EXISTS trg_forge_knowledge_created
AFTER INSERT ON forge_knowledge_records
BEGIN
  INSERT INTO forge_knowledge_events (
    id, record_id, owner_id, event_type, from_status, to_status, detail_json, occurred_at
  ) VALUES (
    lower(hex(randomblob(16))), NEW.id, NEW.owner_id, 'created', NULL, NEW.status,
    '{}', NEW.created_at
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_forge_knowledge_identity_immutable
BEFORE UPDATE ON forge_knowledge_records
WHEN OLD.id <> NEW.id
  OR OLD.owner_id <> NEW.owner_id
  OR OLD.created_at <> NEW.created_at
BEGIN
  SELECT RAISE(ABORT, 'AEGIS Forge knowledge identity is immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_forge_knowledge_content_immutable
BEFORE UPDATE OF title, domain, knowledge_type, summary, evidence_level,
  sources_json, limitations_json, applicable_capabilities_json ON forge_knowledge_records
WHEN OLD.status <> 'draft' AND (
  OLD.title <> NEW.title OR OLD.domain <> NEW.domain OR
  OLD.knowledge_type <> NEW.knowledge_type OR OLD.summary <> NEW.summary OR
  OLD.evidence_level <> NEW.evidence_level OR OLD.sources_json <> NEW.sources_json OR
  OLD.limitations_json <> NEW.limitations_json OR
  OLD.applicable_capabilities_json <> NEW.applicable_capabilities_json
)
BEGIN
  SELECT RAISE(ABORT, 'AEGIS Forge knowledge content is immutable after review');
END;

CREATE TRIGGER IF NOT EXISTS trg_forge_knowledge_review_fields_guard
BEFORE UPDATE OF review_note, reviewer_id, reviewed_at, accepted_at, superseded_at ON forge_knowledge_records
WHEN OLD.status = NEW.status AND (
  OLD.review_note IS NOT NEW.review_note OR OLD.reviewer_id IS NOT NEW.reviewer_id OR
  OLD.reviewed_at IS NOT NEW.reviewed_at OR OLD.accepted_at IS NOT NEW.accepted_at OR
  OLD.superseded_at IS NOT NEW.superseded_at
)
BEGIN
  SELECT RAISE(ABORT, 'AEGIS Forge knowledge review fields change only with a status transition');
END;

CREATE TRIGGER IF NOT EXISTS trg_forge_knowledge_status_transition
BEFORE UPDATE OF status ON forge_knowledge_records
WHEN NOT (
  (OLD.status = 'draft' AND NEW.status = 'reviewed'
    AND length(trim(NEW.review_note)) >= 10 AND NEW.reviewer_id IS NOT NULL
    AND NEW.reviewed_at IS NOT NULL)
  OR
  (OLD.status = 'reviewed' AND NEW.status = 'accepted'
    AND NEW.evidence_level IN ('high','medium')
    AND length(trim(NEW.review_note)) >= 10 AND NEW.reviewer_id IS NOT NULL
    AND NEW.accepted_at IS NOT NULL)
  OR
  (OLD.status = 'accepted' AND NEW.status = 'superseded'
    AND length(trim(NEW.review_note)) >= 10 AND NEW.reviewer_id IS NOT NULL
    AND NEW.superseded_at IS NOT NULL)
)
OR NEW.version <> OLD.version + 1
BEGIN
  SELECT RAISE(ABORT, 'AEGIS Forge knowledge status transition is not allowed');
END;

CREATE TRIGGER IF NOT EXISTS trg_forge_knowledge_review_event
AFTER UPDATE OF status ON forge_knowledge_records
WHEN OLD.status <> NEW.status
BEGIN
  INSERT INTO forge_knowledge_events (
    id, record_id, owner_id, event_type, from_status, to_status, detail_json, occurred_at
  ) VALUES (
    lower(hex(randomblob(16))), NEW.id, NEW.owner_id, NEW.status, OLD.status, NEW.status,
    json_object('reviewNote', NEW.review_note, 'reviewerId', NEW.reviewer_id,
      'evidenceLevel', NEW.evidence_level),
    NEW.updated_at
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_forge_knowledge_events_no_update
BEFORE UPDATE ON forge_knowledge_events
BEGIN
  SELECT RAISE(ABORT, 'AEGIS Forge knowledge events are append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_forge_knowledge_events_no_delete
BEFORE DELETE ON forge_knowledge_events
BEGIN
  SELECT RAISE(ABORT, 'AEGIS Forge knowledge events are append-only');
END;
