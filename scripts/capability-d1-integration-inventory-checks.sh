#!/usr/bin/env bash
set -euo pipefail

run_sql() {
  wrangler d1 execute aegis-capabilities-test --local --config wrangler.d1-test.toml \
    --persist-to .wrangler/test-capability-d1 --command "$1"
}

expect_rejected() {
  local label="$1"
  local statement="$2"
  if run_sql "$statement" >/dev/null 2>&1; then
    echo "Expected integration inventory constraint to reject: $label"
    exit 1
  fi
  echo "Rejected as expected: $label"
}

expect_rejected "duplicate connection key" "INSERT INTO integration_connections (id, principal_id, integration_id, connection_key, connection_type, auth_mode, account_alias, platform_account_id, platform_connection_id, allowed_tool_slugs_json, scopes_json, status, last_observed_at, health_state, health_checked_at, created_by, created_at, updated_at, revoked_at) VALUES ('integration-duplicate-smoke', 'owner', 'composio-github-smoke', 'personal', 'instant_platform_managed', 'shared_platform_account', 'Duplicate', 'acct-duplicate', NULL, '[]', '[]', 'connected_unverified', '2026-11-16T00:00:00.000Z', 'unknown', NULL, 'owner', '2026-11-16T00:00:00.000Z', '2026-11-16T00:00:00.000Z', NULL)"

expect_rejected "public connection with credential auth" "INSERT INTO integration_connections (id, principal_id, integration_id, connection_key, connection_type, auth_mode, account_alias, platform_account_id, platform_connection_id, allowed_tool_slugs_json, scopes_json, status, last_observed_at, health_state, health_checked_at, created_by, created_at, updated_at, revoked_at) VALUES ('integration-invalid-auth-smoke', 'owner', 'public-weather-smoke', 'bad-auth', 'public_no_auth', 'api_key', 'Bad auth', NULL, NULL, '[]', '[]', 'connected_unverified', '2026-11-16T00:00:00.000Z', 'unknown', NULL, 'owner', '2026-11-16T00:00:00.000Z', '2026-11-16T00:00:00.000Z', NULL)"

expect_rejected "wildcard allowed tool slug" "INSERT INTO integration_connections (id, principal_id, integration_id, connection_key, connection_type, auth_mode, account_alias, platform_account_id, platform_connection_id, allowed_tool_slugs_json, scopes_json, status, last_observed_at, health_state, health_checked_at, created_by, created_at, updated_at, revoked_at) VALUES ('integration-wildcard-smoke', 'owner', 'composio-github-smoke', 'wildcard', 'instant_platform_managed', 'shared_platform_account', 'Wildcard', NULL, NULL, '[\"*\"]', '[]', 'connected_unverified', '2026-11-16T00:00:00.000Z', 'unknown', NULL, 'owner', '2026-11-16T00:00:00.000Z', '2026-11-16T00:00:00.000Z', NULL)"

expect_rejected "healthy without timestamped probe" "INSERT INTO integration_connections (id, principal_id, integration_id, connection_key, connection_type, auth_mode, account_alias, platform_account_id, platform_connection_id, allowed_tool_slugs_json, scopes_json, status, last_observed_at, health_state, health_checked_at, created_by, created_at, updated_at, revoked_at) VALUES ('integration-unverified-health-smoke', 'owner', 'composio-github-smoke', 'unverified-health', 'instant_platform_managed', 'shared_platform_account', 'Unverified health', NULL, NULL, '[]', '[]', 'connected_unverified', '2026-11-16T00:00:00.000Z', 'healthy', NULL, 'owner', '2026-11-16T00:00:00.000Z', '2026-11-16T00:00:00.000Z', NULL)"

expect_rejected "connected status without a verified health observation" "INSERT INTO integration_connections (id, principal_id, integration_id, connection_key, connection_type, auth_mode, account_alias, platform_account_id, platform_connection_id, allowed_tool_slugs_json, scopes_json, status, last_observed_at, health_state, health_checked_at, created_by, created_at, updated_at, revoked_at) VALUES ('integration-unverified-connected-smoke', 'owner', 'composio-github-smoke', 'unverified-connected', 'instant_platform_managed', 'shared_platform_account', 'Unverified connected', NULL, 'composio-platform-connection-smoke', '[]', '[]', 'connected', '2026-11-16T00:00:00.000Z', 'unknown', NULL, 'owner', '2026-11-16T00:00:00.000Z', '2026-11-16T00:00:00.000Z', NULL)"

expect_rejected "unknown platform credential connection" "INSERT INTO integration_connections (id, principal_id, integration_id, connection_key, connection_type, auth_mode, account_alias, platform_account_id, platform_connection_id, allowed_tool_slugs_json, scopes_json, status, last_observed_at, health_state, health_checked_at, created_by, created_at, updated_at, revoked_at) VALUES ('integration-invalid-platform-connection', 'owner', 'composio-github-smoke', 'invalid-platform-link', 'owner_private', 'api_key', 'Invalid platform link', NULL, 'missing-connection', '[]', '[]', 'connected_unverified', '2026-11-16T00:00:00.000Z', 'unknown', NULL, 'owner', '2026-11-16T00:00:00.000Z', '2026-11-16T00:00:00.000Z', NULL)"
