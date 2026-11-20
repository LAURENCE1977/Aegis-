PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS integration_providers (
  id TEXT PRIMARY KEY NOT NULL,
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 120),
  source_url TEXT NOT NULL CHECK (length(source_url) BETWEEN 8 AND 2048),
  verified_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('discovered', 'reviewed', 'disabled')),
  created_by TEXT NOT NULL CHECK (created_by = 'owner'),
  created_at TEXT NOT NULL,
  CHECK (status != 'reviewed' OR verified_at IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS integration_definitions (
  id TEXT PRIMARY KEY NOT NULL,
  provider_id TEXT NOT NULL REFERENCES integration_providers(id),
  slug TEXT NOT NULL CHECK (length(slug) BETWEEN 1 AND 80),
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 120),
  description TEXT NOT NULL CHECK (length(description) BETWEEN 1 AND 1000),
  auth_mode TEXT NOT NULL CHECK (auth_mode IN (
    'api_key',
    'oauth2_authorization_code_pkce',
    'oauth2_client_credentials',
    'shared_platform_account',
    'session_delegation',
    'none_public',
    'unknown'
  )),
  source_url TEXT NOT NULL CHECK (length(source_url) BETWEEN 8 AND 2048),
  schema_version TEXT,
  schema_hash TEXT CHECK (schema_hash IS NULL OR (length(schema_hash) = 71 AND substr(schema_hash, 1, 7) = 'sha256:')),
  status TEXT NOT NULL CHECK (status IN ('discovered', 'reviewed', 'disabled')),
  created_by TEXT NOT NULL CHECK (created_by = 'owner'),
  created_at TEXT NOT NULL,
  UNIQUE (provider_id, slug),
  CHECK (status != 'reviewed' OR (schema_version IS NOT NULL AND schema_hash IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS integration_connections (
  id TEXT PRIMARY KEY NOT NULL,
  principal_id TEXT NOT NULL,
  integration_id TEXT NOT NULL REFERENCES integration_definitions(id),
  connection_key TEXT NOT NULL CHECK (length(connection_key) BETWEEN 1 AND 128),
  connection_type TEXT NOT NULL CHECK (connection_type IN (
    'owner_private',
    'workspace_shared',
    'instant_platform_managed',
    'public_no_auth',
    'unknown'
  )),
  auth_mode TEXT NOT NULL CHECK (auth_mode IN (
    'api_key',
    'oauth2_authorization_code_pkce',
    'oauth2_client_credentials',
    'shared_platform_account',
    'session_delegation',
    'none_public',
    'unknown'
  )),
  account_alias TEXT CHECK (account_alias IS NULL OR length(account_alias) BETWEEN 1 AND 120),
  platform_account_id TEXT CHECK (platform_account_id IS NULL OR length(platform_account_id) BETWEEN 1 AND 200),
  platform_connection_id TEXT REFERENCES capability_connections(id),
  allowed_tool_slugs_json TEXT NOT NULL CHECK (json_valid(allowed_tool_slugs_json) AND json_type(allowed_tool_slugs_json) = 'array' AND json_array_length(allowed_tool_slugs_json) <= 200),
  scopes_json TEXT NOT NULL CHECK (json_valid(scopes_json) AND json_type(scopes_json) = 'array' AND json_array_length(scopes_json) <= 100),
  status TEXT NOT NULL CHECK (status IN (
    'discovered',
    'connected_unverified',
    'connected',
    'auth_required',
    'restricted',
    'rate_limited',
    'disabled',
    'revoked'
  )),
  last_observed_at TEXT NOT NULL,
  health_state TEXT NOT NULL CHECK (health_state IN (
    'unknown',
    'healthy',
    'degraded',
    'auth_required',
    'restricted',
    'rate_limited',
    'disabled'
  )),
  health_checked_at TEXT,
  created_by TEXT NOT NULL CHECK (created_by = 'owner'),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  revoked_at TEXT,
  CHECK (
    (connection_type = 'public_no_auth' AND auth_mode = 'none_public' AND platform_connection_id IS NULL) OR
    (connection_type = 'owner_private' AND ((auth_mode IN ('api_key', 'oauth2_authorization_code_pkce', 'oauth2_client_credentials') AND platform_connection_id IS NOT NULL) OR auth_mode = 'unknown')) OR
    (connection_type = 'workspace_shared' AND ((auth_mode = 'oauth2_client_credentials' AND platform_connection_id IS NOT NULL) OR auth_mode IN ('shared_platform_account', 'session_delegation', 'unknown'))) OR
    (connection_type = 'instant_platform_managed' AND auth_mode IN ('shared_platform_account', 'session_delegation', 'unknown')) OR
    connection_type = 'unknown'
  ),
  CHECK (health_state != 'healthy' OR health_checked_at IS NOT NULL),
  CHECK (
    (status = 'revoked' AND revoked_at IS NOT NULL AND health_state = 'disabled') OR
    (status != 'revoked' AND revoked_at IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_integration_connections_owner_key
  ON integration_connections (principal_id, integration_id, connection_key);

CREATE INDEX IF NOT EXISTS idx_integration_connections_owner_observed
  ON integration_connections (principal_id, last_observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_integration_connections_integration_status
  ON integration_connections (integration_id, status, connection_type);

CREATE INDEX IF NOT EXISTS idx_integration_connections_platform_connection
  ON integration_connections (platform_connection_id)
  WHERE platform_connection_id IS NOT NULL;


CREATE TRIGGER IF NOT EXISTS integration_connections_exact_allowlist_insert
BEFORE INSERT ON integration_connections
WHEN
  EXISTS (
    SELECT 1 FROM json_each(NEW.allowed_tool_slugs_json)
    WHERE type != 'text' OR value = '*' OR instr(value, '*') > 0
  )
  OR EXISTS (
    SELECT 1 FROM json_each(NEW.scopes_json)
    WHERE type != 'text' OR value = '*' OR instr(value, '*') > 0
  )
BEGIN
  SELECT RAISE(ABORT, 'integration connection allowlists must contain exact text values');
END;

CREATE TRIGGER IF NOT EXISTS integration_connections_exact_allowlist_update
BEFORE UPDATE OF allowed_tool_slugs_json, scopes_json ON integration_connections
WHEN
  EXISTS (
    SELECT 1 FROM json_each(NEW.allowed_tool_slugs_json)
    WHERE type != 'text' OR value = '*' OR instr(value, '*') > 0
  )
  OR EXISTS (
    SELECT 1 FROM json_each(NEW.scopes_json)
    WHERE type != 'text' OR value = '*' OR instr(value, '*') > 0
  )
BEGIN
  SELECT RAISE(ABORT, 'integration connection allowlists must contain exact text values');
END;
