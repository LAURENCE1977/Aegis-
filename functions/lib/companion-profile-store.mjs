import {
  createDefaultAegisCompanionProfile,
  validateCompanionProfile,
} from './companion-contracts.mjs';

const OWNER_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const PROFILE_ID_PATTERN = /^custom-[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/;
const PATCH_KEYS = ['displayName', 'description', 'appearance', 'voice', 'interaction', 'accessibility', 'memoryScope'];
const MAX_PROFILES = 50;
const MAX_REVISIONS = 500;

function requireDatabase(db) {
  if (!db || typeof db.prepare !== 'function') throw new TypeError('Companion Profile database is required');
}
function requireAtomicDatabase(db) {
  requireDatabase(db);
  if (typeof db.batch !== 'function') throw new Error('Atomic D1 batch support is required for Companion Profile writes');
}
function requireOwner(ownerId) {
  if (typeof ownerId !== 'string' || !OWNER_PATTERN.test(ownerId)) throw new TypeError('Invalid Companion Profile owner identifier');
}
function requireProfileId(profileId) {
  if (typeof profileId !== 'string' || !PROFILE_ID_PATTERN.test(profileId)) throw new TypeError('Invalid custom Companion Profile identifier');
}
function validClock(now) {
  if (!Number.isFinite(now)) throw new TypeError('Invalid Companion Profile clock');
  return new Date(now).toISOString();
}
function canonicalJson(value) {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonicalJson(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}
async function sha256Hex(value) {
  if (!globalThis.crypto?.subtle) throw new Error('Web Crypto SHA-256 is unavailable');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
function validatePatch(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch) ||
      Object.keys(patch).some(key => !PATCH_KEYS.includes(key)) ||
      Object.keys(patch).length === 0) {
    throw new TypeError('Invalid Companion Profile update fields');
  }
}
async function mapProfileRow(row) {
  if (!row || typeof row.id !== 'string' || typeof row.owner_id !== 'string' ||
      typeof row.profile_id !== 'string' || !Number.isInteger(row.version) || row.version < 1 ||
      typeof row.profile_digest !== 'string' || !/^[a-f0-9]{64}$/.test(row.profile_digest) ||
      typeof row.profile_json !== 'string' || typeof row.created_at !== 'string') {
    throw new TypeError('Stored Companion Profile metadata is invalid');
  }
  let parsed;
  try { parsed = JSON.parse(row.profile_json); }
  catch { throw new TypeError('Stored Companion Profile JSON is corrupt'); }
  const profile = validateCompanionProfile(parsed);
  if (profile.kind !== 'custom' || profile.id !== row.profile_id ||
      await sha256Hex(canonicalJson(profile)) !== row.profile_digest) {
    throw new TypeError('Stored Companion Profile identity or digest does not match its content');
  }
  return Object.freeze({
    ownerId: row.owner_id,
    profileId: row.profile_id,
    version: row.version,
    profile,
    digest: row.profile_digest,
    createdAt: row.created_at,
  });
}
async function readExactProfile(db, ownerId, profileId, version) {
  const row = await db.prepare(`
    SELECT * FROM companion_profiles
    WHERE owner_id = ? AND profile_id = ? AND version = ? LIMIT 1
  `).bind(ownerId, profileId, version).first();
  return row ? mapProfileRow(row) : null;
}
async function readLatestProfile(db, ownerId, profileId) {
  const row = await db.prepare(`
    SELECT * FROM companion_profiles
    WHERE owner_id = ? AND profile_id = ?
    ORDER BY version DESC LIMIT 1
  `).bind(ownerId, profileId).first();
  return row ? mapProfileRow(row) : null;
}
function preferenceStatement(db, ownerId, profileId, version, timestamp) {
  return db.prepare(`
    INSERT INTO companion_profile_preferences (
      owner_id, active_profile_id, active_profile_version, updated_at
    ) VALUES (?, ?, ?, ?)
    ON CONFLICT(owner_id) DO UPDATE SET
      active_profile_id = excluded.active_profile_id,
      active_profile_version = excluded.active_profile_version,
      updated_at = excluded.updated_at
  `).bind(ownerId, profileId, version, timestamp);
}
function selectionEventStatement(db, ownerId, profileId, version, eventType, digest, timestamp) {
  return db.prepare(`
    INSERT INTO companion_profile_events (
      id, owner_id, profile_id, profile_version, event_type, profile_digest, occurred_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind('selection-' + crypto.randomUUID().toLowerCase().replaceAll('-', ''),
    ownerId, profileId, version, eventType, digest, timestamp);
}

export class CompanionProfileConflictError extends Error {
  constructor() {
    super('Companion Profile changed since it was loaded; refresh before saving');
    this.name = 'CompanionProfileConflictError';
    this.status = 409;
  }
}
export class CompanionProfileNotFoundError extends Error {
  constructor() {
    super('Custom Companion Profile not found');
    this.name = 'CompanionProfileNotFoundError';
    this.status = 404;
  }
}

export async function createCompanionProfile(db, ownerId, input, now = Date.now()) {
  requireAtomicDatabase(db);
  requireOwner(ownerId);
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).some(key => !PATCH_KEYS.includes(key)) ||
      !Object.hasOwn(input, 'displayName')) {
    throw new TypeError('Invalid Companion Profile creation fields');
  }
  const timestamp = validClock(now);
  const defaults = createDefaultAegisCompanionProfile();
  const profile = validateCompanionProfile({
    ...defaults,
    id: 'custom-' + crypto.randomUUID().toLowerCase().replaceAll('-', ''),
    kind: 'custom',
    ...input,
    appearance: { ...defaults.appearance, ...(input.appearance || {}) },
    voice: { ...defaults.voice, ...(input.voice || {}) },
    interaction: { ...defaults.interaction, ...(input.interaction || {}) },
    accessibility: { ...defaults.accessibility, ...(input.accessibility || {}) },
  });
  const json = canonicalJson(profile);
  const digest = await sha256Hex(json);
  const id = 'companion-profile-' + crypto.randomUUID().toLowerCase().replaceAll('-', '');
  const version = 1;
  const results = await db.batch([
    db.prepare(`
      INSERT INTO companion_profiles (
        id, owner_id, profile_id, version, profile_digest, profile_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(id, ownerId, profile.id, version, digest, json, timestamp),
    preferenceStatement(db, ownerId, profile.id, version, timestamp),
    selectionEventStatement(db, ownerId, profile.id, version, 'selected', digest, timestamp),
  ]);
  if (results?.[0]?.meta?.changes !== 1 ||
      results?.[1]?.meta?.changes !== 1 ||
      results?.[2]?.meta?.changes !== 1) {
    throw new Error('Companion Profile could not be persisted atomically');
  }
  return Object.freeze({
    ownerId, profile, version, digest, createdAt: timestamp,
    activeProfileId: profile.id,
  });
}

export async function listCompanionProfiles(db, ownerId, limit = MAX_PROFILES) {
  requireDatabase(db);
  requireOwner(ownerId);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PROFILES) {
    throw new TypeError('Companion Profile limit must be between 1 and 50');
  }
  const result = await db.prepare(`
    SELECT * FROM companion_profiles
    WHERE owner_id = ?
    ORDER BY profile_id ASC, version DESC
    LIMIT ?
  `).bind(ownerId, MAX_REVISIONS).all();
  const rows = result?.results ?? [];
  if (rows.length >= MAX_REVISIONS) throw new TypeError('Companion Profile history exceeds its bounded read limit');
  const latest = new Map();
  for (const row of rows) {
    const mapped = await mapProfileRow(row);
    if (!latest.has(mapped.profileId)) latest.set(mapped.profileId, mapped);
  }
  if (latest.size > limit) throw new TypeError('Companion Profile count exceeds its bounded list limit');
  const profiles = [
    Object.freeze({ profile: createDefaultAegisCompanionProfile(), version: null }),
    ...[...latest.values()].map(item => Object.freeze({ profile: item.profile, version: item.version })),
  ];
  const preferences = await db.prepare(`
    SELECT * FROM companion_profile_preferences WHERE owner_id = ? LIMIT 1
  `).bind(ownerId).first();
  let activeProfile = Object.freeze({ profile: createDefaultAegisCompanionProfile(), version: null });
  let activeProfileId = null;
  let activeProfileVersion = null;
  if (preferences?.active_profile_id !== null && preferences?.active_profile_id !== undefined) {
    const active = await readExactProfile(
      db, ownerId, preferences.active_profile_id, preferences.active_profile_version,
    );
    if (!active) throw new TypeError('Stored active Companion Profile selection is invalid');
    activeProfile = Object.freeze({ profile: active.profile, version: active.version });
    activeProfileId = active.profileId;
    activeProfileVersion = active.version;
  }
  return Object.freeze({
    profiles: Object.freeze(profiles),
    activeProfile,
    activeProfileId,
    activeProfileVersion,
  });
}

