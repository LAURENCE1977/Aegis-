import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCompanionProfile,
  listCompanionProfiles,
  updateCompanionProfile,
  selectCompanionProfile,
  getActiveCompanionProfile,
  exportCompanionProfiles,
  purgeCompanionProfiles,
} from '../functions/lib/companion-profile-store.mjs';

class CompanionD1 {
  constructor() {
    this.profiles = new Map();
    this.preferences = new Map();
    this.events = [];
    this.purgeAuthorizations = new Map();
    this.purgeEvents = [];
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
        if (sql.includes('INSERT INTO companion_profile_purge_authorizations')) {
          const [ownerId, nonce, expiresAt] = v;
          db.purgeAuthorizations.set(ownerId, { owner_id: ownerId, nonce, expires_at: expiresAt });
          return { meta: { changes: 1 } };
        }
        if (sql.includes('DELETE FROM companion_profile_preferences')) {
          db.preferences.delete(v[0]);
          return { meta: { changes: 1 } };
        }
        if (sql.includes('DELETE FROM companion_profile_events')) {
          if (!db.purgeAuthorizations.has(v[0])) throw new Error('Companion Profile purge authorization required');
          const before = db.events.length;
          db.events = db.events.filter(row => row.owner_id !== v[0]);
          return { meta: { changes: before - db.events.length } };
        }
        if (sql.includes('DELETE FROM companion_profiles')) {
          if (!db.purgeAuthorizations.has(v[0])) throw new Error('Companion Profile purge authorization required');
          const before = db.profiles.size;
          for (const [key, row] of db.profiles) if (row.owner_id === v[0]) db.profiles.delete(key);
          return { meta: { changes: before - db.profiles.size } };
        }
        if (sql.includes('DELETE FROM companion_profile_purge_authorizations')) {
          db.purgeAuthorizations.delete(v[0]);
          return { meta: { changes: 1 } };
        }
        if (sql.includes('INSERT INTO companion_profile_purge_events')) {
          const [id, ownerId, count, occurredAt] = v;
          db.purgeEvents.push({ id, owner_id: ownerId, purged_profiles_count: count, occurred_at: occurredAt });
          return { meta: { changes: 1 } };
        }
        return { meta: { changes: 0 } };
      },
      async first() {
        const v = this.values;
        if (sql.includes('COUNT(*) AS total FROM companion_profiles')) {
          return { total: [...db.profiles.values()].filter(row => row.owner_id === v[0]).length };
        }
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
            .sort((a, b) => a.profile_id.localeCompare(b.profile_id) ||
              (sql.includes('version ASC') ? a.version - b.version : b.version - a.version))
            .slice(0, v[1]) };
        }
        if (sql.includes('FROM companion_profile_events')) {
          return { results: db.events.filter(row => row.owner_id === v[0])
            .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
            .slice(0, v[1]) };
        }
        if (sql.includes('FROM companion_profile_purge_events')) {
          return { results: db.purgeEvents.filter(row => row.owner_id === v[0]).slice(0, v[1]) };
        }
        return { results: [] };
      },
    };
  }
  async batch(statements) {
    const results = [];
    for (const statement of statements) results.push(await statement.run());
    return results;
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

test('exports all immutable profile revisions, active selection and append-only history', async () => {
  const db = new CompanionD1();
  const created = await createCompanionProfile(db, 'owner', customInput(), baseTime);
  await updateCompanionProfile(db, 'owner', created.profile.id, 1, { displayName: 'Quiet Guide Plus' }, baseTime + 1000);
  const exported = await exportCompanionProfiles(db, 'owner', baseTime + 2000);
  assert.equal(exported.exportVersion, 1);
  assert.equal(exported.profileRevisions.length, 2);
  assert.deepEqual(exported.profileRevisions.map(item => item.version), [1, 2]);
  assert.equal(exported.activeProfile.profile.id, created.profile.id);
  assert.ok(exported.events.some(event => event.eventType === 'created'));
  assert.ok(exported.events.some(event => event.eventType === 'updated'));
  assert.ok(exported.events.some(event => event.eventType === 'selected'));
});

test('profile purge requires the exact owner confirmation phrase and leaves data intact on refusal', async () => {
  const db = new CompanionD1();
  await createCompanionProfile(db, 'owner', customInput(), baseTime);
  await assert.rejects(
    purgeCompanionProfiles(db, 'owner', 'DELETE SOMETHING', Date.now()),
    /confirmation/i,
  );
  assert.equal(db.profiles.size, 1);
  assert.equal(db.preferences.has('owner'), true);
});

test('confirmed profile purge deletes custom content and history but retains a minimal non-identifying purge event', async () => {
  const db = new CompanionD1();
  const created = await createCompanionProfile(db, 'owner', customInput(), baseTime);
  await updateCompanionProfile(db, 'owner', created.profile.id, 1, { displayName: 'Quiet Guide Plus' }, baseTime + 1000);
  const result = await purgeCompanionProfiles(db, 'owner', 'DELETE MY COMPANION PROFILES', Date.now());
  assert.equal(result.purgedProfiles, 2);
  assert.equal(db.profiles.size, 0);
  assert.equal(db.preferences.has('owner'), false);
  assert.equal(db.events.filter(row => row.owner_id === 'owner').length, 0);
  assert.equal(db.purgeAuthorizations.size, 0);
  assert.equal(db.purgeEvents.length, 1);
  assert.equal(db.purgeEvents[0].purged_profiles_count, 2);
  assert.equal(Object.hasOwn(db.purgeEvents[0], 'profile_id'), false);
  assert.equal(Object.hasOwn(db.purgeEvents[0], 'profile_digest'), false);
  const active = await getActiveCompanionProfile(db, 'owner');
  assert.equal(active.profile.id, 'aegis');
});

