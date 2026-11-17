ALTER TABLE guardian_resources ADD COLUMN review_note TEXT NOT NULL DEFAULT '';
ALTER TABLE guardian_resources ADD COLUMN reviewer_id TEXT;

CREATE TRIGGER IF NOT EXISTS trg_guardian_resource_review_guard
BEFORE UPDATE ON guardian_resources
BEGIN
  SELECT CASE
    WHEN NEW.id != OLD.id OR NEW.owner_id != OLD.owner_id OR
         NEW.canonical_url != OLD.canonical_url OR NEW.source_revision != OLD.source_revision OR
         NEW.record_json != OLD.record_json OR NEW.created_at != OLD.created_at
    THEN RAISE(ABORT, 'guardian resource source content and identity are immutable')
  END;
  SELECT CASE
    WHEN NEW.review_status != OLD.review_status AND NOT (
      (OLD.review_status = 'draft' AND NEW.review_status IN ('reviewed', 'archived')) OR
      (OLD.review_status = 'reviewed' AND NEW.review_status IN ('accepted', 'archived')) OR
      (OLD.review_status = 'accepted' AND NEW.review_status = 'archived')
    ) THEN RAISE(ABORT, 'invalid guardian resource review transition')
  END;
  SELECT CASE
    WHEN NEW.review_status != OLD.review_status AND (
      length(trim(NEW.review_note)) < 1 OR length(NEW.review_note) > 2000 OR
      NEW.reviewer_id IS NULL OR length(trim(NEW.reviewer_id)) < 1 OR
      NEW.updated_at <= OLD.updated_at
    ) THEN RAISE(ABORT, 'guardian resource review requires note, reviewer and advancing timestamp')
  END;
  SELECT CASE
    WHEN NEW.review_status = 'accepted' AND OLD.review_status != 'accepted' AND (
      json_extract(OLD.record_json, '$.licence.review') != 'verified' OR
      json_extract(OLD.record_json, '$.licence.evidenceUrl') IS NULL OR
      substr(json_extract(OLD.record_json, '$.licence.evidenceUrl'), 1, 8) != 'https://'
    ) THEN RAISE(ABORT, 'guardian resource acceptance requires verified HTTPS licence evidence')
  END;
END;

CREATE TRIGGER IF NOT EXISTS trg_guardian_resource_review_event
AFTER UPDATE ON guardian_resources
WHEN NEW.review_status != OLD.review_status
BEGIN
  INSERT INTO guardian_resource_events (
    id, resource_id, owner_id, event_type, detail_json, occurred_at
  ) VALUES (
    'review:' || NEW.id || ':' || NEW.updated_at,
    NEW.id, NEW.owner_id, NEW.review_status,
    json_object(
      'fromStatus', OLD.review_status,
      'toStatus', NEW.review_status,
      'reviewerId', NEW.reviewer_id,
      'note', NEW.review_note
    ),
    NEW.updated_at
  );
END;