-- CHECK constraints make this script fail if any legacy conversion or FK invariant is broken.
DROP TABLE IF EXISTS __aegis_migration_assertions;
CREATE TABLE __aegis_migration_assertions (
  passed INTEGER NOT NULL CHECK (passed = 1)
);
INSERT INTO __aegis_migration_assertions (passed)
SELECT
  (SELECT COUNT(*) FROM d1_migrations) = 17
  AND EXISTS (SELECT 1 FROM aegis_tenants WHERE id = 'org-root')
  AND EXISTS (SELECT 1 FROM aegis_principals WHERE id = 'usr-root' AND tenant_id = 'org-root')
  AND EXISTS (SELECT 1 FROM aegis_tenant_memberships
              WHERE principal_id = 'usr-root' AND tenant_id = 'org-root'
                AND role = 'owner' AND status = 'active')
  AND EXISTS (SELECT 1 FROM auth_sessions
              WHERE session_id = 'legacy-owner-session'
                AND principal_id = 'usr-root' AND tenant_id = 'org-root'
                AND roles_json = '["owner"]')
  AND EXISTS (SELECT 1 FROM project_spaces
              WHERE id = 'legacy-space' AND principal_id = 'usr-root' AND tenant_id = 'org-root')
  AND EXISTS (SELECT 1 FROM project_space_events
              WHERE id = 'legacy-space-event' AND principal_id = 'usr-root' AND tenant_id = 'org-root')
  AND EXISTS (SELECT 1 FROM aegis_memories
              WHERE id = 'legacy-memory' AND principal_id = 'usr-root' AND tenant_id = 'org-root')
  AND EXISTS (SELECT 1 FROM aegis_memory_events
              WHERE memory_id = 'legacy-memory' AND principal_id = 'usr-root' AND tenant_id = 'org-root')
  AND NOT EXISTS (SELECT 1 FROM pragma_foreign_key_check);
