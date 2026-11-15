CREATE TRIGGER IF NOT EXISTS trg_forge_candidate_identity_immutable
BEFORE UPDATE ON forge_candidates
WHEN OLD.id <> NEW.id
  OR OLD.owner_id <> NEW.owner_id
  OR OLD.source_type <> NEW.source_type
  OR OLD.source_url <> NEW.source_url
  OR OLD.version <> NEW.version
  OR OLD.metadata_json <> NEW.metadata_json
  OR OLD.created_at <> NEW.created_at
BEGIN
  SELECT RAISE(ABORT, 'AEGIS Forge candidate source identity is immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_forge_candidate_licence_gate
BEFORE UPDATE OF licence_review, decision, status ON forge_candidates
WHEN (NEW.decision IN ('reuse','adapt','combine') AND NEW.licence_review <> 'verified')
  OR (NEW.status = 'approved' AND (NEW.decision = 'unassessed' OR NEW.licence_review <> 'verified'))
BEGIN
  SELECT RAISE(ABORT, 'AEGIS Forge candidate requires verified licence review before reuse or approval');
END;
