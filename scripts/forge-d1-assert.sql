CREATE TABLE forge_smoke_assertions (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  ok INTEGER NOT NULL CHECK (ok = 1)
);
INSERT INTO forge_smoke_assertions (id, ok)
SELECT 1,
  CASE WHEN
    (SELECT COUNT(*) FROM forge_candidate_events WHERE candidate_id = 'forge-smoke') = 3
    AND
    (SELECT COUNT(*) FROM forge_candidate_events WHERE candidate_id = 'forge-smoke' AND event_type = 'review_changed') = 1
    AND
    (SELECT COUNT(*) FROM forge_candidate_events WHERE candidate_id = 'forge-smoke' AND event_type = 'status_changed') = 1
    AND
    (SELECT COUNT(*) FROM forge_candidates WHERE id = 'forge-smoke' AND status = 'approved' AND licence_review = 'verified') = 1
  THEN 1 ELSE 0 END;
