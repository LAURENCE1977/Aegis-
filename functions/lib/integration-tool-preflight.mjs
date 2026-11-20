const TOOL_SLUG_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SCOPE_PATTERN = /^[a-z][a-z0-9-]{0,40}:[a-z][a-z0-9-]{0,50}(?::[a-z0-9._-]{1,80})?$/;
const HEALTH_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const FUTURE_CLOCK_SKEW_MS = 60 * 1000;

function deny(reason) {
  return { eligible: false, reason };
}

function validUniqueList(value, pattern) {
  return Array.isArray(value) &&
    new Set(value).size === value.length &&
    value.every(item => typeof item === 'string' && pattern.test(item) && !item.includes('*'));
}

/**
 * A read-only gate before the existing Sentinel grant/approval pipeline.
 * An eligible result is not a grant, approval, credential resolution or permission to execute.
 */
export function evaluateIntegrationToolPreflight({
  provider,
  integration,
  connection,
  principalId,
  toolSlug,
  requiredScopes = [],
  now = Date.now(),
  maxHealthAgeMs = HEALTH_MAX_AGE_MS,
} = {}) {
  if (!Number.isFinite(now) || !Number.isFinite(maxHealthAgeMs) ||
      maxHealthAgeMs <= 0 || maxHealthAgeMs > HEALTH_MAX_AGE_MS) {
    return deny('preflight_clock_or_freshness_invalid');
  }
  if (!provider || typeof provider !== 'object' ||
      !integration || typeof integration !== 'object' ||
      !connection || typeof connection !== 'object') {
    return deny('preflight_metadata_missing');
  }
  if (typeof principalId !== 'string' || !principalId ||
      typeof toolSlug !== 'string' || !TOOL_SLUG_PATTERN.test(toolSlug)) {
    return deny('preflight_identity_invalid');
  }
  if (provider.status !== 'reviewed') return deny('provider_not_reviewed');
  if (typeof provider.verifiedAt !== 'string') return deny('provider_verification_missing');
  const providerVerifiedAt = Date.parse(provider.verifiedAt);
  if (!Number.isFinite(providerVerifiedAt) ||
      new Date(providerVerifiedAt).toISOString() !== provider.verifiedAt ||
      providerVerifiedAt > now + FUTURE_CLOCK_SKEW_MS) {
    return deny('provider_verification_invalid');
  }
  if (integration.status !== 'reviewed') return deny('integration_not_reviewed');
  if (typeof integration.schemaVersion !== 'string' || !integration.schemaVersion.trim() ||
      typeof integration.schemaHash !== 'string' ||
      !/^sha256:[a-f0-9]{64}$/.test(integration.schemaHash)) {
    return deny('integration_schema_unverified');
  }
  if (provider.id !== integration.providerId) return deny('provider_integration_mismatch');
  if (connection.principalId !== principalId) return deny('connection_principal_mismatch');
  if (connection.integrationId !== integration.id) return deny('connection_integration_mismatch');
  if (connection.revokedAt !== undefined && connection.revokedAt !== null) return deny('connection_revoked');
  if (connection.status !== 'connected') return deny('connection_not_connected');
  if (!['owner_private', 'workspace_shared', 'instant_platform_managed', 'public_no_auth'].includes(connection.connectionType)) {
    return deny('connection_type_unsupported');
  }
  if (!['api_key', 'oauth2_authorization_code_pkce', 'oauth2_client_credentials',
    'shared_platform_account', 'session_delegation', 'none_public'].includes(connection.authMode)) {
    return deny('connection_auth_unknown');
  }
  const authModeByConnectionType = {
    owner_private: ['api_key', 'oauth2_authorization_code_pkce', 'oauth2_client_credentials'],
    workspace_shared: ['shared_platform_account', 'session_delegation', 'oauth2_client_credentials'],
    instant_platform_managed: ['shared_platform_account', 'session_delegation'],
    public_no_auth: ['none_public'],
  };
  if (!authModeByConnectionType[connection.connectionType]?.includes(connection.authMode)) {
    return deny('connection_auth_mismatch');
  }
  if (['owner_private', 'workspace_shared'].includes(connection.connectionType) &&
      connection.authMode === 'oauth2_client_credentials' && !connection.platformConnectionId) {
    return deny('connection_credential_missing');
  }
  if (connection.connectionType === 'owner_private' &&
      ['api_key', 'oauth2_authorization_code_pkce'].includes(connection.authMode) &&
      !connection.platformConnectionId) {
    return deny('connection_credential_missing');
  }
  if (connection.connectionType === 'public_no_auth' && connection.platformConnectionId) {
    return deny('connection_auth_mismatch');
  }
  if (connection.healthState !== 'healthy') return deny('connection_not_healthy');
  if (typeof connection.healthCheckedAt !== 'string') return deny('health_evidence_invalid');
  const checkedAt = Date.parse(connection.healthCheckedAt);
  if (!Number.isFinite(checkedAt) || new Date(checkedAt).toISOString() !== connection.healthCheckedAt ||
      checkedAt > now + FUTURE_CLOCK_SKEW_MS) {
    return deny('health_evidence_invalid');
  }
  if (checkedAt < now - maxHealthAgeMs) return deny('health_evidence_stale');
  if (!validUniqueList(connection.allowedToolSlugs, TOOL_SLUG_PATTERN)) {
    return deny('connection_allowlist_invalid');
  }
  if (!connection.allowedToolSlugs.includes(toolSlug)) return deny('tool_not_allowlisted');
  if (!validUniqueList(connection.scopes, SCOPE_PATTERN) ||
      !validUniqueList(requiredScopes, SCOPE_PATTERN)) {
    return deny('required_scopes_invalid');
  }
  if (!requiredScopes.every(scope => connection.scopes.includes(scope))) {
    return deny('required_scope_missing');
  }
  return { eligible: true, reason: 'eligible_for_sentinel_review' };
}
