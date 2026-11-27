-- Versioned credentials and database-enforced lifecycle membership invariants.
ALTER TABLE aegis_principal_credentials ADD COLUMN password_algorithm TEXT NOT NULL DEFAULT 'PBKDF2-SHA256-v1' CHECK (password_algorithm='PBKDF2-SHA256-v1');
ALTER TABLE aegis_principal_credentials ADD COLUMN password_pepper_version TEXT NOT NULL DEFAULT 'none' CHECK (length(password_pepper_version) BETWEEN 1 AND 32);
ALTER TABLE aegis_principal_credentials ADD COLUMN email TEXT CHECK (email IS NULL OR length(email) BETWEEN 3 AND 254);
ALTER TABLE aegis_principal_credentials ADD COLUMN username TEXT CHECK (username IS NULL OR length(username) BETWEEN 3 AND 254);
UPDATE aegis_principal_credentials SET email=CASE WHEN instr(login_identifier,'@')>0 THEN login_identifier ELSE NULL END, username=CASE WHEN instr(login_identifier,'@')=0 THEN login_identifier ELSE NULL END;
CREATE UNIQUE INDEX idx_aegis_credentials_email ON aegis_principal_credentials(email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX idx_aegis_credentials_username ON aegis_principal_credentials(username) WHERE username IS NOT NULL;
CREATE TRIGGER trg_membership_active_insert_guard BEFORE INSERT ON aegis_tenant_memberships
WHEN NEW.status='active' AND NOT EXISTS(SELECT 1 FROM aegis_principals p JOIN aegis_tenants t ON t.id=NEW.tenant_id WHERE p.id=NEW.principal_id AND p.status='active' AND t.status='active')
BEGIN SELECT RAISE(ABORT,'AEGIS active principal and tenant required for membership'); END;
CREATE TRIGGER trg_membership_active_update_guard BEFORE UPDATE OF status,principal_id,tenant_id ON aegis_tenant_memberships
WHEN NEW.status='active' AND NOT EXISTS(SELECT 1 FROM aegis_principals p JOIN aegis_tenants t ON t.id=NEW.tenant_id WHERE p.id=NEW.principal_id AND p.status='active' AND t.status='active')
BEGIN SELECT RAISE(ABORT,'AEGIS active principal and tenant required for membership'); END;
CREATE TRIGGER trg_principal_deactivate_memberships AFTER UPDATE OF status ON aegis_principals
WHEN OLD.status<>NEW.status AND NEW.status<>'active'
BEGIN UPDATE aegis_tenant_memberships SET status=CASE WHEN NEW.status='revoked' THEN 'revoked' ELSE 'suspended' END,updated_at=CURRENT_TIMESTAMP WHERE principal_id=NEW.id AND status='active'; END;
CREATE TRIGGER trg_tenant_deactivate_memberships AFTER UPDATE OF status ON aegis_tenants
WHEN OLD.status<>NEW.status AND NEW.status<>'active'
BEGIN UPDATE aegis_tenant_memberships SET status=CASE WHEN NEW.status='revoked' THEN 'revoked' ELSE 'suspended' END,updated_at=CURRENT_TIMESTAMP WHERE tenant_id=NEW.id AND status='active'; END;
