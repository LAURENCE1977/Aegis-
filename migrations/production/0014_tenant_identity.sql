-- Establish explicit tenant/principal scope for every persisted identity-bearing row.
-- Existing single-owner data is migrated to a deterministic root identity.
CREATE TABLE IF NOT EXISTS aegis_tenants (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aegis_principals (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (id, tenant_id),
  FOREIGN KEY (tenant_id) REFERENCES aegis_tenants(id)
);

INSERT OR IGNORE INTO aegis_tenants (id, name, created_at)
VALUES ('org-root', 'AEGIS Root Tenant', '2026-11-26T00:00:00.000Z');

INSERT OR IGNORE INTO aegis_principals (id, tenant_id, display_name, created_at)
VALUES ('usr-root', 'org-root', 'AEGIS Root Principal', '2026-11-26T00:00:00.000Z');

ALTER TABLE auth_sessions ADD COLUMN principal_id TEXT;
ALTER TABLE auth_sessions ADD COLUMN tenant_id TEXT;
ALTER TABLE auth_sessions ADD COLUMN roles_json TEXT;
UPDATE auth_sessions
SET principal_id = 'usr-root', tenant_id = 'org-root', roles_json = '["owner"]'
WHERE principal_id IS NULL OR tenant_id IS NULL OR roles_json IS NULL;

ALTER TABLE aegis_memories ADD COLUMN principal_id TEXT;
ALTER TABLE aegis_memories ADD COLUMN tenant_id TEXT;
UPDATE aegis_memories SET principal_id = 'usr-root', tenant_id = 'org-root'
WHERE owner_id = 'owner' AND (principal_id IS NULL OR tenant_id IS NULL);

ALTER TABLE project_spaces ADD COLUMN principal_id TEXT;
ALTER TABLE project_spaces ADD COLUMN tenant_id TEXT;
UPDATE project_spaces SET principal_id = 'usr-root', tenant_id = 'org-root'
WHERE owner_id = 'owner' AND (principal_id IS NULL OR tenant_id IS NULL);

ALTER TABLE project_space_events ADD COLUMN principal_id TEXT;
ALTER TABLE project_space_events ADD COLUMN tenant_id TEXT;
UPDATE project_space_events SET principal_id = 'usr-root', tenant_id = 'org-root'
WHERE owner_id = 'owner' AND (principal_id IS NULL OR tenant_id IS NULL);

ALTER TABLE aegis_memory_events ADD COLUMN principal_id TEXT;
ALTER TABLE aegis_memory_events ADD COLUMN tenant_id TEXT;
UPDATE aegis_memory_events SET principal_id = 'usr-root', tenant_id = 'org-root'
WHERE owner_id = 'owner' AND (principal_id IS NULL OR tenant_id IS NULL);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_principal_tenant_active
  ON auth_sessions (tenant_id, principal_id, expires_at) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_aegis_memories_tenant_principal_scope
  ON aegis_memories (tenant_id, principal_id, project_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_spaces_tenant_principal_status
  ON project_spaces (tenant_id, principal_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_space_events_tenant_principal_timeline
  ON project_space_events (tenant_id, principal_id, space_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aegis_memory_events_tenant_principal_timeline
  ON aegis_memory_events (tenant_id, principal_id, project_id, memory_id, occurred_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_auth_sessions_identity_insert
BEFORE INSERT ON auth_sessions
WHEN NEW.principal_id IS NULL OR NEW.tenant_id IS NULL OR NEW.roles_json IS NULL
  OR NOT EXISTS (SELECT 1 FROM aegis_principals p WHERE p.id = NEW.principal_id AND p.tenant_id = NEW.tenant_id)
BEGIN SELECT RAISE(ABORT, 'AEGIS session principal scope required'); END;

CREATE TRIGGER IF NOT EXISTS trg_auth_sessions_identity_update
BEFORE UPDATE OF principal_id, tenant_id, roles_json ON auth_sessions
WHEN NEW.principal_id IS NULL OR NEW.tenant_id IS NULL OR NEW.roles_json IS NULL
  OR NOT EXISTS (SELECT 1 FROM aegis_principals p WHERE p.id = NEW.principal_id AND p.tenant_id = NEW.tenant_id)
BEGIN SELECT RAISE(ABORT, 'AEGIS session principal scope required'); END;

CREATE TRIGGER IF NOT EXISTS trg_aegis_memories_identity_insert
BEFORE INSERT ON aegis_memories
WHEN NEW.principal_id IS NULL OR NEW.tenant_id IS NULL
  OR NOT EXISTS (SELECT 1 FROM aegis_principals p WHERE p.id = NEW.principal_id AND p.tenant_id = NEW.tenant_id)
BEGIN SELECT RAISE(ABORT, 'AEGIS memory principal scope required'); END;

CREATE TRIGGER IF NOT EXISTS trg_project_spaces_identity_insert
BEFORE INSERT ON project_spaces
WHEN NEW.principal_id IS NULL OR NEW.tenant_id IS NULL
  OR NOT EXISTS (SELECT 1 FROM aegis_principals p WHERE p.id = NEW.principal_id AND p.tenant_id = NEW.tenant_id)
BEGIN SELECT RAISE(ABORT, 'AEGIS project principal scope required'); END;

CREATE TRIGGER IF NOT EXISTS trg_project_space_events_identity_insert
BEFORE INSERT ON project_space_events
WHEN NEW.principal_id IS NULL OR NEW.tenant_id IS NULL
  OR NOT EXISTS (SELECT 1 FROM aegis_principals p WHERE p.id = NEW.principal_id AND p.tenant_id = NEW.tenant_id)
BEGIN SELECT RAISE(ABORT, 'AEGIS project event principal scope required'); END;

CREATE TRIGGER IF NOT EXISTS trg_aegis_memory_events_identity_insert
BEFORE INSERT ON aegis_memory_events
WHEN NEW.principal_id IS NULL OR NEW.tenant_id IS NULL
  OR NOT EXISTS (SELECT 1 FROM aegis_principals p WHERE p.id = NEW.principal_id AND p.tenant_id = NEW.tenant_id)
BEGIN SELECT RAISE(ABORT, 'AEGIS memory event principal scope required'); END;
