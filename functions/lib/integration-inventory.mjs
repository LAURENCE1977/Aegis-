const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const KEY_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,127}$/;
const TOOL_SLUG_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SCOPE_PATTERN = /^[a-z][a-z0-9-]{0,40}:[a-z][a-z0-9-]{0,50}(?::[a-z0-9._-]{1,80})?$/;
const PROVIDER_STATUSES = new Set(['discovered', 'reviewed', 'disabled']);
const INTEGRATION_STATUSES = new Set(['discovered', 'reviewed', 'disabled']);
const CONNECTION_TYPES = new Set(['owner_private', 'workspace_shared', 'instant_platform_managed', 'public_no_auth', 'unknown']);
const AUTH_MODES = new Set(['api_key', 'oauth2_authorization_code_pkce', 'oauth2_client_credentials', 'shared_platform_account', 'session_delegation', 'none_public', 'unknown']);
const CONNECTION_STATUSES = new Set(['discovered', 'connected_unverified', 'connected', 'auth_required', 'restricted', 'rate_limited', 'disabled']);
const HEALTH_STATES = new Set(['healthy', 'degraded', 'auth_required', 'restricted', 'rate_limited']);

function record(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid ' + label);
}
function exactFields(input, allowed, label) {
  record(input, label);
  if (Object.keys(input).some(key => !allowed.has(key))) throw new TypeError('Invalid ' + label + ' fields');
}
function id(value, label) {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) throw new TypeError('Invalid ' + label);
}
function key(value, label) {
  if (typeof value !== 'string' || !KEY_PATTERN.test(value)) throw new TypeError('Invalid ' + label);
}
function text(value, label, max = 500, optional = false) {
  if (optional && (value === undefined || value === null)) return null;
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new TypeError('Invalid ' + label);
  }
  return value.trim();
}
function httpsUrl(value, label) {
  text(value, label, 2048);
  let parsed;
  try { parsed = new URL(value); } catch { throw new TypeError('Invalid ' + label); }
  if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.username || parsed.password) throw new TypeError('Invalid ' + label);
  return parsed.toString();
}
function isoTime(value, label, optional = false) {
  if (optional && (value === undefined || value === null)) return null;
  if (typeof value !== 'string') throw new TypeError('Invalid ' + label + ' timestamp');
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) throw new TypeError('Invalid ' + label + ' timestamp');
  return value;
}
function owner(value) {
  if (value !== 'owner') throw new TypeError('Only the owner may manage integration inventory');
}
function parseJsonArray(value) {
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : null; } catch { return null; }
}
function mapProvider(row) {
  if (!row) return null;
  return { id: row.id, displayName: row.display_name, sourceUrl: row.source_url, verifiedAt: row.verified_at, status: row.status, createdBy: row.created_by, createdAt: row.created_at };
}
function mapIntegration(row) {
  if (!row) return null;
  return { id: row.id, providerId: row.provider_id, slug: row.slug, displayName: row.display_name, description: row.description, authMode: row.auth_mode, sourceUrl: row.source_url, schemaVersion: row.schema_version, schemaHash: row.schema_hash, status: row.status, createdBy: row.created_by, createdAt: row.created_at };
}
function mapConnection(row) {
  if (!row) return null;
  const allowedToolSlugs = parseJsonArray(row.allowed_tool_slugs_json);
  const scopes = parseJsonArray(row.scopes_json);
  if (!allowedToolSlugs || !scopes ||
      allowedToolSlugs.some(item => typeof item !== 'string' || !TOOL_SLUG_PATTERN.test(item) || item.includes('*')) ||
      scopes.some(item => typeof item !== 'string' || !SCOPE_PATTERN.test(item) || item.includes('*'))) return null;
  return {
    id: row.id, principalId: row.principal_id, integrationId: row.integration_id,
    connectionKey: row.connection_key, connectionType: row.connection_type, authMode: row.auth_mode,
    accountAlias: row.account_alias, platformAccountId: row.platform_account_id,
    platformConnectionId: row.platform_connection_id, allowedToolSlugs, scopes,
    status: row.status, lastObservedAt: row.last_observed_at, healthState: row.health_state,
    healthCheckedAt: row.health_checked_at, createdBy: row.created_by, createdAt: row.created_at,
    updatedAt: row.updated_at, revokedAt: row.revoked_at,
  };
}
function validateProvider(input, now = Date.now()) {
  exactFields(input, new Set(['id', 'displayName', 'sourceUrl', 'verifiedAt', 'status', 'createdBy']), 'integration provider');
  id(input.id, 'integration provider identifier');
  text(input.displayName, 'integration provider name', 120);
  httpsUrl(input.sourceUrl, 'integration provider source URL');
  const verifiedAt = isoTime(input.verifiedAt, 'provider verification', true);
  if (!PROVIDER_STATUSES.has(input.status)) throw new TypeError('Invalid integration provider status');
  if (verifiedAt && Date.parse(verifiedAt) > now + 60_000) throw new TypeError('Provider verification timestamp is in the future');
  if (input.status === 'reviewed' && !verifiedAt) throw new TypeError('Reviewed integration providers require verification evidence');
  owner(input.createdBy);
  return { ...input, verifiedAt };
}
function validateIntegration(input) {
  exactFields(input, new Set(['id', 'providerId', 'slug', 'displayName', 'description', 'authMode', 'sourceUrl', 'schemaVersion', 'schemaHash', 'status', 'createdBy']), 'integration definition');
  id(input.id, 'integration identifier'); id(input.providerId, 'integration provider identifier'); id(input.slug, 'integration slug');
  text(input.displayName, 'integration name', 120); text(input.description, 'integration description', 1000);
  if (!AUTH_MODES.has(input.authMode)) throw new TypeError('Invalid integration authentication mode');
  httpsUrl(input.sourceUrl, 'integration source URL');
  const schemaVersion = text(input.schemaVersion, 'integration schema version', 80, true);
  const schemaHash = input.schemaHash ?? null;
  if (schemaHash !== null && (typeof schemaHash !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(schemaHash))) throw new TypeError('Invalid integration schema hash');
  if (!INTEGRATION_STATUSES.has(input.status)) throw new TypeError('Invalid integration status');
  if (input.status === 'reviewed' && (!schemaVersion || !schemaHash)) throw new TypeError('Reviewed integrations require a schema version and hash');
  owner(input.createdBy);
  return { ...input, schemaVersion, schemaHash };
}
function validConnectionAuthMode(connectionType, authMode, platformConnectionId) {
  if (connectionType === 'public_no_auth') return authMode === 'none_public' && platformConnectionId === null;
  if (connectionType === 'owner_private') {
    return authMode === 'unknown' ||
      (['api_key', 'oauth2_authorization_code_pkce', 'oauth2_client_credentials'].includes(authMode) &&
       platformConnectionId !== null);
  }
  if (connectionType === 'workspace_shared') {
    return authMode === 'shared_platform_account' || authMode === 'session_delegation' ||
      authMode === 'unknown' ||
      (authMode === 'oauth2_client_credentials' && platformConnectionId !== null);
  }
  if (connectionType === 'instant_platform_managed') return ['shared_platform_account', 'session_delegation', 'unknown'].includes(authMode);
  return connectionType === 'unknown';
}
function validateConnection(input, now = Date.now()) {
  exactFields(input, new Set(['principalId', 'integrationId', 'connectionKey', 'connectionType', 'authMode', 'accountAlias', 'platformAccountId', 'platformConnectionId', 'allowedToolSlugs', 'scopes', 'status', 'lastObservedAt', 'healthState', 'healthCheckedAt', 'createdBy']), 'integration connection');
  key(input.principalId, 'integration connection principal'); id(input.integrationId, 'integration connection integration identifier'); key(input.connectionKey, 'integration connection key');
  if (!CONNECTION_TYPES.has(input.connectionType)) throw new TypeError('Invalid integration connection type');
  if (!AUTH_MODES.has(input.authMode)) throw new TypeError('Invalid integration connection auth mode');
  const platformConnectionId = input.platformConnectionId ?? null;
  if (platformConnectionId !== null) id(platformConnectionId, 'platform connection identifier');
  if (!validConnectionAuthMode(input.connectionType, input.authMode, platformConnectionId)) throw new TypeError('Invalid integration connection auth mode for connection type');
  const accountAlias = text(input.accountAlias, 'integration account alias', 120, true);
  const platformAccountId = text(input.platformAccountId, 'platform account identifier', 200, true);
  if (!Array.isArray(input.allowedToolSlugs) || input.allowedToolSlugs.length > 200 || input.allowedToolSlugs.some(item => typeof item !== 'string' || !TOOL_SLUG_PATTERN.test(item) || item.includes('*')) || new Set(input.allowedToolSlugs).size !== input.allowedToolSlugs.length) {
    throw new TypeError('Invalid integration allowed tool slug list');
  }
  if (!Array.isArray(input.scopes) || input.scopes.length > 100 || input.scopes.some(item => typeof item !== 'string' || !SCOPE_PATTERN.test(item) || item.includes('*')) || new Set(input.scopes).size !== input.scopes.length) {
    throw new TypeError('Invalid integration connection scopes');
  }
  if (!CONNECTION_STATUSES.has(input.status)) throw new TypeError('Invalid integration connection status');
  const lastObservedAt = isoTime(input.lastObservedAt, 'last observed');
  if (Date.parse(lastObservedAt) > now + 60_000) throw new TypeError('Integration observation timestamp is in the future');
  if (input.healthState !== 'unknown' || input.healthCheckedAt !== null) throw new TypeError('Inventory import cannot assert health; use a timestamped health observation');
  owner(input.createdBy);
  return { ...input, accountAlias, platformAccountId, platformConnectionId, lastObservedAt };
}

