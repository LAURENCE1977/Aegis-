#!/usr/bin/env bash
set -euo pipefail

CONFIG=wrangler.runtime-d1-test.toml
DB=aegis-runtime-test
PERSIST=.wrangler/test-runtime-d1

insert_nonce() {
  local owner="$1"
  local source="$2"
  local nonce="$3"
  local snapshot="$4"
  local digest="$5"
  wrangler d1 execute "$DB" --local --config "$CONFIG" --persist-to "$PERSIST" --command "INSERT INTO software_inventory_nonces (owner_id, source_id, nonce, key_id, snapshot_id, inventory_digest, signed_at, accepted_at) VALUES ('$owner', '$source', '$nonce', 'key-2026-01', '$snapshot', '$digest', '2026-11-21T13:56:00.000Z', '2026-11-21T14:00:00.000Z')"
}

expect_rejected() {
  local description="$1"
  local sql="$2"
  if wrangler d1 execute "$DB" --local --config "$CONFIG" --persist-to "$PERSIST" --command "$sql"; then
    echo "Expected runtime D1 to reject: $description"
    exit 1
  fi
}

NONCE=nonce-0000000000000001
DIGEST=sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa

insert_nonce owner-a endpoint-01 "$NONCE" snapshot-001 "$DIGEST"
expect_rejected "replayed nonce for the same owner and source" "INSERT INTO software_inventory_nonces (owner_id, source_id, nonce, key_id, snapshot_id, inventory_digest, signed_at, accepted_at) VALUES ('owner-a', 'endpoint-01', '$NONCE', 'key-2026-01', 'snapshot-tampered', 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', '2026-11-21T13:56:00.000Z', '2026-11-21T14:01:00.000Z')"

# The same opaque nonce is valid for a different owner or a different source.
insert_nonce owner-b endpoint-01 "$NONCE" snapshot-002 "$DIGEST"
insert_nonce owner-a endpoint-02 "$NONCE" snapshot-003 "$DIGEST"

expect_rejected "nonce record update" "UPDATE software_inventory_nonces SET snapshot_id = 'tampered' WHERE owner_id = 'owner-a' AND source_id = 'endpoint-01' AND nonce = '$NONCE'"
expect_rejected "nonce record deletion" "DELETE FROM software_inventory_nonces WHERE owner_id = 'owner-a' AND source_id = 'endpoint-01' AND nonce = '$NONCE'"

