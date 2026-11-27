-- Multi-principal identity, tenant membership and credential lifecycle.
-- A principal is a global human/account identity; memberships grant tenant-scoped roles.
ALTER TABLE aegis_principals ADD COLUMN status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'suspended', 'revoked'));
ALTER TABLE aegis_tenants ADD COLUMN status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'suspended', 'revoked'));

CREATE TABLE aegis_tenant_memberships (
  principal_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'revoked')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (principal_id, tenant_id),
  FOREIGN KEY (principal_id) REFERENCES aegis_principals(id),
  FOREIGN KEY (tenant_id) REFERENCES aegis_tenants(id)
);

CREATE INDEX idx_aegis_memberships_tenant_status_role
  ON aegis_tenant_memberships (tenant_id, status, role, principal_id);

CREATE TABLE aegis_principal_credentials (
  principal_id TEXT PRIMARY KEY NOT NULL,
  login_identifier TEXT NOT NULL UNIQUE,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_iterations INTEGER NOT NULL CHECK (password_iterations BETWEEN 100000 AND 600000),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (principal_id) REFERENCES aegis_principals(id)
);

CREATE INDEX idx_aegis_credentials_login_identifier
  ON aegis_principal_credentials (login_identifier);

INSERT OR IGNORE INTO aegis_tenant_memberships
  (principal_id, tenant_id, role, status, created_at, updated_at)
VALUES ('usr-root', 'org-root', 'owner', 'active',
  '2026-11-26T00:00:00.000Z', '2026-11-26T00:00:00.000Z');

-- Every new session must belong to an active principal, tenant and membership.
DROP TRIGGER IF EXISTS trg_auth_sessions_identity_insert;
CREATE TRIGGER trg_auth_sessions_identity_insert
BEFORE INSERT ON auth_sessions
WHEN NEW.principal_id IS NULL OR NEW.tenant_id IS NULL OR NEW.roles_json IS NULL
  OR NOT EXISTS (
    SELECT 1
    FROM aegis_principals p
    JOIN aegis_tenants t ON t.id = NEW.tenant_id
    JOIN aegis_tenant_memberships m
      ON m.principal_id = p.id AND m.tenant_id = t.id
    WHERE p.id = NEW.principal_id
      AND p.status = 'active' AND t.status = 'active'
      AND m.status = 'active' AND m.role = json_extract(NEW.roles_json, '$[0]')
  )
BEGIN SELECT RAISE(ABORT, 'AEGIS active tenant membership required'); END;

DROP TRIGGER IF EXISTS trg_auth_sessions_identity_update;
CREATE TRIGGER trg_auth_sessions_identity_update
BEFORE UPDATE OF principal_id, tenant_id, roles_json ON auth_sessions
WHEN NEW.principal_id IS NULL OR NEW.tenant_id IS NULL OR NEW.roles_json IS NULL
  OR NOT EXISTS (
    SELECT 1
    FROM aegis_principals p
    JOIN aegis_tenants t ON t.id = NEW.tenant_id
    JOIN aegis_tenant_memberships m
      ON m.principal_id = p.id AND m.tenant_id = t.id
    WHERE p.id = NEW.principal_id
      AND p.status = 'active' AND t.status = 'active'
      AND m.status = 'active' AND m.role = json_extract(NEW.roles_json, '$[0]')
  )
BEGIN SELECT RAISE(ABORT, 'AEGIS active tenant membership required'); END;

-- Revocation propagates at the database boundary, including role changes.
CREATE TRIGGER trg_membership_revoke_sessions
AFTER UPDATE OF status, role ON aegis_tenant_memberships
WHEN OLD.status <> NEW.status OR OLD.role <> NEW.role
BEGIN
  UPDATE auth_sessions
  SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP)
  WHERE principal_id = NEW.principal_id AND tenant_id = NEW.tenant_id
    AND revoked_at IS NULL;
END;

CREATE TRIGGER trg_principal_revoke_sessions
AFTER UPDATE OF status ON aegis_principals
WHEN OLD.status <> NEW.status AND NEW.status <> 'active'
BEGIN
  UPDATE auth_sessions
  SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP)
  WHERE principal_id = NEW.id AND revoked_at IS NULL;
END;

CREATE TRIGGER trg_tenant_revoke_sessions
AFTER UPDATE OF status ON aegis_tenants
WHEN OLD.status <> NEW.status AND NEW.status <> 'active'
BEGIN
  UPDATE auth_sessions
  SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP)
  WHERE tenant_id = NEW.id AND revoked_at IS NULL;
END;

-- Session resolution checks live status and membership on every request.
