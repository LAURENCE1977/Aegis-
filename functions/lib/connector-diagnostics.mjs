const STATUS = Object.freeze({
  NOT_CONNECTED: 'not_connected',
  AUTHORISATION_REQUIRED: 'authorisation_required',
  ACTIVE: 'active',
  MISSING_SCOPE: 'missing_scope',
  WRONG_ACCOUNT_TYPE: 'wrong_account_type',
  MISSING_ROLE: 'missing_role',
  EXPIRED_OR_REVOKED: 'expired_or_revoked',
  PROVIDER_UNAVAILABLE: 'provider_unavailable',
  CONFIGURATION_ERROR: 'configuration_error',
});

export const CONNECTOR_STATUS = STATUS;

const CONNECTORS = Object.freeze([
  Object.freeze({
    providerId: 'instagram',
    label: 'Instagram',
    authMethod: 'oauth',
    requiredCapabilities: Object.freeze(['profile.read', 'media.read']),
    accountTypes: Object.freeze(['business', 'creator']),
  }),
  Object.freeze({
    providerId: 'facebook_pages',
    label: 'Facebook Pages',
    authMethod: 'oauth',
    requiredCapabilities: Object.freeze(['pages.list', 'pages.read', 'posts.read']),
    accountTypes: Object.freeze(['page']),
    requiresRole: true,
  }),
  Object.freeze({
    providerId: 'github',
    label: 'GitHub',
    authMethod: 'composio',
    requiredCapabilities: Object.freeze(['identity.read', 'repository.read']),
  }),
  Object.freeze({
    providerId: 'cloudflare',
    label: 'Cloudflare',
    authMethod: 'composio',
    requiredCapabilities: Object.freeze(['account.read', 'pages.read']),
  }),
  Object.freeze({
    providerId: 'composio',
    label: 'Composio',
    authMethod: 'api_key',
    requiredCapabilities: Object.freeze(['connections.read']),
  }),
  Object.freeze({
    providerId: 'krystal',
    label: 'Krystal.io',
    authMethod: 'api_token',
    requiredCapabilities: Object.freeze(['dns.zones.read', 'dns.records.read']),
  }),
  Object.freeze({
    providerId: 'oracle_cloud',
    label: 'Oracle Cloud',
    authMethod: 'oci_signing_key',
    requiredCapabilities: Object.freeze(['identity.read', 'resources.read']),
  }),
]);

const ERROR_CODES = new Set([
  'OAUTH_DENIED',
  'MISSING_SCOPE',
  'WRONG_ACCOUNT_TYPE',
  'MISSING_ROLE',
  'TOKEN_EXPIRED',
  'UPSTREAM_UNAVAILABLE',
  'INVALID_CONFIGURATION',
]);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function safeAlias(value) {
  if (typeof value !== 'string') return null;
  const alias = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return alias ? alias.slice(0, 80) : null;
}

function safeTimestamp(value) {
  if (typeof value !== 'string') return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function findConnector(providerId) {
  return CONNECTORS.find(connector => connector.providerId === providerId) || null;
}

export function listConnectorDefinitions() {
  return CONNECTORS.map(connector => ({
    providerId: connector.providerId,
    label: connector.label,
    authMethod: connector.authMethod,
    requiredCapabilities: [...connector.requiredCapabilities],
  }));
}

/**
 * Converts one trusted, server-side provider observation into a safe status row.
 * Provider responses and credential fields are never copied into the result.
 */
export function evaluateConnectorStatus(providerId, observation = null, now = Date.now()) {
  const connector = findConnector(providerId);
  if (!connector) throw new TypeError('Unknown connector provider');
  if (!Number.isFinite(now)) throw new TypeError('Invalid connector diagnostic clock');
  if (observation !== null && !isRecord(observation)) {
    throw new TypeError('Invalid connector observation');
  }

  const source = observation || {};
  const connected = source.connected === true;
  let status = STATUS.NOT_CONNECTED;
  let grantedCapabilities = [];

  if (observation) {
    if (source.providerAvailable === false) {
      status = STATUS.PROVIDER_UNAVAILABLE;
    } else if (source.configurationValid === false) {
      status = STATUS.CONFIGURATION_ERROR;
    } else if (source.expiresAt !== undefined && source.expiresAt !== null &&
      (typeof source.expiresAt !== 'string' || !Number.isFinite(Date.parse(source.expiresAt)))) {
      status = STATUS.CONFIGURATION_ERROR;
    } else if (source.revoked === true || source.status === 'revoked' ||
      (source.expiresAt && Date.parse(source.expiresAt) <= now)) {
      status = STATUS.EXPIRED_OR_REVOKED;
    } else if (connected && connector.accountTypes &&
      !connector.accountTypes.includes(String(source.accountType || '').toLowerCase())) {
      status = STATUS.WRONG_ACCOUNT_TYPE;
    } else if (connected && connector.requiresRole && source.roleVerified !== true) {
      status = STATUS.MISSING_ROLE;
    } else if (!connected) {
      status = source.authorisationRequired === true
        ? STATUS.AUTHORISATION_REQUIRED : STATUS.NOT_CONNECTED;
    } else {
      const supplied = Array.isArray(source.grantedCapabilities)
        ? source.grantedCapabilities.filter(value => typeof value === 'string')
        : [];
      grantedCapabilities = connector.requiredCapabilities.filter(capability => supplied.includes(capability));
      status = connector.requiredCapabilities.every(capability => grantedCapabilities.includes(capability))
        ? STATUS.ACTIVE : STATUS.MISSING_SCOPE;
    }
  }

  return {
    providerId: connector.providerId,
    label: connector.label,
    client: source.client === 'chatgpt' ? 'chatgpt' : 'aegis',
    authMethod: connector.authMethod,
    status,
    accountAlias: safeAlias(source.accountAlias),
    requiredCapabilities: [...connector.requiredCapabilities],
    grantedCapabilities,
    lastCheckedAt: safeTimestamp(source.lastCheckedAt),
    lastErrorCode: ERROR_CODES.has(source.lastErrorCode) ? source.lastErrorCode : null,
    readEnabled: status === STATUS.ACTIVE,
    writeEnabled: false,
  };
}

/**
 * Builds a stable, independently evaluated status row for every connector.
 * A malformed or failed provider observation is contained to that provider.
 */
export function buildConnectorDiagnostics(observations = {}, now = Date.now()) {
  if (!isRecord(observations)) throw new TypeError('Invalid connector observations');
  if (!Number.isFinite(now)) throw new TypeError('Invalid connector diagnostic clock');

  return CONNECTORS.map(connector => {
    const observation = observations[connector.providerId] ?? null;
    try {
      return evaluateConnectorStatus(connector.providerId, observation, now);
    } catch {
      return evaluateConnectorStatus(connector.providerId, { configurationValid: false }, now);
    }
  });
}
