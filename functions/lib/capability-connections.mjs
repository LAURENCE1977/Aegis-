const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const PROVIDER_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;
const SECRET_REF_PATTERN = /^vault:\/\/[A-Za-z0-9][A-Za-z0-9._/-]{2,120}$/;
const SCOPE_PATTERN = /^[a-z][a-z0-9-]{0,40}:[a-z][a-z0-9-]{0,50}(?::[a-z0-9._-]{1,80})?$/;
const MAX_CONNECTION_TTL_MS = 365 * 24 * 60 * 60 * 1000;

function requiredId(value, label) {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    throw new TypeError('Invalid connection ' + label);
  }
}

function isoTime(value, label) {
  const time = Date.parse(value);
  if (typeof value !== 'string' || !Number.isFinite(time)) {
    throw new TypeError('Invalid connection ' + label);
  }
  return new Date(time).toISOString();
}

function mapConnection(row) {
  if (!row) return null;
  let scopes;
  try { scopes = JSON.parse(row.scopes_json); } catch { return null; }
  if (!Array.isArray(scopes) || scopes.some(scope => typeof scope !== 'string')) return null;
  return {
    id: row.id,
    principalId: row.principal_id,
    providerId: row.provider_id,
    secretRef: row.secret_ref,
    scopes,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
  };
}

function validateInput(input) {
  const allowed = new Set([
    'principalId', 'providerId', 'secretRef', 'scopes', 'createdBy', 'expiresAt',
  ]);
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).some(key => !allowed.has(key))) {
    throw new TypeError('Invalid connection fields');
  }
  requiredId(input.principalId, 'principal');
  if (typeof input.providerId !== 'string' || !PROVIDER_PATTERN.test(input.providerId)) {
    throw new TypeError('Invalid connection provider');
  }
  if (typeof input.secretRef !== 'string' || !SECRET_REF_PATTERN.test(input.secretRef) ||
      input.secretRef.includes('..')) {
    throw new TypeError('Invalid secret reference; credential values must live in the vault');
  }
  if (input.createdBy !== 'owner') throw new TypeError('Only the owner may create a connection');
  if (!Array.isArray(input.scopes) || input.scopes.length < 1 || input.scopes.length > 50 ||
      input.scopes.some(scope => typeof scope !== 'string' || !SCOPE_PATTERN.test(scope) || scope.includes('*')) ||
      new Set(input.scopes).size !== input.scopes.length) {
    throw new TypeError('Invalid connection scopes');
  }
}

function safeConnection(row) {
  const mapped = mapConnection(row);
  if (!mapped) return null;
  const { secretRef: _secretRef, ...safe } = mapped;
  return safe;
}

export async function createConnection(db, input, now = Date.now()) {
  if (!db || typeof db.prepare !== 'function') throw new TypeError('Connection database is required');
  validateInput(input);
  if (!Number.isFinite(now)) throw new TypeError('Invalid connection clock');
  const createdAt = new Date(now).toISOString();
  let expiresAt = null;
  if (input.expiresAt !== undefined && input.expiresAt !== null) {
    expiresAt = isoTime(input.expiresAt, 'expiry');
    const expiry = Date.parse(expiresAt);
    if (expiry <= now || expiry > now + MAX_CONNECTION_TTL_MS) {
      throw new TypeError('Connection expiry must be within the next 365 days');
    }
  }

  // Expired records remain in the audit history but no longer occupy the
  // provider's single active-connection slot.
  await db.prepare(`
    UPDATE capability_connections
    SET status = 'revoked', revoked_at = ?
    WHERE principal_id = ? AND provider_id = ?
      AND status = 'active' AND expires_at IS NOT NULL AND expires_at <= ?
  `).bind(createdAt, input.principalId, input.providerId, createdAt).run();

  const id = crypto.randomUUID();
  const result = await db.prepare(`
    INSERT INTO capability_connections (
      id, principal_id, provider_id, secret_ref, scopes_json, created_by,
      created_at, expires_at, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
  `).bind(
    id, input.principalId, input.providerId, input.secretRef,
    JSON.stringify(input.scopes), input.createdBy, createdAt, expiresAt,
  ).run();
  if (result?.meta?.changes === 0) throw new Error('An active connection already exists for this provider');
  const row = await db.prepare(
    'SELECT * FROM capability_connections WHERE id = ? AND principal_id = ?',
  ).bind(id, input.principalId).first();
  if (!row) throw new Error('Connection metadata could not be persisted');
  return mapConnection(row);
}

/** Exact principal/provider lookup used by the Sentinel composition root. */
export async function loadConnection(db, { principalId, providerId } = {}, now = Date.now()) {
  if (!db || typeof db.prepare !== 'function') throw new TypeError('Connection database is required');
  requiredId(principalId, 'principal');
  if (typeof providerId !== 'string' || !PROVIDER_PATTERN.test(providerId)) {
    throw new TypeError('Invalid connection provider');
  }
  if (!Number.isFinite(now)) throw new TypeError('Invalid connection clock');
  const row = await db.prepare(`
    SELECT * FROM capability_connections
    WHERE principal_id = ? AND provider_id = ?
      AND status = 'active' AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > ?)
    LIMIT 1
  `).bind(principalId, providerId, new Date(now).toISOString()).first();
  return mapConnection(row);
}

export async function listConnections(db, principalId, limit = 50) {
  if (!db || typeof db.prepare !== 'function') throw new TypeError('Connection database is required');
  requiredId(principalId, 'principal');
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new TypeError('Connection list limit must be between 1 and 100');
  }
  const result = await db.prepare(`
    SELECT * FROM capability_connections
    WHERE principal_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(principalId, limit).all();
  return (result?.results || []).map(safeConnection).filter(Boolean);
}

export async function revokeConnection(db, id, principalId, now = Date.now()) {
  if (!db || typeof db.prepare !== 'function') throw new TypeError('Connection database is required');
  requiredId(id, 'identifier');
  requiredId(principalId, 'principal');
  if (!Number.isFinite(now)) throw new TypeError('Invalid connection clock');
  const result = await db.prepare(`
    UPDATE capability_connections
    SET status = 'revoked', revoked_at = ?
    WHERE id = ? AND principal_id = ? AND status = 'active' AND revoked_at IS NULL
  `).bind(new Date(now).toISOString(), id, principalId).run();
  return result?.meta?.changes === 1;
}
