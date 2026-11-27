-- Assert the complete 0001-0018 chain on a fresh isolated local D1 database.
DROP TABLE IF EXISTS __aegis_migration_assertions;
CREATE TABLE __aegis_migration_assertions (
  passed INTEGER NOT NULL CHECK (passed = 1)
);
INSERT INTO __aegis_migration_assertions (passed)
SELECT
  (SELECT COUNT(*) FROM d1_migrations) = 18
  AND NOT EXISTS (
    WITH expected(name) AS (VALUES
      ('capability_approvals'), ('capability_grants'), ('capability_connections'),
      ('capability_secrets'), ('capability_invocation_audit'), ('capability_invocation_limits'),
      ('project_spaces'), ('project_space_events'), ('system_state'), ('auth_sessions'),
      ('login_attempts'), ('aegis_memories'), ('aegis_memory_events'), ('aegis_tenants'),
      ('aegis_principals'), ('aegis_tenant_memberships'), ('aegis_principal_credentials'),
      ('aegis_tenant_invitations'), ('aegis_account_recovery_tokens')
    )
    SELECT 1 FROM expected
    WHERE NOT EXISTS (
      SELECT 1 FROM sqlite_schema actual
      WHERE actual.type = 'table' AND actual.name = expected.name
    )
  )
  AND EXISTS (SELECT 1 FROM sqlite_schema WHERE type='index' AND name='idx_aegis_memories_cursor_scope')
  AND NOT EXISTS (SELECT 1 FROM pragma_foreign_key_check)
  AND EXISTS (SELECT 1 FROM sqlite_schema WHERE type='trigger' AND name='trg_auth_sessions_identity_insert')
  AND EXISTS (SELECT 1 FROM sqlite_schema WHERE type='trigger' AND name='trg_auth_sessions_identity_update')
  AND EXISTS (SELECT 1 FROM sqlite_schema WHERE type='trigger' AND name='trg_membership_revoke_sessions')
  AND EXISTS (SELECT 1 FROM sqlite_schema WHERE type='trigger' AND name='trg_membership_active_insert_guard')
  AND EXISTS (SELECT 1 FROM sqlite_schema WHERE type='trigger' AND name='trg_invitation_active_tenant_insert')
  AND EXISTS (SELECT 1 FROM sqlite_schema WHERE type='trigger' AND name='trg_recovery_active_tenant_insert')
  AND EXISTS (SELECT 1 FROM sqlite_schema WHERE type='trigger' AND name='trg_aegis_memory_events_no_update')
  AND EXISTS (SELECT 1 FROM sqlite_schema WHERE type='trigger' AND name='trg_aegis_memory_events_no_delete');