export async function createIntegrationProvider(db, input, now = Date.now()) {
  if (!db || typeof db.prepare !== 'function' || !Number.isFinite(now)) throw new TypeError('Integration provider database and valid clock are required');
  const value = validateProvider(input, now); const createdAt = new Date(now).toISOString();
  await db.prepare(`INSERT INTO integration_providers (id, display_name, source_url, verified_at, status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(value.id, value.displayName.trim(), httpsUrl(value.sourceUrl, 'integration provider source URL'), value.verifiedAt, value.status, value.createdBy, createdAt).run();
  const row = await db.prepare('SELECT * FROM integration_providers WHERE id = ?').bind(value.id).first();
  const mapped = mapProvider(row); if (!mapped) throw new Error('Integration provider could not be persisted'); return mapped;
}

export async function createIntegrationDefinition(db, input, now = Date.now()) {
  if (!db || typeof db.prepare !== 'function' || !Number.isFinite(now)) throw new TypeError('Integration definition database and valid clock are required');
  const value = validateIntegration(input);
  const provider = await db.prepare('SELECT id, status FROM integration_providers WHERE id = ?').bind(value.providerId).first();
  if (!provider || provider.status === 'disabled') throw new Error('Integration provider is unavailable');
  const createdAt = new Date(now).toISOString();
  await db.prepare(`INSERT INTO integration_definitions (id, provider_id, slug, display_name, description, auth_mode, source_url, schema_version, schema_hash, status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(value.id, value.providerId, value.slug, value.displayName.trim(), value.description.trim(), value.authMode, httpsUrl(value.sourceUrl, 'integration source URL'), value.schemaVersion, value.schemaHash, value.status, value.createdBy, createdAt).run();
  const row = await db.prepare('SELECT * FROM integration_definitions WHERE id = ?').bind(value.id).first();
  const mapped = mapIntegration(row); if (!mapped) throw new Error('Integration definition could not be persisted'); return mapped;
}

export async function upsertIntegrationConnection(db, input, now = Date.now()) {
  if (!db || typeof db.prepare !== 'function' || !Number.isFinite(now)) throw new TypeError('Integration connection database and valid clock are required');
  const value = validateConnection(input, now);
  const integration = await db.prepare('SELECT id, status, provider_id FROM integration_definitions WHERE id = ?').bind(value.integrationId).first();
  if (!integration || integration.status === 'disabled') throw new Error('Integration definition is unavailable');
  if (value.platformConnectionId !== null) {
    const timestamp = new Date(now).toISOString();
    const platformConnection = await db.prepare(`
      SELECT id FROM capability_connections
      WHERE id = ? AND principal_id = ? AND provider_id = ?
        AND status = 'active' AND revoked_at IS NULL
        AND (expires_at IS NULL OR expires_at > ?)
    `).bind(value.platformConnectionId, value.principalId, integration.provider_id, timestamp).first();
    if (!platformConnection) throw new Error('Platform credential connection is unavailable');
  }
  const idValue = crypto.randomUUID(); const timestamp = new Date(now).toISOString();
  const result = await db.prepare(`
    INSERT INTO integration_connections (
      id, principal_id, integration_id, connection_key, connection_type, auth_mode,
      account_alias, platform_account_id, platform_connection_id, allowed_tool_slugs_json,
      scopes_json, status, last_observed_at, health_state, health_checked_at,
      created_by, created_at, updated_at, revoked_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unknown', NULL, ?, ?, ?, NULL)
    ON CONFLICT (principal_id, integration_id, connection_key) DO UPDATE SET
      connection_type = excluded.connection_type, auth_mode = excluded.auth_mode,
      account_alias = excluded.account_alias, platform_account_id = excluded.platform_account_id,
      platform_connection_id = excluded.platform_connection_id,
      allowed_tool_slugs_json = excluded.allowed_tool_slugs_json,
      scopes_json = excluded.scopes_json, status = excluded.status,
      last_observed_at = excluded.last_observed_at, health_state = 'unknown',
      health_checked_at = NULL, updated_at = excluded.updated_at
    WHERE integration_connections.status != 'revoked'
  `).bind(idValue, value.principalId, value.integrationId, value.connectionKey, value.connectionType, value.authMode,
    value.accountAlias, value.platformAccountId, value.platformConnectionId, JSON.stringify(value.allowedToolSlugs),
    JSON.stringify(value.scopes), value.status, value.lastObservedAt, value.createdBy, timestamp, timestamp).run();
  if (result?.meta?.changes === 0) throw new Error('Revoked integration connections cannot be overwritten; create a new connection key');
  const row = await db.prepare('SELECT * FROM integration_connections WHERE principal_id = ? AND integration_id = ? AND connection_key = ?')
    .bind(value.principalId, value.integrationId, value.connectionKey).first();
  const mapped = mapConnection(row); if (!mapped) throw new Error('Integration connection could not be persisted'); return mapped;
}

export async function loadIntegrationConnection(db, { principalId, integrationId, connectionKey } = {}) {
  if (!db || typeof db.prepare !== 'function') throw new TypeError('Integration connection database is required');
  key(principalId, 'integration connection principal'); id(integrationId, 'integration connection integration identifier'); key(connectionKey, 'integration connection key');
  const row = await db.prepare('SELECT * FROM integration_connections WHERE principal_id = ? AND integration_id = ? AND connection_key = ? LIMIT 1')
    .bind(principalId, integrationId, connectionKey).first();
  return mapConnection(row);
}

export async function listIntegrationConnections(db, principalId, limit = 100) {
  if (!db || typeof db.prepare !== 'function') throw new TypeError('Integration connection database is required');
  key(principalId, 'integration connection principal');
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new TypeError('Integration connection list limit must be between 1 and 100');
  const result = await db.prepare('SELECT * FROM integration_connections WHERE principal_id = ? ORDER BY last_observed_at DESC, id DESC LIMIT ?')
    .bind(principalId, limit).all();
  return (result?.results || []).map(mapConnection).filter(Boolean);
}

export async function recordIntegrationHealth(db, { id: connectionId, principalId, healthState, checkedAt } = {}, now = Date.now()) {
  if (!db || typeof db.prepare !== 'function' || !Number.isFinite(now)) throw new TypeError('Integration health database and valid clock are required');
  id(connectionId, 'integration connection identifier'); key(principalId, 'integration connection principal');
  if (!HEALTH_STATES.has(healthState)) throw new TypeError('Invalid integration health state');
  const timestamp = isoTime(checkedAt, 'health check');
  if (Date.parse(timestamp) > now + 60_000) throw new TypeError('Integration health timestamp is in the future');
  const result = await db.prepare(`UPDATE integration_connections SET health_state = ?, health_checked_at = ?, updated_at = ? WHERE id = ? AND principal_id = ? AND status NOT IN ('revoked', 'disabled')`)
    .bind(healthState, timestamp, new Date(now).toISOString(), connectionId, principalId).run();
  return Number(result?.meta?.changes || 0) === 1;
}

export async function revokeIntegrationConnection(db, connectionId, principalId, now = Date.now()) {
  if (!db || typeof db.prepare !== 'function' || !Number.isFinite(now)) throw new TypeError('Integration connection database and valid clock are required');
  id(connectionId, 'integration connection identifier'); key(principalId, 'integration connection principal');
  const timestamp = new Date(now).toISOString();
  const result = await db.prepare(`UPDATE integration_connections SET status = 'revoked', health_state = 'disabled', revoked_at = ?, updated_at = ? WHERE id = ? AND principal_id = ? AND status != 'revoked'`)
    .bind(timestamp, timestamp, connectionId, principalId).run();
  return Number(result?.meta?.changes || 0) === 1;
}
