import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken } from '../functions/lib/auth.mjs';
import {
  onRequestGet as listProfiles,
  onRequestPost as createProfile,
} from '../functions/api/companion/profiles.js';
import {
  onRequestPatch as updateProfile,
} from '../functions/api/companion/profiles/[id].js';
import {
  onRequestPost as selectProfile,
} from '../functions/api/companion/profile-selection.js';
import {
  onRequestGet as exportProfiles,
} from '../functions/api/companion/profiles/export.js';
import {
  onRequestPost as purgeProfiles,
} from '../functions/api/companion/profiles/purge.js';

const secret = 'companion-profile-api-test-session-secret-long-enough';
const envBase = { AEGIS_PASSWORD: 'test-password-long-enough', AEGIS_SESSION_SECRET: secret };
const dummyDb = { prepare() { return {}; } };

async function request(path, { method = 'GET', body, authenticated = true, origin = 'https://aegis.example' } = {}) {
  const headers = { Origin: origin, 'Content-Type': 'application/json' };
  if (authenticated) headers.Cookie = '__Host-aegis_session=' + await createSessionToken(secret);
  return new Request('https://aegis.example' + path, {
    method, headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

test('Companion Profile APIs require an authenticated owner before touching storage', async () => {
  const response = await listProfiles({
    request: await request('/api/companion/profiles', { authenticated: false }),
    env: { ...envBase, AEGIS_DB: { prepare() { throw new Error('must not access D1'); } } },
  });
  assert.equal(response.status, 401);
});

test('Companion Profile collection fails closed when D1 is not configured', async () => {
  const response = await listProfiles({
    request: await request('/api/companion/profiles'),
    env: envBase,
  });
  assert.equal(response.status, 503);
});

test('Companion Profile creation rejects cross-origin requests and authority fields', async () => {
  const crossOrigin = await createProfile({
    request: await request('/api/companion/profiles', {
      method: 'POST', origin: 'https://attacker.example', body: { displayName: 'Blocked' },
    }),
    env: { ...envBase, AEGIS_DB: dummyDb },
  });
  assert.equal(crossOrigin.status, 403);

  const injected = await createProfile({
    request: await request('/api/companion/profiles', {
      method: 'POST', body: { displayName: 'Bad Profile', permissions: ['admin'] },
    }),
    env: { ...envBase, AEGIS_DB: dummyDb },
  });
  assert.equal(injected.status, 400);
});

test('Companion Profile update requires expected version and rejects unknown fields', async () => {
  const missingVersion = await updateProfile({
    request: await request('/api/companion/profiles/custom-test', {
      method: 'PATCH', body: { displayName: 'No concurrency control' },
    }),
    env: { ...envBase, AEGIS_DB: dummyDb },
    params: { id: 'custom-test' },
  });
  assert.equal(missingVersion.status, 400);

  const injected = await updateProfile({
    request: await request('/api/companion/profiles/custom-test', {
      method: 'PATCH', body: { expectedVersion: 1, sentinelPolicy: 'admin' },
    }),
    env: { ...envBase, AEGIS_DB: dummyDb },
    params: { id: 'custom-test' },
  });
  assert.equal(injected.status, 400);
});

test('Companion Profile selection requires exact fields and rejects malformed identifiers', async () => {
  const malformed = await selectProfile({
    request: await request('/api/companion/profile-selection', {
      method: 'POST', body: { profileId: 'custom-', version: 1 },
    }),
    env: { ...envBase, AEGIS_DB: dummyDb },
  });
  assert.equal(malformed.status, 400);

  const unknown = await selectProfile({
    request: await request('/api/companion/profile-selection', {
      method: 'POST', body: { profileId: null, version: null, ownerId: 'other' },
    }),
    env: { ...envBase, AEGIS_DB: dummyDb },
  });
  assert.equal(unknown.status, 400);
});

test('Companion Profile export requires owner authentication and configured storage', async () => {
  const denied = await exportProfiles({
    request: await request('/api/companion/profiles/export', { authenticated: false }),
    env: envBase,
  });
  assert.equal(denied.status, 401);

  const unavailable = await exportProfiles({
    request: await request('/api/companion/profiles/export'),
    env: envBase,
  });
  assert.equal(unavailable.status, 503);
});

test('Companion Profile purge requires same-origin owner confirmation and atomic storage', async () => {
  const crossOrigin = await purgeProfiles({
    request: await request('/api/companion/profiles/purge', {
      method: 'POST', origin: 'https://attacker.example',
      body: { confirmation: 'DELETE MY COMPANION PROFILES' },
    }),
    env: { ...envBase, AEGIS_DB: { ...dummyDb, batch() {} } },
  });
  assert.equal(crossOrigin.status, 403);

  const invalid = await purgeProfiles({
    request: await request('/api/companion/profiles/purge', {
      method: 'POST', body: { confirmation: 'DELETE SOMETHING' },
    }),
    env: { ...envBase, AEGIS_DB: { ...dummyDb, batch() {} } },
  });
  assert.equal(invalid.status, 400);

  const unavailable = await purgeProfiles({
    request: await request('/api/companion/profiles/purge', {
      method: 'POST', body: { confirmation: 'DELETE MY COMPANION PROFILES' },
    }),
    env: { ...envBase, AEGIS_DB: dummyDb },
  });
  assert.equal(unavailable.status, 503);
});
