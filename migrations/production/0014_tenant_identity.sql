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

-- 0012 made memory events append-only. Permit only this one-time identity
-- backfill while the migration is running, then restore both protections
-- before the migration completes.
DROP TRIGGER IF EXISTS trg_aegis_memory_events_no_update;
DROP TRIGGER IF EXISTS trg_aegis_memory_events_no_delete;

UPDATE aegis_memory_events SET principal_id = 'usr-root', tenant_id = 'org-root'
WHERE owner_id = 'owner' AND (principal_id IS NULL OR tenant_id IS NULL);

CREATE TRIGGER trg_aegis_memory_events_no_update
BEFORE UPDATE ON aegis_memory_events
BEGIN
  SELECT RAISE(ABORT, 'AEGIS memory events are append-only');
END;

CREATE TRIGGER trg_aegis_memory_events_no_delete
BEFORE DELETE ON aegis_memory_events
BEGIN
  SELECT RAISE(ABORT, 'AEGIS memory events are append-only');
END;

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


-- Rebuild memory audit triggers to carry the same immutable tenant/principal
-- scope as the memory row. The 0012 triggers predate tenant identity.
DROP TRIGGER IF EXISTS trg_aegis_memory_created;
DROP TRIGGER IF EXISTS trg_aegis_memory_status_changed;

CREATE TRIGGER trg_aegis_memory_created
AFTER INSERT ON aegis_memories
BEGIN
  INSERT INTO aegis_memory_events (
    id, memory_id, owner_id, project_id, event_type,
    from_status, to_status, occurred_at, principal_id, tenant_id
  ) VALUES (
    lower(hex(randomblob(16))), NEW.id, NEW.owner_id, NEW.project_id,
    'created', NULL, NEW.status, NEW.created_at, NEW.principal_id, NEW.tenant_id
  );
END;

CREATE TRIGGER trg_aegis_memory_status_changed
AFTER UPDATE OF status ON aegis_memories
WHEN OLD.status <> NEW.status
BEGIN
  INSERT INTO aegis_memory_events (
    id, memory_id, owner_id, project_id, event_type,
    from_status, to_status, occurred_at, principal_id, tenant_id
  ) VALUES (
    lower(hex(randomblob(16))), NEW.id, NEW.owner_id, NEW.project_id,
    'status_changed', OLD.status, NEW.status, NEW.updated_at, NEW.principal_id, NEW.tenant_id
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_aegis_memories_identity_update
BEFORE UPDATE OF principal_id, tenant_id ON aegis_memories
WHEN NEW.principal_id IS NULL OR NEW.tenant_id IS NULL
  OR NOT EXISTS (SELECT 1 FROM aegis_principals p WHERE p.id = NEW.principal_id AND p.tenant_id = NEW.tenant_id)
BEGIN SELECT RAISE(ABORT, 'AEGIS memory principal scope required'); END;

CREATE TRIGGER IF NOT EXISTS trg_project_spaces_identity_update
BEFORE UPDATE OF principal_id, tenant_id ON project_spaces
WHEN NEW.principal_id IS NULL OR NEW.tenant_id IS NULL
  OR NOT EXISTS (SELECT 1 FROM aegis_principals p WHERE p.id = NEW.principal_id AND p.tenant_id = NEW.tenant_id)
BEGIN SELECT RAISE(ABORT, 'AEGIS project principal scope required'); END;


-- Enforce parent/child tenant equality in D1, not only in application queries.
DROP TRIGGER IF EXISTS trg_aegis_memories_identity_insert;
CREATE TRIGGER trg_aegis_memories_identity_insert
BEFORE INSERT ON aegis_memories
WHEN NEW.principal_id IS NULL OR NEW.tenant_id IS NULL
  OR NOT EXISTS (
    SELECT 1 FROM aegis_principals p
    WHERE p.id = NEW.principal_id AND p.tenant_id = NEW.tenant_id
  )
  OR (NEW.project_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM project_spaces s
    WHERE s.id = NEW.project_id
      AND s.principal_id = NEW.principal_id
      AND s.tenant_id = NEW.tenant_id
      AND s.status = 'active'
  ))
BEGIN SELECT RAISE(ABORT, 'AEGIS memory tenant scope required'); END;

DROP TRIGGER IF EXISTS trg_aegis_memories_identity_update;
CREATE TRIGGER trg_aegis_memories_identity_update
BEFORE UPDATE OF principal_id, tenant_id, project_id ON aegis_memories
WHEN NEW.principal_id IS NULL OR NEW.tenant_id IS NULL
  OR NOT EXISTS (
    SELECT 1 FROM aegis_principals p
    WHERE p.id = NEW.principal_id AND p.tenant_id = NEW.tenant_id
  )
  OR (NEW.project_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM project_spaces s
    WHERE s.id = NEW.project_id
      AND s.principal_id = NEW.principal_id
      AND s.tenant_id = NEW.tenant_id
      AND s.status = 'active'
  ))
BEGIN SELECT RAISE(ABORT, 'AEGIS memory tenant scope required'); END;

DROP TRIGGER IF EXISTS trg_project_space_events_identity_insert;
CREATE TRIGGER trg_project_space_events_identity_insert
BEFORE INSERT ON project_space_events
WHEN NEW.principal_id IS NULL OR NEW.tenant_id IS NULL
  OR NOT EXISTS (
    SELECT 1 FROM project_spaces s
    WHERE s.id = NEW.space_id
      AND s.owner_id = NEW.owner_id
      AND s.principal_id = NEW.principal_id
      AND s.tenant_id = NEW.tenant_id
  )
BEGIN SELECT RAISE(ABORT, 'AEGIS project event tenant scope required'); END;

CREATE TRIGGER IF NOT EXISTS trg_project_space_events_identity_update
BEFORE UPDATE OF space_id, owner_id, principal_id, tenant_id ON project_space_events
WHEN NEW.principal_id IS NULL OR NEW.tenant_id IS NULL
  OR NOT EXISTS (
    SELECT 1 FROM project_spaces s
    WHERE s.id = NEW.space_id
      AND s.owner_id = NEW.owner_id
      AND s.principal_id = NEW.principal_id
      AND s.tenant_id = NEW.tenant_id
  )
BEGIN SELECT RAISE(ABORT, 'AEGIS project event tenant scope required'); END;

DROP TRIGGER IF EXISTS trg_aegis_memory_events_identity_insert;
CREATE TRIGGER trg_aegis_memory_events_identity_insert
BEFORE INSERT ON aegis_memory_events
WHEN NEW.principal_id IS NULL OR NEW.tenant_id IS NULL
  OR NOT EXISTS (
    SELECT 1 FROM aegis_memories m
    WHERE m.id = NEW.memory_id
      AND m.owner_id = NEW.owner_id
      AND m.principal_id = NEW.principal_id
      AND m.tenant_id = NEW.tenant_id
  )
BEGIN SELECT RAISE(ABORT, 'AEGIS memory event tenant scope required'); END;
