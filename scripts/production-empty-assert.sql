-- Assert the complete 0001-0017 chain on a fresh isolated local D1 database.
DROP TABLE IF EXISTS __aegis_migration_assertions;
CREATE TABLE __aegis_migration_assertions (
  passed INTEGER NOT NULL CHECK (passed = 1)
);
INSERT INTO __aegis_migration_assertions (passed)
SELECT
  (SELECT COUNT(*) FROM d1_migrations) = 17
  AND NOT EXISTS (
    SELECT 1 FROM (
      SELECT 'capability_approvals' AS name UNION ALL
      SELECT 'capability_grants' UNION ALL
      SELECT 'capability_connections' UNION ALL
      SELECT 'capability_secrets' UNION ALL
      SELECT 'capability_invocation_audit' UNION ALL
      SELECT 'capability_invocation_limits' UNION ALL
      SELECT 'project_spaces' UNION ALL
      SELECT 'project_space_events' UNION ALL
      SELECT 'system_state' UNION ALL
      SELECT 'auth_sessions' UNION ALL
      SELECT 'login_attempts' UNION ALL
      SELECT 'aegis_memories' UNION ALL
      SELECT 'aegis_memory_events' UNION ALL
      SELECT 'aegis_tenants' UNION ALL
      SELECT 'aegis_principals' UNION ALL
      SELECT 'aegis_tenant_memberships' UNION ALL
      SELECT 'aegis_principal_credentials' UNION ALL
      SELECT 'aegis_tenant_invitations' UNION ALL
      SELECT 'aegis_account_recovery_tokens'
    ) expected
    WHERE NOT EXISTS (
      SELECT 1 FROM sqlite_schema actual
      WHERE actual.type = 'table' AND actual.name = expected.name
    )
  )
  AND NOT EXISTS (SELECT 1 FROM pragma_foreign_key_check)
  AND EXISTS (SELECT 1 FROM sqlite_schema WHERE type='trigger' AND name='trg_auth_sessions_identity_insert')
  AND EXISTS (SELECT 1 FROM sqlite_schema WHERE type='trigger' AND name='trg_auth_sessions_identity_update')
  AND EXISTS (SELECT 1 FROM sqlite_schema WHERE type='trigger' AND name='trg_membership_revoke_sessions')
  AND EXISTS (SELECT 1 FROM sqlite_schema WHERE type='trigger' AND name='trg_membership_active_insert_guard')
  AND EXISTS (SELECT 1 FROM sqlite_schema WHERE type='trigger' AND name='trg_invitation_active_tenant_insert')
  AND EXISTS (SELECT 1 FROM sqlite_schema WHERE type='trigger' AND name='trg_recovery_active_tenant_insert');
