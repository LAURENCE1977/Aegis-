import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONNECTOR_STATUS,
  buildConnectorDiagnostics,
  evaluateConnectorStatus,
} from '../functions/lib/connector-diagnostics.mjs';

const now = Date.parse('2026-11-23T12:00:00.000Z');

test('an absent provider is reported as not connected without affecting other providers', () => {
  const result = buildConnectorDiagnostics({
    github: { connected: true, grantedCapabilities: ['identity.read', 'repository.read'] },
  }, now);
  const github = result.find(item => item.providerId === 'github');
  const instagram = result.find(item => item.providerId === 'instagram');
  const facebook = result.find(item => item.providerId === 'facebook_pages');
  assert.equal(github.status, CONNECTOR_STATUS.ACTIVE);
  assert.equal(instagram.status, CONNECTOR_STATUS.NOT_CONNECTED);
  assert.equal(facebook.status, CONNECTOR_STATUS.NOT_CONNECTED);
  assert.equal(github.writeEnabled, false);
});

test('Instagram rejects personal accounts while accepting verified Business and Creator accounts', () => {
  const personal = evaluateConnectorStatus('instagram', {
    connected: true,
    accountType: 'personal',
    grantedCapabilities: ['profile.read', 'media.read'],
  }, now);
  const business = evaluateConnectorStatus('instagram', {
    connected: true,
    accountType: 'business',
    grantedCapabilities: ['profile.read', 'media.read'],
  }, now);
  const creator = evaluateConnectorStatus('instagram', {
    connected: true,
    accountType: 'creator',
    grantedCapabilities: ['profile.read', 'media.read'],
  }, now);
  assert.equal(personal.status, CONNECTOR_STATUS.WRONG_ACCOUNT_TYPE);
  assert.equal(business.status, CONNECTOR_STATUS.ACTIVE);
  assert.equal(creator.status, CONNECTOR_STATUS.ACTIVE);
});

test('Facebook Pages requires a managed Page role and the read capabilities', () => {
  const missingRole = evaluateConnectorStatus('facebook_pages', {
    connected: true,
    accountType: 'page',
    roleVerified: false,
    grantedCapabilities: ['pages.list', 'pages.read', 'posts.read'],
  }, now);
  const missingScope = evaluateConnectorStatus('facebook_pages', {
    connected: true,
    accountType: 'page',
    roleVerified: true,
    grantedCapabilities: ['pages.list'],
  }, now);
  const active = evaluateConnectorStatus('facebook_pages', {
    connected: true,
    accountType: 'page',
    roleVerified: true,
    grantedCapabilities: ['pages.list', 'pages.read', 'posts.read'],
  }, now);
  assert.equal(missingRole.status, CONNECTOR_STATUS.MISSING_ROLE);
  assert.equal(missingScope.status, CONNECTOR_STATUS.MISSING_SCOPE);
  assert.equal(active.status, CONNECTOR_STATUS.ACTIVE);
});

test('provider failures are isolated and mapped to safe diagnostic states', () => {
  const result = buildConnectorDiagnostics({
    instagram: { providerAvailable: false, error: 'raw token response must not appear' },
    facebook_pages: { connected: true, configurationValid: false },
    github: { connected: true, grantedCapabilities: ['identity.read', 'repository.read'] },
  }, now);
  const byId = Object.fromEntries(result.map(item => [item.providerId, item]));
  assert.equal(byId.instagram.status, CONNECTOR_STATUS.PROVIDER_UNAVAILABLE);
  assert.equal(byId.facebook_pages.status, CONNECTOR_STATUS.CONFIGURATION_ERROR);
  assert.equal(byId.github.status, CONNECTOR_STATUS.ACTIVE);
  assert.equal(JSON.stringify(result).includes('raw token response'), false);
});

test('expired and revoked connections are not treated as active', () => {
  const expired = evaluateConnectorStatus('github', {
    connected: true,
    expiresAt: '2026-11-23T11:59:59.000Z',
    grantedCapabilities: ['identity.read', 'repository.read'],
  }, now);
  const revoked = evaluateConnectorStatus('cloudflare', {
    connected: true,
    revoked: true,
    grantedCapabilities: ['account.read', 'pages.read'],
  }, now);
  assert.equal(expired.status, CONNECTOR_STATUS.EXPIRED_OR_REVOKED);
  assert.equal(revoked.status, CONNECTOR_STATUS.EXPIRED_OR_REVOKED);
});

test('diagnostics never return credential-shaped input or enable writes', () => {
  const result = evaluateConnectorStatus('krystal', {
    connected: true,
    accountAlias: 'Krystal DNS',
    apiKey: 'secret-do-not-return',
    grantedCapabilities: ['dns.zones.read', 'dns.records.read', 'dns.records.write'],
  }, now);
  assert.equal(result.status, CONNECTOR_STATUS.ACTIVE);
  assert.equal(result.writeEnabled, false);
  assert.equal('apiKey' in result, false);
  assert.equal(JSON.stringify(result).includes('secret-do-not-return'), false);
  assert.deepEqual(result.grantedCapabilities, ['dns.zones.read', 'dns.records.read']);
});

test('unknown providers and malformed diagnostic clocks fail closed', () => {
  assert.throws(() => evaluateConnectorStatus('unknown-provider', {}, now), /unknown connector/i);
  assert.throws(() => evaluateConnectorStatus('github', {}, Number.NaN), /clock/i);
});

test('diagnostic account aliases and error codes are bounded and sanitised', () => {
  const result = evaluateConnectorStatus('oracle_cloud', {
    connected: false,
    accountAlias: '  OCI\nproduction\u0000 ',
    lastErrorCode: 'provider supplied private response',
  }, now);
  assert.equal(result.status, CONNECTOR_STATUS.AUTHORISATION_REQUIRED);
  assert.equal(result.accountAlias, 'OCI production');
  assert.equal(result.lastErrorCode, null);
});
