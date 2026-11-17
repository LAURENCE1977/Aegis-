import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDefaultAegisCompanionProfile,
  validateCompanionProfile,
  transitionCompanionState,
} from '../functions/lib/companion-contracts.mjs';

const customProfile = () => ({
  schemaVersion: 1,
  id: 'custom-quiet-guide',
  kind: 'custom',
  displayName: 'Quiet Guide',
  description: 'A calm companion for thoughtful conversations.',
  appearance: { mode: 'adaptive', visualPreset: 'neutral', assetPackId: null },
  voice: {
    enabled: false, provider: 'none', voiceAssetId: null,
    locale: 'en-GB', externalProviderOptIn: false,
  },
  interaction: {
    warmth: 75, humour: 20, directness: 55, initiative: 35, verbosity: 'balanced',
  },
  accessibility: {
    captions: true, reducedMotion: false, highContrast: false, staticFallback: true,
  },
  memoryScope: 'user-governed',
});

test('official AEGIS companion profile has a stable identity and safe free-first defaults', () => {
  const profile = createDefaultAegisCompanionProfile();
  assert.equal(profile.id, 'aegis');
  assert.equal(profile.kind, 'official');
  assert.equal(profile.displayName, 'Agent AEGIS');
  assert.equal(profile.description, 'Your Personal Guardian — a human-centred artificial intelligence companion.');
  assert.equal(profile.voice.enabled, false);
  assert.equal(profile.voice.provider, 'none');
  assert.equal(profile.memoryScope, 'user-governed');
  assert.equal(validateCompanionProfile(profile).id, 'aegis');
});

test('custom companion profiles can customise presentation and interaction without creating a new security identity', () => {
  const profile = validateCompanionProfile(customProfile());
  assert.equal(profile.id, 'custom-quiet-guide');
  assert.equal(profile.displayName, 'Quiet Guide');
  assert.equal(profile.interaction.warmth, 75);
  assert.equal(profile.appearance.visualPreset, 'neutral');
});

test('companion profiles reject permission, policy, tool and private-memory authority fields', () => {
  for (const field of ['permissions', 'toolAccess', 'systemPrompt', 'sentinelPolicy', 'memoryAccess', 'ownerId']) {
    const profile = customProfile();
    profile[field] = field === 'permissions' ? ['admin'] : 'untrusted';
    assert.throws(() => validateCompanionProfile(profile), /unexpected or missing fields/);
  }
});

test('custom profiles cannot claim the official AEGIS identity', () => {
  const profile = customProfile();
  profile.id = 'aegis';
  assert.throws(() => validateCompanionProfile(profile), /custom companion identifier/);
});

test('external voice providers require explicit opt-in and cannot be enabled as an implicit default', () => {
  const profile = customProfile();
  profile.voice = {
    enabled: true, provider: 'external', voiceAssetId: 'voice:sample',
    locale: 'en-GB', externalProviderOptIn: false,
  };
  assert.throws(() => validateCompanionProfile(profile), /explicit external voice opt-in/);
  profile.voice.externalProviderOptIn = true;
  assert.equal(validateCompanionProfile(profile).voice.enabled, true);
});

test('companion presence cannot enter listening without a user-started, consented capture session', () => {
  assert.deepEqual(
    transitionCompanionState('idle', 'LISTENING_STARTED', { captureGranted: true, userInitiated: false }),
    { state: 'idle', allowed: false, reasonCode: 'USER_ACTION_REQUIRED' },
  );
  assert.deepEqual(
    transitionCompanionState('idle', 'LISTENING_STARTED', { captureGranted: false, userInitiated: true }),
    { state: 'idle', allowed: false, reasonCode: 'CAPTURE_CONSENT_REQUIRED' },
  );
  assert.deepEqual(
    transitionCompanionState('idle', 'LISTENING_STARTED', { captureGranted: true, userInitiated: true }),
    { state: 'listening', allowed: true, reasonCode: 'STATE_CHANGED' },
  );
});

test('companion state follows explicit turn events and supports interruption and workspace mode', () => {
  assert.equal(transitionCompanionState('listening', 'LISTENING_STOPPED').state, 'thinking');
  assert.equal(transitionCompanionState('thinking', 'SPEAKING_STARTED').state, 'speaking');
  assert.equal(transitionCompanionState('speaking', 'INTERRUPT').state, 'interrupted');
  assert.equal(transitionCompanionState('idle', 'WORKSPACE_OPENED').state, 'shared_workspace');
  assert.equal(transitionCompanionState('shared_workspace', 'WORKSPACE_CLOSED').state, 'idle');
});

test('pause and disconnect are fail-closed and cannot be bypassed by output events', () => {
  assert.equal(transitionCompanionState('speaking', 'PAUSE').state, 'paused');
  assert.deepEqual(
    transitionCompanionState('paused', 'SPEAKING_STARTED'),
    { state: 'paused', allowed: false, reasonCode: 'INVALID_TRANSITION' },
  );
  assert.equal(transitionCompanionState('listening', 'DISCONNECTED').state, 'disconnected');
  assert.deepEqual(
    transitionCompanionState('disconnected', 'LISTENING_STARTED', { captureGranted: true, userInitiated: true }),
    { state: 'disconnected', allowed: false, reasonCode: 'INVALID_TRANSITION' },
  );
  assert.equal(transitionCompanionState('disconnected', 'RECONNECTED').state, 'idle');
});

test('unknown companion states and events fail closed', () => {
  assert.deepEqual(
    transitionCompanionState('unknown', 'SPEAKING_STARTED'),
    { state: 'unknown', allowed: false, reasonCode: 'INVALID_STATE' },
  );
  assert.deepEqual(
    transitionCompanionState('idle', 'UNRECOGNISED_EVENT'),
    { state: 'idle', allowed: false, reasonCode: 'UNKNOWN_EVENT' },
  );
});

test('companion profiles are returned as isolated values and cannot mutate shared defaults', () => {
  const first = createDefaultAegisCompanionProfile();
  first.interaction.warmth = 0;
  const second = createDefaultAegisCompanionProfile();
  assert.equal(second.interaction.warmth, 70);

  const source = customProfile();
  const validated = validateCompanionProfile(source);
  validated.interaction.warmth = 1;
  assert.equal(source.interaction.warmth, 75);
});

test('companion presence transitions reject malformed context without throwing', () => {
  assert.deepEqual(
    transitionCompanionState('idle', 'LISTENING_STARTED', null),
    { state: 'idle', allowed: false, reasonCode: 'INVALID_CONTEXT' },
  );
});
