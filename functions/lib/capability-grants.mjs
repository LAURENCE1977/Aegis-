const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const RESOURCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/;
const SCOPE_PATTERN = /^[a-z][a-z0-9-]{0,40}:[a-z][a-z0-9-]{0,50}(?::[a-z0-9._-]{1,80})?$/;
const MAX_GRANT_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const INPUT_KEYS = new Set([
  'principalId', 'capabilityId', 'capabilityVersion', 'resourceId',
  'scopes', 'createdBy', 'expiresAt',
]);

function requiredId(value, label) {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    throw new TypeError('Invalid grant ' + label);
  }
}

function mapGrant(row) {
  if (!row) return null;
  let scopes;
  try { scopes = JSON.parse(row.scopes_json); } catch { return null; }
  if (!Array.isArray(scopes) || scopes.some(scope => typeof scope !== 'string')) return null;
  return {
    id: row.id,
    principalId: row.principal_id,
    capabilityId: row.capability_id,
    capabilityVersion: row.capability_version,
    resourceId: row.resource_id,
    resourceIds: [row.resource_id],
    scopes,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
  };
}

function validateGrantInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).some(key => !INPUT_KEYS.has(key))) {
    throw new TypeError('Invalid grant fields');
  }
  requiredId(input.principalId, 'principal');
  requiredId(input.capabilityId, 'capability identifier');
  if (typeof input.capabilityVersion !== 'string' ||
      !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(input.capabilityVersion)) {
    throw new TypeError('Invalid grant capability version');
  }
  if (typeof input.resourceId !== 'string' || !RESOURCE_PATTERN.test(input.resourceId) ||
      input.resourceId.includes('..') || input.resourceId.includes('*')) {
    throw new TypeError('Invalid exact grant resource');
  }
  if (!Array.isArray(input.scopes) || input.scopes.length < 1 || input.scopes.length > 50 ||
      input.scopes.some(scope => typeof scope !== 'string' || !SCOPE_PATTERN.test(scope)) ||
      new Set(input.scopes).size !== input.scopes.length) {
    throw new TypeError('Invalid grant scopes');
  }
  if (input.createdBy !== 'owner') throw new TypeError('Only the authenticated owner may create a grant');
}

export async function createCapabilityGrant(db, input, now = Date.now()) {
  if (!db || typeof db.prepare !== 'function' || !Number.isFinite(now)) {
    throw new TypeError('Grant database and valid clock are required');
  }
  validateGrantInput(input);
  const expiry = Date.parse(input.expiresAt);
  if (typeof input.expiresAt !== 'string' || !Number.isFinite(expiry) ||
      expiry <= now || expiry > now + MAX_GRANT_TTL_MS) {
    throw new TypeError('Grant expiry must be within the next 90 days');
  }
  const id = crypto.randomUUID();
  const createdAt = new Date(now).toISOString();
  await db.prepare(`
    INSERT INTO capability_grants (
      id, principal_id, capability_id, capability_version, resource_id,
      scopes_json, status, created_by, created_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
  `).bind(
    id, input.principalId, input.capabilityId, input.capabilityVersion,
    input.resourceId, JSON.stringify([...input.scopes].sort()), input.createdBy,
    createdAt, new Date(expiry).toISOString(),
  ).run();
  const row = await db.prepare('SELECT * FROM capability_grants WHERE id = ?').bind(id).first();
  const grant = mapGrant(row);
  if (!grant) throw new Error('Capability grant could not be persisted');
  return grant;
}

/** Exact-match loader suitable for Sentinel's trusted loadGrant dependency. */
export async function loadCapabilityGrant(db, {
  principalId, capabilityId, capabilityVersion, resourceId,
} = {}, now = Date.now()) {
  if (!db || typeof db.prepare !== 'function' || !Number.isFinite(now)) {
    throw new TypeError('Grant database and valid clock are required');
  }
  requiredId(principalId, 'principal');
  requiredId(capabilityId, 'capability identifier');
  requiredId(capabilityVersion, 'capability version');
  if (typeof resourceId !== 'string' || !RESOURCE_PATTERN.test(resourceId) ||
      resourceId.includes('..') || resourceId.includes('*')) {
    throw new TypeError('Invalid exact grant resource');
  }
  const row = await db.prepare(`
    SELECT * FROM capability_grants
    WHERE principal_id = ? AND capability_id = ? AND capability_version = ?
      AND resource_id = ? AND status = 'active' AND expires_at > ?
  `).bind(principalId, capabilityId, capabilityVersion, resourceId, new Date(now).toISOString()).first();
  return mapGrant(row);
}

export async function revokeCapabilityGrant(db, id, principalId, now = Date.now()) {
  if (!db || typeof db.prepare !== 'function' || !Number.isFinite(now)) {
    throw new TypeError('Grant database and valid clock are required');
  }
  requiredId(id, 'identifier');
  requiredId(principalId, 'principal');
  const result = await db.prepare(`
    UPDATE capability_grants
    SET status = 'revoked', revoked_at = ?
    WHERE id = ? AND principal_id = ? AND status = 'active'
  `).bind(new Date(now).toISOString(), id, principalId).run();
  return Number(result?.meta?.changes || 0) === 1;
}
