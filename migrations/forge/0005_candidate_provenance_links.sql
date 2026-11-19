CREATE UNIQUE INDEX IF NOT EXISTS idx_forge_source_provenance_id_owner
  ON forge_source_provenance (id, owner_id);

CREATE TABLE IF NOT EXISTS forge_candidate_provenance_links (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL,
  candidate_id TEXT NOT NULL,
  provenance_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (owner_id, candidate_id, provenance_id),
  FOREIGN KEY (candidate_id, owner_id)
    REFERENCES forge_candidates (id, owner_id),
  FOREIGN KEY (provenance_id, owner_id)
    REFERENCES forge_source_provenance (id, owner_id)
);

CREATE INDEX IF NOT EXISTS idx_forge_candidate_provenance_owner
  ON forge_candidate_provenance_links (owner_id, candidate_id, created_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_forge_candidate_provenance_links_no_update
BEFORE UPDATE ON forge_candidate_provenance_links
BEGIN
  SELECT RAISE(ABORT, 'AEGIS Forge candidate provenance links are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_forge_candidate_provenance_links_no_delete
BEFORE DELETE ON forge_candidate_provenance_links
BEGIN
  SELECT RAISE(ABORT, 'AEGIS Forge candidate provenance links are append-only');
END;
