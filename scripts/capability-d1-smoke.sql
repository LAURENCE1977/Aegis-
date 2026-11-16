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
