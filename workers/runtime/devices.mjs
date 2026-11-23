export const DEVICE_CAPABILITIES = Object.freeze([
  'device.status.read',
  'aegis.jobs.observe',
]);

const DEVICE_PLATFORMS = Object.freeze(['android', 'chromebook']);
const TOKEN_PREFIX = 'aegis_dev_';
const TOKEN_PATTERN = /^aegis_dev_[A-Za-z0-9_-]{43}$/;

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function validateDeviceRegistration(input) {
  if (!isPlainObject(input)) throw new TypeError('Device registration must be an object.');
  if (Object.keys(input).some((key) => !['platform', 'displayName', 'capabilities'].includes(key))) {
    throw new TypeError('Unexpected device registration fields.');
  }
  if (!DEVICE_PLATFORMS.includes(input.platform)) {
    throw new TypeError('Unsupported device platform.');
  }
  if (typeof input.displayName !== 'string') throw new TypeError('Device name is required.');
  const displayName = input.displayName.trim();
  if (!displayName || displayName.length > 48 || /[\u0000-\u001f\u007f]/.test(displayName)) {
    throw new TypeError('Device name must be 1–48 safe characters.');
  }
  if (!Array.isArray(input.capabilities) || input.capabilities.length < 1 ||
      input.capabilities.length > DEVICE_CAPABILITIES.length) {
    throw new TypeError('Device capabilities must be a non-empty bounded list.');
  }
  if (input.capabilities.some((capability) => typeof capability !== 'string' ||
      !DEVICE_CAPABILITIES.includes(capability))) {
    throw new TypeError('Device capability is not approved.');
  }
  if (new Set(input.capabilities).size !== input.capabilities.length) {
    throw new TypeError('Duplicate device capabilities are not allowed.');
  }
  return Object.freeze({
    platform: input.platform,
    displayName,
    capabilities: Object.freeze([...input.capabilities]),
  });
}

export function validateDeviceHeartbeat(input) {
  if (!isPlainObject(input)) throw new TypeError('Device heartbeat must be an object.');
  if (Object.keys(input).some((key) => !['appVersion', 'connectivity'].includes(key))) {
    throw new TypeError('Unexpected device heartbeat fields.');
  }
  if (typeof input.appVersion !== 'string' ||
      !/^[A-Za-z0-9][A-Za-z0-9.+_-]{0,31}$/.test(input.appVersion)) {
    throw new TypeError('A valid app version is required.');
  }
  if (!['online', 'limited', 'offline'].includes(input.connectivity)) {
    throw new TypeError('Invalid device connectivity state.');
  }
  return Object.freeze({
    appVersion: input.appVersion,
    connectivity: input.connectivity,
  });
}

export function createDeviceToken(cryptoProvider = globalThis.crypto) {
  if (!cryptoProvider || typeof cryptoProvider.getRandomValues !== 'function') {
    throw new TypeError('Secure random number generation is unavailable.');
  }
  const bytes = cryptoProvider.getRandomValues(new Uint8Array(32));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const encoded = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  return TOKEN_PREFIX + encoded;
}

export async function hashDeviceToken(token, cryptoProvider = globalThis.crypto) {
  if (typeof token !== 'string' || !TOKEN_PATTERN.test(token)) {
    throw new TypeError('Invalid device token.');
  }
  if (!cryptoProvider?.subtle || typeof cryptoProvider.subtle.digest !== 'function') {
    throw new TypeError('Secure token hashing is unavailable.');
  }
  const digest = await cryptoProvider.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function createPairingCode(cryptoProvider = globalThis.crypto) {
  if (!cryptoProvider || typeof cryptoProvider.getRandomValues !== 'function') {
    throw new TypeError('Secure random number generation is unavailable.');
  }
  const bytes = cryptoProvider.getRandomValues(new Uint8Array(32));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const encoded = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  return 'aegis_pair_' + encoded;
}

export async function hashPairingCode(code, cryptoProvider = globalThis.crypto) {
  if (typeof code !== 'string' || !/^aegis_pair_[A-Za-z0-9_-]{43}$/.test(code)) {
    throw new TypeError('Invalid pairing code.');
  }
  if (!cryptoProvider?.subtle || typeof cryptoProvider.subtle.digest !== 'function') {
    throw new TypeError('Secure token hashing is unavailable.');
  }
  const digest = await cryptoProvider.subtle.digest('SHA-256', new TextEncoder().encode(code));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function validatePairingRedemption(input) {
  if (!isPlainObject(input)) throw new TypeError('Pairing redemption must be an object.');
  if (Object.keys(input).some((key) => key !== 'code')) {
    throw new TypeError('Unexpected pairing redemption fields.');
  }
  if (typeof input.code !== 'string' || !/^aegis_pair_[A-Za-z0-9_-]{43}$/.test(input.code)) {
    throw new TypeError('Invalid pairing code.');
  }
  return Object.freeze({ code: input.code });
}

export function parseDeviceAuthorization(header) {
  if (typeof header !== 'string') return null;
  const match = /^Device\s+(aegis_dev_[A-Za-z0-9_-]{43})$/i.exec(header.trim());
  return match ? match[1] : null;
}

export function readDeviceToken(request) {
  const headerToken = parseDeviceAuthorization(request?.headers?.get?.('Authorization'));
  if (headerToken) return headerToken;
  const cookieHeader = request?.headers?.get?.('Cookie') || '';
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0 || part.slice(0, separator).trim() !== '__Host-aegis_device') continue;
    const token = part.slice(separator + 1).trim();
    return TOKEN_PATTERN.test(token) ? token : null;
  }
  return null;
}
