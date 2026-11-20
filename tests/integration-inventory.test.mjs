import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createIntegrationProvider,
  createIntegrationDefinition,
  upsertIntegrationConnection,
  loadIntegrationConnection,
  listIntegrationConnections,
  recordIntegrationHealth,
  revokeIntegrationConnection,
} from '../functions/lib/integration-inventory.mjs';

class MemoryD1 {
  constructor() {
    this.providers = new Map();
    this.integrations = new Map();
    this.connections = new Map();
  }
  prepare(sql) {
    const db = this;
    return {
      values: [],
      bind(...values) { this.values = values; return this; },
      async run() {
        const v = this.values;
        if (sql.includes('INSERT INTO integration_providers')) {
          const [id, name, sourceUrl, verifiedAt, status, createdBy, createdAt] = v;
          if (db.providers.has(id)) throw new Error('UNIQUE');
          db.providers.set(id, { id, display_name: name, source_url: sourceUrl, verified_at: verifiedAt, status, created_by: createdBy, created_at: createdAt });
          return { meta: { changes: 1 } };
        }
        if (sql.includes('INSERT INTO integration_definitions')) {
          const [id, providerId, slug, name, description, authMode, sourceUrl, schemaVersion, schemaHash, status, createdBy, createdAt] = v;
          if (db.integrations.has(id) || [...db.integrations.values()].some(x => x.provider_id === providerId && x.slug === slug)) throw new Error('UNIQUE');
          db.integrations.set(id, { id, provider_id: providerId, slug, display_name: name, description, auth_mode: authMode, source_url: sourceUrl, schema_version: schemaVersion, schema_hash: schemaHash, status, created_by: createdBy, created_at: createdAt });
          return { meta: { changes: 1 } };
        }
        if (sql.includes('INSERT INTO integration_connections')) {
          const [id, principalId, integrationId, connectionKey, connectionType, authMode, accountAlias, platformAccountId, platformConnectionId, toolSlugs, scopes, status, lastObservedAt, createdBy, createdAt, updatedAt] = v;
          const existing = [...db.connections.values()].find(x => x.principal_id === principalId && x.integration_id === integrationId && x.connection_key === connectionKey);
          const row = { id: existing?.id || id, principal_id: principalId, integration_id: integrationId, connection_key: connectionKey, connection_type: connectionType, auth_mode: authMode, account_alias: accountAlias, platform_account_id: platformAccountId, platform_connection_id: platformConnectionId, allowed_tool_slugs_json: toolSlugs, scopes_json: scopes, status, last_observed_at: lastObservedAt, health_state: 'unknown', health_checked_at: null, created_by: createdBy, created_at: existing?.created_at || createdAt, updated_at: updatedAt, revoked_at: null };
          db.connections.set(row.id, row);
          return { meta: { changes: 1 } };
        }
        if (sql.includes('UPDATE integration_connections') && sql.includes('SET health_state = ?')) {
          const [healthState, checkedAt, updatedAt, id, principalId] = v;
          const row = db.connections.get(id);
          if (!row || row.principal_id !== principalId || ['revoked', 'disabled'].includes(row.status)) return { meta: { changes: 0 } };
          row.health_state = healthState;
          row.health_checked_at = checkedAt;
          row.updated_at = updatedAt;
          return { meta: { changes: 1 } };
        }
        if (sql.includes('UPDATE integration_connections') && sql.includes("SET status = 'revoked'")) {
          const [revokedAt, updatedAt, id, principalId] = v;
          const row = db.connections.get(id);
          if (!row || row.principal_id !== principalId || row.status === 'revoked') return { meta: { changes: 0 } };
          row.status = 'revoked';
          row.health_state = 'disabled';
          row.revoked_at = revokedAt;
          row.updated_at = updatedAt;
          return { meta: { changes: 1 } };
        }
        return { meta: { changes: 0 } };
      },
      async first() {
        const v = this.values;
        if (sql.includes('FROM integration_providers')) {
          const row = db.providers.get(v[0]);
          return row ? { ...row } : null;
        }
        if (sql.includes('FROM integration_definitions')) {
          const row = db.integrations.get(v[0]);
          return row ? { ...row } : null;
        }
        if (sql.includes('FROM integration_connections')) {
          const row = [...db.connections.values()].find(x =>
            x.principal_id === v[0] && x.integration_id === v[1] && x.connection_key === v[2]);
          return row ? { ...row } : null;
        }
        return null;
      },
      async all() {
        const [principalId, limit] = this.values;
        return { results: [...db.connections.values()]
          .filter(row => row.principal_id === principalId)
          .sort((a, b) => b.last_observed_at.localeCompare(a.last_observed_at))
          .slice(0, limit).map(row => ({ ...row })) };
      },
    };
  }
}

