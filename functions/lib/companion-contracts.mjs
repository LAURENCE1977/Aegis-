const PROFILE_KEYS = [
  'schemaVersion', 'id', 'kind', 'displayName', 'description',
  'appearance', 'voice', 'interaction', 'accessibility', 'memoryScope',
];
const APPEARANCE_KEYS = ['mode', 'visualPreset', 'assetPackId'];
const VOICE_KEYS = ['enabled', 'provider', 'voiceAssetId', 'locale', 'externalProviderOptIn'];
const INTERACTION_KEYS = ['warmth', 'humour', 'directness', 'initiative', 'verbosity'];
const ACCESSIBILITY_KEYS = ['captions', 'reducedMotion', 'highContrast', 'staticFallback'];
const PROFILE_ID = /^custom-[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/;
const ASSET_ID = /^(?:asset|voice):[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const OFFICIAL_DESCRIPTION = 'The official AEGIS companion identity.';

const DEFAULT_PROFILE = {
  schemaVersion: 1,
  id: 'aegis',
  kind: 'official',
  displayName: 'AEGIS',
  description: OFFICIAL_DESCRIPTION,
  appearance: { mode: 'adaptive', visualPreset: 'aegis', assetPackId: null },
  voice: {
    enabled: false,
    provider: 'none',
    voiceAssetId: null,
    locale: 'en-GB',
    externalProviderOptIn: false,
  },
  interaction: {
    warmth: 70,
    humour: 35,
    directness: 65,
    initiative: 50,
    verbosity: 'balanced',
  },
  accessibility: {
    captions: true,
    reducedMotion: false,
    highContrast: false,
    staticFallback: true,
  },
  memoryScope: 'user-governed',
};

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, keys) {
  return isRecord(value) && Object.keys(value).length === keys.length &&
    Object.keys(value).every((key) => keys.includes(key));
}

function boundedText(value, label, max, allowEmpty = false) {
  if (typeof value !== 'string' || value.length > max ||
      (!allowEmpty && !value.trim()) || value !== value.trim() ||
      /[\u0000-\u001f\u007f]/.test(value)) {
    throw new TypeError('Invalid companion ' + label + '.');
  }
  return value;
}

function validateBooleanRecord(value, keys, label) {
  if (!exactKeys(value, keys) || keys.some((key) => typeof value[key] !== 'boolean')) {
    throw new TypeError('Invalid companion ' + label + ' settings.');
  }
}

export function createDefaultAegisCompanionProfile() {
  return structuredClone(DEFAULT_PROFILE);
}

/**
 * Validates a provider-neutral presentation profile. Profiles can tune
 * appearance and interaction, but cannot define permissions, tools, policy,
 * identity ownership or privileged memory access.
 */
export function validateCompanionProfile(profile) {
  if (!exactKeys(profile, PROFILE_KEYS)) {
    throw new TypeError('Companion profile has unexpected or missing fields.');
  }
  if (profile.schemaVersion !== 1) throw new TypeError('Unsupported companion profile schema.');
  if (profile.kind === 'official') {
    if (profile.id !== 'aegis' || profile.displayName !== 'AEGIS' ||
        profile.description !== OFFICIAL_DESCRIPTION) {
      throw new TypeError('The official AEGIS identity is reserved and cannot be renamed or replaced.');
    }
  } else if (profile.kind === 'custom') {
    if (typeof profile.id !== 'string' || !PROFILE_ID.test(profile.id) || profile.id === 'custom-aegis') {
      throw new TypeError('Invalid custom companion identifier.');
    }
  } else {
    throw new TypeError('Invalid companion profile kind.');
  }

  const displayName = boundedText(profile.displayName, 'display name', 48);
  const description = boundedText(profile.description, 'description', 280, true);
  if (!exactKeys(profile.appearance, APPEARANCE_KEYS) ||
      !['adaptive', 'portrait', '2d', '3d', 'none'].includes(profile.appearance.mode) ||
      !['aegis', 'neutral', 'custom'].includes(profile.appearance.visualPreset) ||
      !(profile.appearance.assetPackId === null ||
        (typeof profile.appearance.assetPackId === 'string' && ASSET_ID.test(profile.appearance.assetPackId) &&
          profile.appearance.assetPackId.startsWith('asset:')))) {
    throw new TypeError('Invalid companion appearance settings.');
  }

  if (!exactKeys(profile.voice, VOICE_KEYS) ||
      typeof profile.voice.enabled !== 'boolean' ||
      !['none', 'local', 'self-hosted', 'external'].includes(profile.voice.provider) ||
      !(profile.voice.voiceAssetId === null ||
        (typeof profile.voice.voiceAssetId === 'string' && ASSET_ID.test(profile.voice.voiceAssetId) &&
          profile.voice.voiceAssetId.startsWith('voice:'))) ||
      typeof profile.voice.locale !== 'string' || !/^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(profile.voice.locale) ||
      typeof profile.voice.externalProviderOptIn !== 'boolean') {
    throw new TypeError('Invalid companion voice settings.');
  }
  if (profile.voice.enabled && profile.voice.provider === 'none') {
    throw new TypeError('Enabled companion voice requires an explicit provider.');
  }
  if (profile.voice.enabled && profile.voice.provider === 'external' &&
      profile.voice.externalProviderOptIn !== true) {
    throw new TypeError('External voice requires explicit external voice opt-in.');
  }
  if (profile.voice.provider !== 'external' && profile.voice.externalProviderOptIn) {
    throw new TypeError('External voice opt-in is only valid for an external provider.');
  }

  if (!exactKeys(profile.interaction, INTERACTION_KEYS) ||
      ['warmth', 'humour', 'directness', 'initiative'].some((key) =>
        !Number.isInteger(profile.interaction[key]) || profile.interaction[key] < 0 || profile.interaction[key] > 100) ||
      !['concise', 'balanced', 'detailed'].includes(profile.interaction.verbosity)) {
    throw new TypeError('Invalid companion interaction settings.');
  }
  validateBooleanRecord(profile.accessibility, ACCESSIBILITY_KEYS, 'accessibility');
  if (!['user-governed', 'session-only'].includes(profile.memoryScope)) {
    throw new TypeError('Invalid companion memory scope.');
  }

  return {
    schemaVersion: 1,
    id: profile.id,
    kind: profile.kind,
    displayName,
    description,
    appearance: { ...profile.appearance },
    voice: { ...profile.voice },
    interaction: { ...profile.interaction },
    accessibility: { ...profile.accessibility },
    memoryScope: profile.memoryScope,
  };
}

const STATES = new Set([
  'idle', 'listening', 'thinking', 'speaking', 'interrupted',
  'shared_workspace', 'paused', 'disconnected',
]);

const TRANSITIONS = {
  idle: {
    LISTENING_STARTED: 'listening',
    THINKING_STARTED: 'thinking',
    WORKSPACE_OPENED: 'shared_workspace',
    PAUSE: 'paused',
    DISCONNECTED: 'disconnected',
  },
  listening: {
    LISTENING_STOPPED: 'thinking',
    PAUSE: 'paused',
    DISCONNECTED: 'disconnected',
  },
  thinking: {
    SPEAKING_STARTED: 'speaking',
    TURN_FINISHED: 'idle',
    PAUSE: 'paused',
    DISCONNECTED: 'disconnected',
  },
  speaking: {
    INTERRUPT: 'interrupted',
    TURN_FINISHED: 'idle',
    PAUSE: 'paused',
    DISCONNECTED: 'disconnected',
  },
  interrupted: {
    LISTENING_STARTED: 'listening',
    THINKING_STARTED: 'thinking',
    TURN_FINISHED: 'idle',
    PAUSE: 'paused',
    DISCONNECTED: 'disconnected',
  },
  shared_workspace: {
    WORKSPACE_CLOSED: 'idle',
    PAUSE: 'paused',
    DISCONNECTED: 'disconnected',
  },
  paused: {
    RESUME: 'idle',
    DISCONNECTED: 'disconnected',
  },
  disconnected: {
    RECONNECTED: 'idle',
  },
};

const EVENTS = new Set(Object.values(TRANSITIONS).flatMap((transitions) => Object.keys(transitions)));

function denied(state, reasonCode) {
  return { state, allowed: false, reasonCode };
}

/**
 * Pure companion presence state transition. It never starts device capture:
 * listening requires both a user action and an active Sentinel-approved grant.
 */
export function transitionCompanionState(state, event, context = {}) {
  if (!STATES.has(state)) return denied(state, 'INVALID_STATE');
  if (!EVENTS.has(event)) return denied(state, 'UNKNOWN_EVENT');
  if (!isRecord(context)) return denied(state, 'INVALID_CONTEXT');
  const next = TRANSITIONS[state][event];
  if (!next) return denied(state, 'INVALID_TRANSITION');
  if (event === 'LISTENING_STARTED') {
    if (context.userInitiated !== true) return denied(state, 'USER_ACTION_REQUIRED');
    if (context.captureGranted !== true) return denied(state, 'CAPTURE_CONSENT_REQUIRED');
  }
  return { state: next, allowed: true, reasonCode: 'STATE_CHANGED' };
}
