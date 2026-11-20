PRAGMA foreign_keys = ON;

-- Connection lifecycle evidence is written by database triggers so state changes
-- and their audit events commit or fail together.
CREATE TABLE IF NOT EXISTS integration_connection_events (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  connection_id TEXT NOT NULL REFERENCES integration_connections(id),
  principal_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'updated', 'health_observed', 'revoked')),
  previous_status TEXT CHECK (previous_status IS NULL OR previous_status IN (
    'discovered', 'connected_unverified', 'connected', 'auth_required',
    'restricted', 'rate_limited', 'disabled', 'revoked'
  )),
  new_status TEXT NOT NULL CHECK (new_status IN (
    'discovered', 'connected_unverified', 'connected', 'auth_required',
    'restricted', 'rate_limited', 'disabled', 'revoked'
  )),
  health_state TEXT NOT NULL CHECK (health_state IN (
    'unknown', 'healthy', 'degraded', 'auth_required', 'restricted', 'rate_limited', 'disabled'
  )),
  health_checked_at TEXT,
  occurred_at TEXT NOT NULL,
  actor TEXT NOT NULL CHECK (actor = 'owner')
);

CREATE INDEX IF NOT EXISTS idx_integration_connection_events_owner_time
  ON integration_connection_events (principal_id, occurred_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_integration_connection_events_connection_time
  ON integration_connection_events (connection_id, occurred_at DESC, id DESC);

CREATE TRIGGER IF NOT EXISTS integration_connections_audit_insert
AFTER INSERT ON integration_connections
BEGIN
  INSERT INTO integration_connection_events (
    connection_id, principal_id, event_type, previous_status, new_status,
    health_state, health_checked_at, occurred_at, actor
  ) VALUES (
    NEW.id, NEW.principal_id, 'created', NULL, NEW.status,
    NEW.health_state, NEW.health_checked_at, NEW.created_at, NEW.created_by
  );
END;

CREATE TRIGGER IF NOT EXISTS integration_connections_audit_update
AFTER UPDATE ON integration_connections
WHEN
  OLD.connection_type IS NOT NEW.connection_type OR
  OLD.auth_mode IS NOT NEW.auth_mode OR
  OLD.account_alias IS NOT NEW.account_alias OR
  OLD.platform_account_id IS NOT NEW.platform_account_id OR
  OLD.platform_connection_id IS NOT NEW.platform_connection_id OR
  OLD.allowed_tool_slugs_json IS NOT NEW.allowed_tool_slugs_json OR
  OLD.scopes_json IS NOT NEW.scopes_json OR
  OLD.status IS NOT NEW.status OR
  OLD.health_state IS NOT NEW.health_state OR
  OLD.health_checked_at IS NOT NEW.health_checked_at OR
  OLD.revoked_at IS NOT NEW.revoked_at
BEGIN
  INSERT INTO integration_connection_events (
    connection_id, principal_id, event_type, previous_status, new_status,
    health_state, health_checked_at, occurred_at, actor
  ) VALUES (
    NEW.id, NEW.principal_id,
    CASE
      WHEN OLD.status != 'revoked' AND NEW.status = 'revoked' THEN 'revoked'
      WHEN OLD.health_state IS NOT NEW.health_state OR OLD.health_checked_at IS NOT NEW.health_checked_at THEN 'health_observed'
      ELSE 'updated'
    END,
    OLD.status, NEW.status, NEW.health_state, NEW.health_checked_at,
    NEW.updated_at, NEW.created_by
  );
END;

CREATE TRIGGER IF NOT EXISTS integration_connection_events_no_update
BEFORE UPDATE ON integration_connection_events
BEGIN
  SELECT RAISE(ABORT, 'integration connection audit events are append-only');
END;

CREATE TRIGGER IF NOT EXISTS integration_connection_events_no_delete
BEFORE DELETE ON integration_connection_events
BEGIN
  SELECT RAISE(ABORT, 'integration connection audit events are append-only');
END;