export async function updateCompanionProfile(db, ownerId, profileId, expectedVersion, patch, now = Date.now()) {
  requireAtomicDatabase(db);
  requireOwner(ownerId);
  requireProfileId(profileId);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    throw new TypeError('Invalid Companion Profile expected version');
  }
  validatePatch(patch);
  const timestamp = validClock(now);
  const current = await readLatestProfile(db, ownerId, profileId);
  if (!current) throw new CompanionProfileNotFoundError();
  if (current.version !== expectedVersion) throw new CompanionProfileConflictError();

  const merged = validateCompanionProfile({
    ...current.profile,
    ...patch,
    appearance: { ...current.profile.appearance, ...(patch.appearance || {}) },
    voice: { ...current.profile.voice, ...(patch.voice || {}) },
    interaction: { ...current.profile.interaction, ...(patch.interaction || {}) },
    accessibility: { ...current.profile.accessibility, ...(patch.accessibility || {}) },
  });
  const version = current.version + 1;
  const json = canonicalJson(merged);
  const digest = await sha256Hex(json);
  const id = 'companion-profile-' + crypto.randomUUID().toLowerCase().replaceAll('-', '');
  const preferences = await db.prepare(`
    SELECT * FROM companion_profile_preferences WHERE owner_id = ? LIMIT 1
  `).bind(ownerId).first();
  const statements = [
    db.prepare(`
      INSERT INTO companion_profiles (
        id, owner_id, profile_id, version, profile_digest, profile_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(id, ownerId, profileId, version, digest, json, timestamp),
  ];
  if (preferences?.active_profile_id === profileId) {
    statements.push(
      preferenceStatement(db, ownerId, profileId, version, timestamp),
      selectionEventStatement(db, ownerId, profileId, version, 'selected', digest, timestamp),
    );
  }
  let results;
  try {
    results = await db.batch(statements);
  } catch (error) {
    if (/UNIQUE constraint failed: companion_profiles\.owner_id, companion_profiles\.profile_id, companion_profiles\.version/i
      .test(String(error?.message || error))) {
      throw new CompanionProfileConflictError();
    }
    throw error;
  }
  if (results?.[0]?.meta?.changes !== 1 ||
      (statements.length === 3 && (results?.[1]?.meta?.changes !== 1 || results?.[2]?.meta?.changes !== 1))) {
    throw new Error('Companion Profile revision could not be persisted atomically');
  }
  return Object.freeze({
    ownerId, profile: merged, version, digest, createdAt: timestamp,
    activeProfileId: preferences?.active_profile_id === profileId ? profileId : preferences?.active_profile_id ?? null,
  });
}

export async function selectCompanionProfile(db, ownerId, profileId, version, now = Date.now()) {
  requireAtomicDatabase(db);
  requireOwner(ownerId);
  const timestamp = validClock(now);
  if (profileId === null && version === null) {
    const results = await db.batch([
      preferenceStatement(db, ownerId, null, null, timestamp),
      selectionEventStatement(db, ownerId, null, null, 'reset', null, timestamp),
    ]);
    if (results?.some(result => result?.meta?.changes !== 1)) {
      throw new Error('Official Companion Profile selection could not be saved atomically');
    }
    return Object.freeze({
      activeProfileId: null,
      activeProfile: Object.freeze({ profile: createDefaultAegisCompanionProfile(), version: null }),
    });
  }
  requireProfileId(profileId);
  if (!Number.isInteger(version) || version < 1) throw new TypeError('Invalid Companion Profile version');
  const profile = await readExactProfile(db, ownerId, profileId, version);
  if (!profile) throw new CompanionProfileNotFoundError();
  const results = await db.batch([
    preferenceStatement(db, ownerId, profileId, version, timestamp),
    selectionEventStatement(db, ownerId, profileId, version, 'selected', profile.digest, timestamp),
  ]);
  if (results?.some(result => result?.meta?.changes !== 1)) {
    throw new Error('Companion Profile selection could not be saved atomically');
  }
  return Object.freeze({
    activeProfileId: profileId,
    activeProfile: Object.freeze({ profile: profile.profile, version: profile.version }),
  });
}

export async function getActiveCompanionProfile(db, ownerId) {
  requireDatabase(db);
  requireOwner(ownerId);
  const preferences = await db.prepare(`
    SELECT * FROM companion_profile_preferences WHERE owner_id = ? LIMIT 1
  `).bind(ownerId).first();
  if (!preferences || (preferences.active_profile_id === null &&
      preferences.active_profile_version === null)) {
    return Object.freeze({ profile: createDefaultAegisCompanionProfile(), version: null });
  }
  if (typeof preferences.active_profile_id !== 'string' ||
      !Number.isInteger(preferences.active_profile_version) ||
      preferences.active_profile_version < 1) {
    throw new TypeError('Stored active Companion Profile selection is invalid');
  }
  const active = await readExactProfile(
    db, ownerId, preferences.active_profile_id, preferences.active_profile_version,
  );
  if (!active) throw new TypeError('Stored active Companion Profile selection is invalid');
  return Object.freeze({ profile: active.profile, version: active.version });
}

export async function exportCompanionProfiles(db, ownerId, now = Date.now()) {
  requireDatabase(db);
  requireOwner(ownerId);
  const exportedAt = validClock(now);
  const profileResult = await db.prepare(`
    SELECT * FROM companion_profiles
    WHERE owner_id = ?
    ORDER BY profile_id ASC, version ASC
    LIMIT ?
  `).bind(ownerId, MAX_REVISIONS).all();
  const profileRows = profileResult?.results ?? [];
  if (profileRows.length >= MAX_REVISIONS) {
    throw new TypeError('Companion Profile export exceeds its bounded revision limit');
  }
  const profileRevisions = [];
  const revisionDigests = new Map();
  for (const row of profileRows) {
    const mapped = await mapProfileRow(row);
    const key = mapped.profileId + '|' + mapped.version;
    revisionDigests.set(key, mapped.digest);
    profileRevisions.push(Object.freeze({
      profileId: mapped.profileId,
      version: mapped.version,
      profile: mapped.profile,
      digest: mapped.digest,
      createdAt: mapped.createdAt,
    }));
  }

  const eventResult = await db.prepare(`
    SELECT id, owner_id, profile_id, profile_version, event_type, profile_digest, occurred_at
    FROM companion_profile_events
    WHERE owner_id = ?
    ORDER BY occurred_at ASC, id ASC
    LIMIT ?
  `).bind(ownerId, 1000).all();
  const eventRows = eventResult?.results ?? [];
  if (eventRows.length >= 1000) throw new TypeError('Companion Profile export exceeds its bounded event limit');
  const events = eventRows.map(row => {
    if (row.owner_id !== ownerId || typeof row.id !== 'string' ||
        !['created', 'updated', 'selected', 'reset'].includes(row.event_type) ||
        typeof row.occurred_at !== 'string') {
      throw new TypeError('Stored Companion Profile event metadata is invalid');
    }
    if (row.event_type === 'reset') {
      if (row.profile_id !== null || row.profile_version !== null || row.profile_digest !== null) {
        throw new TypeError('Stored Companion Profile reset event is invalid');
      }
    } else {
      const key = row.profile_id + '|' + row.profile_version;
      if (typeof row.profile_id !== 'string' || !Number.isInteger(row.profile_version) ||
          revisionDigests.get(key) !== row.profile_digest) {
        throw new TypeError('Stored Companion Profile event does not match an exported immutable revision');
      }
    }
    return Object.freeze({
      id: row.id,
      profileId: row.profile_id,
      version: row.profile_version,
      eventType: row.event_type,
      digest: row.profile_digest,
      occurredAt: row.occurred_at,
    });
  });

  const purgeResult = await db.prepare(`
    SELECT id, purged_profiles_count, occurred_at
    FROM companion_profile_purge_events
    WHERE owner_id = ?
    ORDER BY occurred_at ASC, id ASC
    LIMIT ?
  `).bind(ownerId, 1000).all();
  const purgeRows = purgeResult?.results ?? [];
  if (purgeRows.length >= 1000) throw new TypeError('Companion Profile purge history exceeds its bounded export limit');
  const purgeHistory = purgeRows.map(row => {
    if (typeof row.id !== 'string' || !Number.isInteger(row.purged_profiles_count) ||
        row.purged_profiles_count < 0 || typeof row.occurred_at !== 'string') {
      throw new TypeError('Stored Companion Profile purge audit is invalid');
    }
    return Object.freeze({
      id: row.id,
      purgedProfiles: row.purged_profiles_count,
      occurredAt: row.occurred_at,
    });
  });
  const activeProfile = await getActiveCompanionProfile(db, ownerId);
  return Object.freeze({
    exportVersion: 1,
    exportedAt,
    profileRevisions: Object.freeze(profileRevisions),
    activeProfile: Object.freeze({ profile: activeProfile.profile, version: activeProfile.version }),
    events: Object.freeze(events),
    purgeHistory: Object.freeze(purgeHistory),
  });
}

export async function purgeCompanionProfiles(db, ownerId, confirmation, now = Date.now()) {
  requireDatabase(db);
  requireOwner(ownerId);
  if (confirmation !== 'DELETE MY COMPANION PROFILES') {
    throw new TypeError('Exact Companion Profile deletion confirmation is required');
  }
  if (typeof db.batch !== 'function') {
    throw new TypeError('Atomic D1 batch support is required for Companion Profile deletion');
  }
  const timestamp = validClock(now);
  const countRow = await db.prepare(`
    SELECT COUNT(*) AS total FROM companion_profiles WHERE owner_id = ?
  `).bind(ownerId).first();
  const purgedProfiles = countRow?.total;
  if (!Number.isInteger(purgedProfiles) || purgedProfiles < 0 || purgedProfiles >= MAX_REVISIONS) {
    throw new TypeError('Companion Profile purge count is invalid or exceeds its safety limit');
  }
  const nonce = crypto.randomUUID().toLowerCase().replaceAll('-', '');
  const expiresAt = new Date(now + 60_000).toISOString();
  const purgeId = 'companion-purge-' + crypto.randomUUID().toLowerCase().replaceAll('-', '');
  const statements = [
    db.prepare(`
      INSERT INTO companion_profile_purge_authorizations (owner_id, nonce, expires_at)
      VALUES (?, ?, ?)
    `).bind(ownerId, nonce, expiresAt),
    db.prepare('DELETE FROM companion_profile_preferences WHERE owner_id = ?').bind(ownerId),
    db.prepare('DELETE FROM companion_profile_events WHERE owner_id = ?').bind(ownerId),
    db.prepare('DELETE FROM companion_profiles WHERE owner_id = ?').bind(ownerId),
    db.prepare(`
      DELETE FROM companion_profile_purge_authorizations
      WHERE owner_id = ? AND nonce = ?
    `).bind(ownerId, nonce),
    db.prepare(`
      INSERT INTO companion_profile_purge_events (
        id, owner_id, purged_profiles_count, occurred_at
      ) VALUES (?, ?, ?, ?)
    `).bind(purgeId, ownerId, purgedProfiles, timestamp),
  ];
  await db.batch(statements);
  return Object.freeze({ purgedProfiles, activeProfileId: null, purgedAt: timestamp });
}
