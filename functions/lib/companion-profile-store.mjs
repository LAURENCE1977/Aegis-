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
async function writePreference(db, ownerId, profileId, version, timestamp) {
  await db.prepare(`
    INSERT INTO companion_profile_preferences (
      owner_id, active_profile_id, active_profile_version, updated_at
    ) VALUES (?, ?, ?, ?)
    ON CONFLICT(owner_id) DO UPDATE SET
      active_profile_id = excluded.active_profile_id,
      active_profile_version = excluded.active_profile_version,
      updated_at = excluded.updated_at
  `).bind(ownerId, profileId, version, timestamp).run();
}
async function appendSelectionEvent(db, ownerId, profileId, version, eventType, digest, timestamp) {
  await db.prepare(`
    INSERT INTO companion_profile_events (
      id, owner_id, profile_id, profile_version, event_type, profile_digest, occurred_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind('selection-' + crypto.randomUUID().toLowerCase().replaceAll('-', ''),
    ownerId, profileId, version, eventType, digest, timestamp).run();
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
  requireDatabase(db);
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
  const write = await db.prepare(`
    INSERT INTO companion_profiles (
      id, owner_id, profile_id, version, profile_digest, profile_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(id, ownerId, profile.id, version, digest, json, timestamp).run();
  if (write?.meta?.changes !== 1) throw new Error('Companion Profile could not be persisted');
  await writePreference(db, ownerId, profile.id, version, timestamp);
  await appendSelectionEvent(db, ownerId, profile.id, version, 'selected', digest, timestamp);
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
  const profiles = [
    createDefaultAegisCompanionProfile(),
    ...[...latest.values()].map(item => item.profile),
  ];
  const preferences = await db.prepare(`
    SELECT * FROM companion_profile_preferences WHERE owner_id = ? LIMIT 1
  `).bind(ownerId).first();
  let activeProfile = createDefaultAegisCompanionProfile();
  let activeProfileId = null;
  let activeProfileVersion = null;
  if (preferences?.active_profile_id !== null && preferences?.active_profile_id !== undefined) {
    const active = await readExactProfile(
      db, ownerId, preferences.active_profile_id, preferences.active_profile_version,
    );
    if (!active) throw new TypeError('Stored active Companion Profile selection is invalid');
    activeProfile = active.profile;
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
  requireDatabase(db);
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
  const write = await db.prepare(`
    INSERT INTO companion_profiles (
      id, owner_id, profile_id, version, profile_digest, profile_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(id, ownerId, profileId, version, digest, json, timestamp).run();
  if (write?.meta?.changes !== 1) throw new Error('Companion Profile revision could not be persisted');

  const preferences = await db.prepare(`
    SELECT * FROM companion_profile_preferences WHERE owner_id = ? LIMIT 1
  `).bind(ownerId).first();
  if (preferences?.active_profile_id === profileId) {
    await writePreference(db, ownerId, profileId, version, timestamp);
    await appendSelectionEvent(db, ownerId, profileId, version, 'selected', digest, timestamp);
  }
  return Object.freeze({
    ownerId, profile: merged, version, digest, createdAt: timestamp,
    activeProfileId: preferences?.active_profile_id === profileId ? profileId : preferences?.active_profile_id ?? null,
  });
}

export async function selectCompanionProfile(db, ownerId, profileId, version, now = Date.now()) {
  requireDatabase(db);
  requireOwner(ownerId);
  const timestamp = validClock(now);
  if (profileId === null && version === null) {
    await writePreference(db, ownerId, null, null, timestamp);
    await appendSelectionEvent(db, ownerId, null, null, 'reset', null, timestamp);
    return Object.freeze({
      activeProfileId: null,
      activeProfile: createDefaultAegisCompanionProfile(),
    });
  }
  requireProfileId(profileId);
  if (!Number.isInteger(version) || version < 1) throw new TypeError('Invalid Companion Profile version');
  const profile = await readExactProfile(db, ownerId, profileId, version);
  if (!profile) throw new CompanionProfileNotFoundError();
  await writePreference(db, ownerId, profileId, version, timestamp);
  await appendSelectionEvent(db, ownerId, profileId, version, 'selected', profile.digest, timestamp);
  return Object.freeze({
    activeProfileId: profileId,
    activeProfile: profile.profile,
  });
}
