CREATE TRIGGER IF NOT EXISTS trg_forge_candidate_review_audit
AFTER UPDATE OF licence_review, decision, status ON forge_candidates
WHEN OLD.licence_review <> NEW.licence_review
  OR OLD.decision <> NEW.decision
  OR OLD.status <> NEW.status
BEGIN
  INSERT INTO forge_candidate_events (
    id, candidate_id, owner_id, event_type,
    from_status, to_status, from_decision, to_decision, occurred_at
  )
  SELECT
    lower(hex(randomblob(16))), NEW.id, NEW.owner_id, 'review_changed',
    OLD.status, NEW.status, OLD.decision, NEW.decision, NEW.updated_at
  WHERE OLD.licence_review <> NEW.licence_review
     OR OLD.decision <> NEW.decision;

  INSERT INTO forge_candidate_events (
    id, candidate_id, owner_id, event_type,
    from_status, to_status, from_decision, to_decision, occurred_at
  )
  SELECT
    lower(hex(randomblob(16))), NEW.id, NEW.owner_id, 'status_changed',
    OLD.status, NEW.status, OLD.decision, NEW.decision, NEW.updated_at
  WHERE OLD.status <> NEW.status;
END;
