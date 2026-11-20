#!/usr/bin/env bash
set -euo pipefail

CONFIG="wrangler.d1-test.toml"
PERSIST=".wrangler/test-capability-d1"
DB="aegis-capabilities-test"

# The audit table must exist before any inventory state can be trusted.
wrangler d1 execute "$DB" --local --config "$CONFIG" --persist-to "$PERSIST" --command "SELECT COUNT(*) AS event_count FROM integration_connection_events"

# A public/no-auth fixture avoids introducing any credential references.
wrangler d1 execute "$DB" --local --config "$CONFIG" --persist-to "$PERSIST" --command "INSERT INTO integration_providers (id, display_name, source_url, verified_at, status, created_by, created_at) VALUES ('audit-provider', 'Audit Provider', 'https://example.com/', NULL, 'discovered', 'owner', '2026-11-20T00:00:00.000Z')"
wrangler d1 execute "$DB" --local --config "$CONFIG" --persist-to "$PERSIST" --command "INSERT INTO integration_definitions (id, provider_id, slug, display_name, description, auth_mode, source_url, schema_version, schema_hash, status, created_by, created_at) VALUES ('audit-integration', 'audit-provider', 'audit-demo', 'Audit Demo', 'Audit fixture', 'none_public', 'https://example.com/api', NULL, NULL, 'discovered', 'owner', '2026-11-20T00:00:00.000Z')"
wrangler d1 execute "$DB" --local --config "$CONFIG" --persist-to "$PERSIST" --command "INSERT INTO integration_connections (id, principal_id, integration_id, connection_key, connection_type, auth_mode, account_alias, platform_account_id, platform_connection_id, allowed_tool_slugs_json, scopes_json, status, last_observed_at, health_state, health_checked_at, created_by, created_at, updated_at, revoked_at) VALUES ('audit-connection', 'owner', 'audit-integration', 'audit-demo', 'public_no_auth', 'none_public', 'Audit fixture', NULL, NULL, '[\"DEMO_READ\"]', '[]', 'connected_unverified', '2026-11-20T00:00:00.000Z', 'unknown', NULL, 'owner', '2026-11-20T00:00:00.000Z', '2026-11-20T00:00:00.000Z', NULL)"

# Creation, health verification and revocation must each leave durable lineage.
wrangler d1 execute "$DB" --local --config "$CONFIG" --persist-to "$PERSIST" --command "UPDATE integration_connections SET health_state = 'healthy', health_checked_at = '2026-11-20T00:01:00.000Z', status = 'connected', updated_at = '2026-11-20T00:01:00.000Z' WHERE id = 'audit-connection'"
wrangler d1 execute "$DB" --local --config "$CONFIG" --persist-to "$PERSIST" --command "UPDATE integration_connections SET status = 'revoked', health_state = 'disabled', revoked_at = '2026-11-20T00:02:00.000Z', updated_at = '2026-11-20T00:02:00.000Z' WHERE id = 'audit-connection'"

EVENTS="$(wrangler d1 execute "$DB" --local --config "$CONFIG" --persist-to "$PERSIST" --command "SELECT event_type FROM integration_connection_events WHERE connection_id = 'audit-connection' ORDER BY occurred_at, id" 2>&1)"
for expected in created health_observed revoked; do
  if ! grep -q "$expected" <<<"$EVENTS"; then
    echo "Expected integration audit event: $expected"
    exit 1
  fi
done

# The event ledger is append-only.
if wrangler d1 execute "$DB" --local --config "$CONFIG" --persist-to "$PERSIST" --command "UPDATE integration_connection_events SET event_type = 'tampered' WHERE connection_id = 'audit-connection'"; then
  echo "Expected integration audit update trigger to reject mutation."
  exit 1
fi
if wrangler d1 execute "$DB" --local --config "$CONFIG" --persist-to "$PERSIST" --command "DELETE FROM integration_connection_events WHERE connection_id = 'audit-connection'"; then
  echo "Expected integration audit delete trigger to reject mutation."
  exit 1
fi
