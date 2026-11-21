-- A source nonce is consumed once per owner/source pair. Rows are retained
-- indefinitely: deleting old nonces would reopen a replay window.
CREATE TABLE IF NOT EXISTS software_inventory_nonces (
  owner_id TEXT NOT NULL CHECK (length(owner_id) BETWEEN 1 AND 80),
  source_id TEXT NOT NULL CHECK (length(source_id) BETWEEN 1 AND 80),
  nonce TEXT NOT NULL CHECK (length(nonce) BETWEEN 16 AND 128),
  key_id TEXT NOT NULL CHECK (length(key_id) BETWEEN 1 AND 80),
  snapshot_id TEXT NOT NULL CHECK (length(snapshot_id) BETWEEN 1 AND 128),
  inventory_digest TEXT NOT NULL CHECK (
    length(inventory_digest) = 71 AND substr(inventory_digest, 1, 7) = 'sha256:' AND substr(inventory_digest, 8) NOT GLOB '*[^0-9a-f]*'
  ),
  signed_at TEXT NOT NULL,
  accepted_at TEXT NOT NULL,
  PRIMARY KEY (owner_id, source_id, nonce)
);

CREATE INDEX IF NOT EXISTS idx_software_inventory_nonces_owner_source_accepted
  ON software_inventory_nonces (owner_id, source_id, accepted_at DESC);

CREATE TRIGGER IF NOT EXISTS software_inventory_nonces_no_update
BEFORE UPDATE ON software_inventory_nonces
BEGIN
  SELECT RAISE(ABORT, 'software inventory nonce records are append-only');
END;

CREATE TRIGGER IF NOT EXISTS software_inventory_nonces_no_delete
BEFORE DELETE ON software_inventory_nonces
BEGIN
  SELECT RAISE(ABORT, 'software inventory nonce records are append-only');
END;
