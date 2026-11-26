-- Single-use tenant invitations and account recovery. Only token digests are stored.
CREATE TABLE aegis_tenant_invitations (
 invitation_id TEXT PRIMARY KEY NOT NULL,
 token_hash TEXT NOT NULL UNIQUE CHECK(length(token_hash)=64),
 tenant_id TEXT NOT NULL,
 normalized_identity TEXT NOT NULL CHECK(length(normalized_identity) BETWEEN 3 AND 254),
 role TEXT NOT NULL CHECK(role IN ('admin','member')),
 created_by_principal_id TEXT NOT NULL,
 created_at TEXT NOT NULL,
 expires_at INTEGER NOT NULL,
 accepted_at TEXT,
 FOREIGN KEY(tenant_id) REFERENCES aegis_tenants(id),
 FOREIGN KEY(created_by_principal_id) REFERENCES aegis_principals(id)
);
CREATE INDEX idx_aegis_invitations_pending ON aegis_tenant_invitations(tenant_id,expires_at) WHERE accepted_at IS NULL;
CREATE TABLE aegis_account_recovery_tokens (
 recovery_id TEXT PRIMARY KEY NOT NULL,
 token_hash TEXT NOT NULL UNIQUE CHECK(length(token_hash)=64),
 principal_id TEXT NOT NULL,
 tenant_id TEXT NOT NULL,
 issued_by_principal_id TEXT NOT NULL,
 created_at TEXT NOT NULL,
 expires_at INTEGER NOT NULL,
 accepted_at TEXT,
 FOREIGN KEY(principal_id) REFERENCES aegis_principals(id),
 FOREIGN KEY(tenant_id) REFERENCES aegis_tenants(id),
 FOREIGN KEY(issued_by_principal_id) REFERENCES aegis_principals(id)
);
CREATE INDEX idx_aegis_recovery_pending ON aegis_account_recovery_tokens(principal_id,tenant_id,expires_at) WHERE accepted_at IS NULL;
CREATE TRIGGER trg_invitation_active_tenant_insert BEFORE INSERT ON aegis_tenant_invitations
WHEN NOT EXISTS(SELECT 1 FROM aegis_tenants WHERE id=NEW.tenant_id AND status='active')
BEGIN SELECT RAISE(ABORT,'AEGIS invitation tenant must be active'); END;
CREATE TRIGGER trg_recovery_active_tenant_insert BEFORE INSERT ON aegis_account_recovery_tokens
WHEN NOT EXISTS(SELECT 1 FROM aegis_tenants WHERE id=NEW.tenant_id AND status='active')
BEGIN SELECT RAISE(ABORT,'AEGIS recovery tenant must be active'); END;