const now = () => new Date().toISOString();
const provider = (overrides = {}) => ({
  id: 'composio',
  displayName: 'Composio',
  sourceUrl: 'https://composio.dev/',
  verifiedAt: now(),
  status: 'reviewed',
  createdBy: 'owner',
  ...overrides,
});
const integration = (overrides = {}) => ({
  id: 'composio-github',
  providerId: 'composio',
  slug: 'github',
  displayName: 'GitHub',
  description: 'GitHub toolkit exposed through Composio.',
  authMode: 'shared_platform_account',
  sourceUrl: 'https://composio.dev/toolkits/github',
  schemaVersion: 'v1',
  schemaHash: 'sha256:' + 'a'.repeat(64),
  status: 'discovered',
  createdBy: 'owner',
  ...overrides,
});
const connection = (overrides = {}) => ({
  principalId: 'owner-1',
  integrationId: 'composio-github',
  connectionKey: 'github-personal',
  connectionType: 'instant_platform_managed',
  authMode: 'shared_platform_account',
  accountAlias: 'Personal GitHub',
  platformAccountId: 'acct_opaque_123',
  platformConnectionId: null,
  allowedToolSlugs: ['GITHUB_GET_REPO'],
  scopes: ['github:public-metadata:read'],
  status: 'connected_unverified',
  lastObservedAt: now(),
  healthState: 'unknown',
  healthCheckedAt: null,
  createdBy: 'owner',
  ...overrides,
});

test('stores provider and integration definitions as separate records', async () => {
  const db = new MemoryD1();
  const p = await createIntegrationProvider(db, provider());
  const i = await createIntegrationDefinition(db, integration());
  assert.equal(p.id, 'composio');
  assert.equal(i.providerId, 'composio');
  assert.equal(i.id, 'composio-github');
  assert.equal(i.authMode, 'shared_platform_account');
});

test('supports multiple platform accounts for one integration using distinct stable connection keys', async () => {
  const db = new MemoryD1();
  await createIntegrationProvider(db, provider());
  await createIntegrationDefinition(db, integration());
  const first = await upsertIntegrationConnection(db, connection(), Date.now());
  const second = await upsertIntegrationConnection(db, connection({
    connectionKey: 'github-work',
    accountAlias: 'Work GitHub',
    platformAccountId: 'acct_opaque_456',
  }), Date.now());
  assert.notEqual(first.id, second.id);
  const listed = await listIntegrationConnections(db, 'owner-1');
  assert.equal(listed.length, 2);
  assert.deepEqual(listed.map(x => x.connectionKey).sort(), ['github-personal', 'github-work']);
});

test('connection inventory exposes exact allowed tool slugs but never credential fields', async () => {
  const db = new MemoryD1();
  await createIntegrationProvider(db, provider());
  await createIntegrationDefinition(db, integration());
  const created = await upsertIntegrationConnection(db, connection(), Date.now());
  const listed = await listIntegrationConnections(db, 'owner-1');
  assert.equal(listed[0].id, created.id);
  assert.deepEqual(listed[0].allowedToolSlugs, ['GITHUB_GET_REPO']);
  assert.equal('secretRef' in listed[0], false);
  assert.equal('apiKey' in listed[0], false);
});

test('rejects secrets, unknown fields, wildcard tool slugs and invalid auth-mode combinations', async () => {
  const db = new MemoryD1();
  await createIntegrationProvider(db, provider());
  await createIntegrationDefinition(db, integration());
  await assert.rejects(() => upsertIntegrationConnection(db, connection({ apiKey: 'secret' })), /fields/i);
  await assert.rejects(() => upsertIntegrationConnection(db, connection({ allowedToolSlugs: ['*'] })), /tool slug/i);
  await assert.rejects(() => upsertIntegrationConnection(db, connection({
    connectionType: 'public_no_auth',
    authMode: 'api_key',
  })), /auth mode/i);
});

test('public no-auth inventory records do not require a vault or platform connection', async () => {
  const db = new MemoryD1();
  await createIntegrationProvider(db, provider());
  await createIntegrationDefinition(db, integration({
    id: 'public-weather',
    slug: 'weather',
    authMode: 'none_public',
    sourceUrl: 'https://example.com/weather',
  }));
  const created = await upsertIntegrationConnection(db, connection({
    integrationId: 'public-weather',
    connectionKey: 'public-weather',
    connectionType: 'public_no_auth',
    authMode: 'none_public',
    accountAlias: 'Public weather API',
    platformAccountId: null,
    allowedToolSlugs: ['WEATHER_FORECAST'],
    scopes: [],
    status: 'connected_unverified',
  }), Date.now());
  assert.equal(created.connectionType, 'public_no_auth');
  assert.equal(created.authMode, 'none_public');
  assert.equal(created.platformConnectionId, null);
});

test('healthy status requires a timestamped health observation and revoked connections cannot become healthy', async () => {
  const db = new MemoryD1();
  await createIntegrationProvider(db, provider());
  await createIntegrationDefinition(db, integration());
  const created = await upsertIntegrationConnection(db, connection(), Date.now());
  await assert.rejects(() => recordIntegrationHealth(db, {
    id: created.id, principalId: 'owner-1', healthState: 'healthy',
  }), /timestamp/i);
  assert.equal(await recordIntegrationHealth(db, {
    id: created.id, principalId: 'owner-1', healthState: 'healthy', checkedAt: now(),
  }), true);
  assert.equal(await revokeIntegrationConnection(db, created.id, 'owner-1', Date.now()), true);
  assert.equal(await recordIntegrationHealth(db, {
    id: created.id, principalId: 'owner-1', healthState: 'healthy', checkedAt: now(),
  }), false);
});

test('connection inventory is owner-scoped and bounded', async () => {
  const db = new MemoryD1();
  await createIntegrationProvider(db, provider());
  await createIntegrationDefinition(db, integration());
  await upsertIntegrationConnection(db, connection(), Date.now());
  assert.equal((await listIntegrationConnections(db, 'owner-2')).length, 0);
  await assert.rejects(() => listIntegrationConnections(db, 'owner-1', 101), /limit/i);
});
