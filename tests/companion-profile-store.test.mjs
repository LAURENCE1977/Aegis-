import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCompanionProfile,
  listCompanionProfiles,
  updateCompanionProfile,
  selectCompanionProfile,
  getActiveCompanionProfile,
} from '../functions/lib/companion-profile-store.mjs';

class CompanionD1 {
  constructor() {
    this.profiles = new Map();
    this.preferences = new Map();
    this.events = [];
  }
  prepare(sql) {
    const db = this;
    return {
      values: [],
      bind(...values) { this.values = values; return this; },
      async run() {
        const v = this.values;
        if (sql.includes('INSERT INTO companion_profiles')) {
          const [id, ownerId, profileId, version, digest, json, createdAt] = v;
          const key = [ownerId, profileId, version].join('|');
          if (db.profiles.has(key)) return { meta: { changes: 0 } };
          db.profiles.set(key, {
            id, owner_id: ownerId, profile_id: profileId, version,
            profile_digest: digest, profile_json: json, created_at: createdAt,
          });
          db.events.push({
            id: 'profile:' + id, owner_id: ownerId, profile_id: profileId,
            profile_version: version, event_type: version === 1 ? 'created' : 'updated',
            profile_digest: digest, occurred_at: createdAt,
          });
          return { meta: { changes: 1 } };
        }
        if (sql.includes('INSERT INTO companion_profile_preferences')) {
          const [ownerId, profileId, version, updatedAt] = v;
          if (profileId !== null && !db.profiles.has([ownerId, profileId, version].join('|'))) {
            throw new Error('foreign key constraint failed');
          }
          db.preferences.set(ownerId, {
            owner_id: ownerId, active_profile_id: profileId,
            active_profile_version: version, updated_at: updatedAt,
          });
          return { meta: { changes: 1 } };
        }
        if (sql.includes('INSERT INTO companion_profile_events')) {
          const [id, ownerId, profileId, version, eventType, digest, occurredAt] = v;
          db.events.push({
            id, owner_id: ownerId, profile_id: profileId,
            profile_version: version, event_type: eventType,
            profile_digest: digest, occurred_at: occurredAt,
          });
          return { meta: { changes: 1 } };
        }
        return { meta: { changes: 0 } };
      },
      async first() {
        const v = this.values;
        if (sql.includes('FROM companion_profiles')) {
          const [ownerId, profileId, version] = v;
          if (version !== undefined) {
            return db.profiles.get([ownerId, profileId, version].join('|')) ?? null;
          }
          const rows = [...db.profiles.values()].filter(row =>
            row.owner_id === ownerId && row.profile_id === profileId,
          ).sort((a, b) => b.version - a.version);
          return rows[0] ?? null;
        }
        if (sql.includes('FROM companion_profile_preferences')) {
          return db.preferences.get(v[0]) ?? null;
        }
        return null;
      },
      async all() {
        const v = this.values;
        if (sql.includes('FROM companion_profiles')) {
          return { results: [...db.profiles.values()]
            .filter(row => row.owner_id === v[0])
            .sort((a, b) => a.profile_id.localeCompare(b.profile_id) || b.version - a.version)
            .slice(0, v[1]) };
        }
        if (sql.includes('FROM companion_profile_events')) {
          return { results: db.events.filter(row => row.owner_id === v[0])
            .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
            .slice(0, v[1]) };
        }
        return { results: [] };
      },
    };
  }
}

const baseTime = Date.parse('2026-11-17T12:00:00.000Z');
const customInput = () => ({
  displayName: 'Quiet Guide',
  description: 'A calm companion for thoughtful conversations.',
});

test('creates an owner-scoped custom profile as an immutable revision and selects it', async () => {
  const db = new CompanionD1();
  const created = await createCompanionProfile(db, 'owner', customInput(), baseTime);
  assert.match(created.profile.id, /^custom-/);
  assert.equal(created.version, 1);
  assert.equal(created.profile.kind, 'custom');
  assert.equal(created.profile.voice.enabled, false);
  assert.equal(created.activeProfileId, created.profile.id);
  assert.equal(db.profiles.size, 1);
  assert.equal(db.events[0].event_type, 'created');
});

test('lists the official profile and owner custom profiles with an explicit active selection', async () => {
  const db = new CompanionD1();
  await createCompanionProfile(db, 'owner', customInput(), baseTime);
  const result = await listCompanionProfiles(db, 'owner');
  assert.equal(result.profiles[0].profile.id, 'aegis');
  assert.equal(result.profiles[0].profile.kind, 'official');
  assert.equal(result.profiles.length, 2);
  assert.equal(result.activeProfile.profile.kind, 'custom');
});

test('returns the verified active profile or the official AEGIS default', async () => {
  const db = new CompanionD1();
  const official = await getActiveCompanionProfile(db, 'owner');
  assert.equal(official.profile.id, 'aegis');
  assert.equal(official.version, null);
  const created = await createCompanionProfile(db, 'owner', customInput(), baseTime);
  const active = await getActiveCompanionProfile(db, 'owner');
  assert.equal(active.profile.id, created.profile.id);
  assert.equal(active.version, 1);
});

test('updates create a new immutable profile revision and reject stale writes', async () => {
  const db = new CompanionD1();
  const created = await createCompanionProfile(db, 'owner', customInput(), baseTime);
  const updated = await updateCompanionProfile(
    db, 'owner', created.profile.id, 1, { displayName: 'Quiet Guide Plus' }, baseTime + 1000,
  );
  assert.equal(updated.version, 2);
  assert.equal(updated.profile.displayName, 'Quiet Guide Plus');
  assert.equal(db.profiles.size, 2);
  assert.equal(db.profiles.get(['owner', created.profile.id, 1].join('|')).profile_json.includes('Quiet Guide'), true);
  await assert.rejects(
    updateCompanionProfile(db, 'owner', created.profile.id, 1, { displayName: 'Stale edit' }, baseTime + 2000),
    error => error?.status === 409,
  );
});

test('selection is owner-scoped and can safely return to the official AEGIS profile', async () => {
  const db = new CompanionD1();
  const created = await createCompanionProfile(db, 'owner', customInput(), baseTime);
  await assert.rejects(
    selectCompanionProfile(db, 'another-owner', created.profile.id, 1, baseTime + 1000),
    error => error?.status === 404,
  );
  const official = await selectCompanionProfile(db, 'owner', null, null, baseTime + 2000);
  assert.equal(official.activeProfileId, null);
  assert.equal(official.activeProfile.profile.id, 'aegis');
});

test('rejects profile authority fields, official identity replacement and implicit external voice', async () => {
  const db = new CompanionD1();
  await assert.rejects(
    createCompanionProfile(db, 'owner', { ...customInput(), permissions: ['admin'] }, baseTime),
    /fields/i,
  );
  await assert.rejects(
    createCompanionProfile(db, 'owner', {
      ...customInput(),
      voice: { enabled: true, provider: 'external', voiceAssetId: null, locale: 'en-GB', externalProviderOptIn: false },
    }, baseTime),
    /opt-in/i,
  );
  assert.equal(db.profiles.size, 0);
});

test('detects corrupted stored profile JSON or digest during listing', async () => {
  const db = new CompanionD1();
  const created = await createCompanionProfile(db, 'owner', customInput(), baseTime);
  const key = ['owner', created.profile.id, 1].join('|');
  const row = db.profiles.get(key);
  db.profiles.set(key, { ...row, profile_json: JSON.stringify({ ...created.profile, displayName: 'Tampered' }) });
  await assert.rejects(listCompanionProfiles(db, 'owner'), /digest/i);
});
