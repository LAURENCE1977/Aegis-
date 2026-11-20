INSERT INTO capability_approvals (
  id, principal_id, capability_id, capability_version, action_id, resource_id,
  operation_summary, connection_id, input_digest, requested_by, requested_at,
  expires_at, status, decided_by, decided_at, consumed_at
) VALUES (
  'approval-smoke', 'owner', 'aegis-module-catalogue', '0.1.0', 'list',
  'aegis:modules', 'List the local AEGIS module catalogue', NULL,
  'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'owner', '2026-11-16T00:00:00.000Z', '2026-11-17T00:00:00.000Z',
  'pending', NULL, NULL, NULL
);

INSERT INTO capability_grants (
  id, principal_id, capability_id, capability_version, resource_id,
  scopes_json, status, created_by, created_at, expires_at, revoked_at
) VALUES (
  'grant-smoke', 'owner', 'aegis-module-catalogue', '0.1.0', 'aegis:modules',
  '["aegis:module-catalogue:read"]', 'active', 'owner',
  '2026-11-16T00:00:00.000Z', '2026-11-17T00:00:00.000Z', NULL
);

INSERT INTO capability_connections (
  id, principal_id, provider_id, secret_ref, scopes_json, created_by,
  created_at, expires_at, status, revoked_at
) VALUES (
  'connection-smoke', 'owner', 'aegis-core',
  'vault://connections/550e8400-e29b-41d4-a716-446655440000',
  '["aegis:module-catalogue:read"]', 'owner',
  '2026-11-16T00:00:00.000Z', NULL, 'active', NULL
);

INSERT INTO capability_secrets (
  secret_id, principal_id, provider_id, key_version, iv_b64,
  ciphertext_b64, created_at, updated_at, status, revoked_at
) VALUES (
  '550e8400-e29b-41d4-a716-446655440000', 'owner', 'aegis-core', 'v1',
  'aXY=', 'Y2lwaGVydGV4dA==', '2026-11-16T00:00:00.000Z',
  '2026-11-16T00:00:00.000Z', 'active', NULL
);

INSERT INTO capability_invocation_audit (
  id, invocation_id, event_type, principal_id, capability_id,
  capability_version, action_id, resource_id, input_digest, reason_code, occurred_at
) VALUES (
  'audit-smoke', 'invocation-smoke', 'invocation_succeeded', 'owner',
  'aegis-module-catalogue', '0.1.0', 'list', 'aegis:modules',
  'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  'SUCCESS', '2026-11-16T00:00:00.000Z'
);
INSERT INTO capability_invocation_limits (
  principal_id, capability_id, action_id, window_start_ms, request_count, updated_at
) VALUES (
  'owner', 'aegis-module-catalogue', 'list', 1794787200000, 1,
  '2026-11-16T00:00:00.000Z'
);


INSERT INTO capability_connections (
  id, principal_id, provider_id, secret_ref, scopes_json, created_by,
  created_at, expires_at, status, revoked_at
) VALUES (
  'composio-platform-connection-smoke', 'owner', 'composio-smoke',
  'vault://connections/550e8400-e29b-41d4-a716-446655440001',
  '["composio:tools:read"]', 'owner',
  '2026-11-16T00:00:00.000Z', NULL, 'active', NULL
);

INSERT INTO capability_secrets (
  secret_id, principal_id, provider_id, key_version, iv_b64,
  ciphertext_b64, created_at, updated_at, status, revoked_at
) VALUES (
  '550e8400-e29b-41d4-a716-446655440001', 'owner', 'composio-smoke', 'v1',
  'aXY=', 'Y2lwaGVydGV4dA==', '2026-11-16T00:00:00.000Z',
  '2026-11-16T00:00:00.000Z', 'active', NULL
);

INSERT INTO integration_providers (
  id, display_name, source_url, verified_at, status, created_by, created_at
) VALUES (
  'composio-smoke', 'Composio', 'https://composio.dev/',
  '2026-11-16T00:00:00.000Z', 'reviewed', 'owner', '2026-11-16T00:00:00.000Z'
);

INSERT INTO integration_definitions (
  id, provider_id, slug, display_name, description, auth_mode, source_url,
  schema_version, schema_hash, status, created_by, created_at
) VALUES (
  'composio-github-smoke', 'composio-smoke', 'github', 'GitHub',
  'GitHub toolkit metadata smoke fixture.', 'shared_platform_account',
  'https://composio.dev/toolkits/github', 'v1',
  'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'reviewed', 'owner', '2026-11-16T00:00:00.000Z'
);

INSERT INTO integration_connections (
  id, principal_id, integration_id, connection_key, connection_type, auth_mode,
  account_alias, platform_account_id, platform_connection_id,
  allowed_tool_slugs_json, scopes_json, status, last_observed_at,
  health_state, health_checked_at, created_by, created_at, updated_at, revoked_at
) VALUES
(
  'integration-connection-smoke-1', 'owner', 'composio-github-smoke', 'personal',
  'instant_platform_managed', 'shared_platform_account', 'Personal GitHub',
  'acct-opaque-personal', 'composio-platform-connection-smoke', '["GITHUB_GET_REPO"]',
  '["github:public-metadata:read"]', 'connected_unverified',
  '2026-11-16T00:00:00.000Z', 'unknown', NULL, 'owner',
  '2026-11-16T00:00:00.000Z', '2026-11-16T00:00:00.000Z', NULL
),
(
  'integration-connection-smoke-2', 'owner', 'composio-github-smoke', 'work',
  'instant_platform_managed', 'shared_platform_account', 'Work GitHub',
  'acct-opaque-work', 'composio-platform-connection-smoke', '["GITHUB_GET_REPO"]',
  '["github:public-metadata:read"]', 'connected_unverified',
  '2026-11-16T00:00:00.000Z', 'unknown', NULL, 'owner',
  '2026-11-16T00:00:00.000Z', '2026-11-16T00:00:00.000Z', NULL
);

INSERT INTO integration_definitions (
  id, provider_id, slug, display_name, description, auth_mode, source_url,
  schema_version, schema_hash, status, created_by, created_at
) VALUES (
  'public-weather-smoke', 'composio-smoke', 'weather', 'Public Weather',
  'Public no-auth integration fixture.', 'none_public',
  'https://example.com/weather', NULL, NULL, 'discovered', 'owner',
  '2026-11-16T00:00:00.000Z'
);

INSERT INTO integration_connections (
  id, principal_id, integration_id, connection_key, connection_type, auth_mode,
  account_alias, platform_account_id, platform_connection_id,
  allowed_tool_slugs_json, scopes_json, status, last_observed_at,
  health_state, health_checked_at, created_by, created_at, updated_at, revoked_at
) VALUES (
  'integration-connection-public-smoke', 'owner', 'public-weather-smoke', 'public-default',
  'public_no_auth', 'none_public', 'Public weather', NULL, NULL,
  '["WEATHER_FORECAST"]', '[]', 'connected_unverified',
  '2026-11-16T00:00:00.000Z', 'unknown', NULL, 'owner',
  '2026-11-16T00:00:00.000Z', '2026-11-16T00:00:00.000Z', NULL
);
