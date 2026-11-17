import { randomUUID } from 'node:crypto';

const PLATFORMS = new Set(['web', 'chromeos', 'ios', 'ipados', 'android', 'windows', 'macos', 'linux', 'usb']);
const DEVICE_CLASSES = new Set(['desktop', 'laptop', 'tablet', 'phone', 'portable-usb', 'unknown']);
const OBSERVATION_STATUSES = new Set(['observed', 'inferred', 'user-reported', 'not-available', 'not-permitted', 'unsupported', 'stale']);
const CONFIDENCE = new Set(['none', 'low', 'medium', 'high']);
const SYSTEM_FIELDS = ['osFamily', 'osVersion', 'architecture', 'logicalProcessors', 'memoryBytes', 'storageBytes', 'storageFreeBytes', 'gpuAcceleration'];
const OBSERVATION_TEXT = new Set(['osFamily', 'osVersion', 'architecture']);
const OBSERVATION_NUMBERS = new Set(['logicalProcessors', 'memoryBytes', 'storageBytes', 'storageFreeBytes']);
const OBSERVATION_BOOLEANS = new Set(['gpuAcceleration']);
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z][a-z0-9-]{0,47}$/;

function record(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function exactKeys(value, keys, label) {
  if (!record(value) || Object.keys(value).length !== keys.length || Object.keys(value).some((key) => !keys.includes(key))) {
    throw new TypeError('Invalid ' + label + ' fields');
  }
}
function text(value, label, max = 160) {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim() || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new TypeError('Invalid ' + label);
  }
}
function timestamp(value, label) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
    throw new TypeError('Invalid ' + label);
  }
}
function observation(value, key) {
  exactKeys(value, ['status', 'value', 'source', 'observedAt', 'confidence'], 'device observation');
  if (!OBSERVATION_STATUSES.has(value.status) || !CONFIDENCE.has(value.confidence)) throw new TypeError('Invalid observation status or confidence');
  text(value.source, 'observation source', 120);
  timestamp(value.observedAt, 'observation timestamp');
  const unavailable = ['not-available', 'not-permitted', 'unsupported', 'stale'].includes(value.status);
  if (unavailable) {
    if (value.value !== null || value.confidence !== 'none') throw new TypeError('Unavailable observations must have null values and no confidence');
    return;
  }
  if (value.value === null || value.confidence === 'none') throw new TypeError('Available observations require a value and confidence');
  if (OBSERVATION_TEXT.has(key)) text(value.value, key, 100);
  else if (OBSERVATION_NUMBERS.has(key)) {
    if (!Number.isSafeInteger(value.value) || value.value < (key === 'logicalProcessors' ? 1 : 0)) throw new TypeError('Invalid numeric observation: ' + key);
    if (key === 'logicalProcessors' && value.value > 512) throw new TypeError('Logical processor count exceeds supported bound');
  } else if (OBSERVATION_BOOLEANS.has(key)) {
    if (typeof value.value !== 'boolean') throw new TypeError('Invalid boolean observation: ' + key);
  }
}
export function validateDeviceProfile(profile) {
  exactKeys(profile, ['schemaVersion', 'deviceId', 'platform', 'deviceClass', 'observedAt', 'observationMode', 'system', 'aegis', 'permissions'], 'device profile');
  if (profile.schemaVersion !== 1 || !ID_PATTERN.test(profile.deviceId) || !PLATFORMS.has(profile.platform) ||
      !DEVICE_CLASSES.has(profile.deviceClass) || profile.observationMode !== 'read-only') {
    throw new TypeError('Invalid device profile identity or observation mode');
  }
  timestamp(profile.observedAt, 'device profile timestamp');
  exactKeys(profile.system, SYSTEM_FIELDS, 'device system profile');
  for (const key of SYSTEM_FIELDS) observation(profile.system[key], key);
  const total = profile.system.storageBytes;
  const free = profile.system.storageFreeBytes;
  if (total.value !== null && free.value !== null && total.value > 0 && free.value > total.value) {
    throw new TypeError('Free storage cannot exceed total storage');
  }
  exactKeys(profile.aegis, ['version', 'activeModules', 'resourceBudget'], 'AEGIS runtime profile');
  text(profile.aegis.version, 'AEGIS version', 40);
  if (!Array.isArray(profile.aegis.activeModules) || profile.aegis.activeModules.length > 100 ||
      profile.aegis.activeModules.some((item) => typeof item !== 'string' || !SLUG.test(item)) ||
      new Set(profile.aegis.activeModules).size !== profile.aegis.activeModules.length) {
    throw new TypeError('Invalid active AEGIS module list');
  }
  exactKeys(profile.aegis.resourceBudget, ['maxBackgroundTasks', 'maxConcurrency'], 'AEGIS resource budget');
  for (const [key, value] of Object.entries(profile.aegis.resourceBudget)) {
    if (!Number.isSafeInteger(value) || value < 0 || value > 256) throw new TypeError('Invalid AEGIS resource budget: ' + key);
  }
  if (!Array.isArray(profile.permissions) || profile.permissions.length > 30 ||
      profile.permissions.some((item) => typeof item !== 'string' || !/^[a-z][a-z0-9-]{0,40}:[a-z][a-z0-9-]{0,50}$/.test(item)) ||
      new Set(profile.permissions).size !== profile.permissions.length) {
    throw new TypeError('Invalid device profile permissions');
  }
  return true;
}

export function createDeviceProfile({ platform, deviceClass, observedAt, system, aegis, permissions = [] }) {
  const profile = {
    schemaVersion: 1,
    deviceId: randomUUID(),
    platform,
    deviceClass,
    observedAt,
    observationMode: 'read-only',
    system,
    aegis,
    permissions,
  };
  validateDeviceProfile(profile);
  return profile;
}
