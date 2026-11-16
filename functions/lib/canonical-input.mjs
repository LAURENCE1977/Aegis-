const MAX_DEPTH = 16;
const MAX_COLLECTION_ITEMS = 256;
const MAX_STRING_CHARS = 64 * 1024;
const MAX_INPUT_BYTES = 64 * 1024;
const encoder = new TextEncoder();

function canonicalValue(value, seen, depth) {
  if (depth > MAX_DEPTH) throw new TypeError('Canonical input exceeds maximum depth');
  if (value === null) return 'null';
  if (typeof value === 'string') {
    if (value.length > MAX_STRING_CHARS) throw new TypeError('Canonical input string is too large');
    return JSON.stringify(value);
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Canonical input numbers must be finite');
    return Object.is(value, -0) ? '0' : JSON.stringify(value);
  }
  if (typeof value !== 'object') {
    throw new TypeError('Canonical input must contain only JSON values');
  }
  if (seen.has(value)) throw new TypeError('Canonical input contains a cycle');
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      if (value.length > MAX_COLLECTION_ITEMS) {
        throw new TypeError('Canonical input array is too large');
      }
      const keys = Reflect.ownKeys(value);
      if (keys.length !== value.length + 1 || keys.some(key =>
        key !== 'length' && (typeof key !== 'string' || !/^(0|[1-9][0-9]*)$/.test(key) ||
          Number(key) >= value.length))) {
        throw new TypeError('Canonical input array has unsupported properties');
      }
      const items = [];
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.hasOwn(value, index)) throw new TypeError('Canonical input array cannot be sparse');
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) {
          throw new TypeError('Canonical input array has unsupported properties');
        }
        items.push(canonicalValue(descriptor.value, seen, depth + 1));
      }
      return '[' + items.join(',') + ']';
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError('Canonical input objects must be plain objects');
    }
    const keys = Reflect.ownKeys(value);
    if (keys.length > MAX_COLLECTION_ITEMS || keys.some(key =>
      typeof key !== 'string' || key === '__proto__' || key === 'prototype' || key === 'constructor')) {
      throw new TypeError('Canonical input contains an unsupported key');
    }
    const entries = [];
    for (const key of keys.sort()) {
      if (key.length > 128) throw new TypeError('Canonical input key is too long');
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) {
        throw new TypeError('Canonical input contains an unsupported property');
      }
      entries.push(JSON.stringify(key) + ':' + canonicalValue(descriptor.value, seen, depth + 1));
    }
    return '{' + entries.join(',') + '}';
  } finally {
    seen.delete(value);
  }
}

export function canonicalizeInput(value) {
  const canonical = canonicalValue(value, new WeakSet(), 0);
  if (encoder.encode(canonical).byteLength > MAX_INPUT_BYTES) {
    throw new TypeError('Canonical input exceeds the 64 KiB size limit');
  }
  return canonical;
}

export async function digestCanonicalInput(value) {
  const bytes = encoder.encode(canonicalizeInput(value));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const hex = [...digest].map(byte => byte.toString(16).padStart(2, '0')).join('');
  return 'sha256:' + hex;
}

export const CANONICAL_INPUT_LIMITS = Object.freeze({
  maxDepth: MAX_DEPTH,
  maxCollectionItems: MAX_COLLECTION_ITEMS,
  maxInputBytes: MAX_INPUT_BYTES,
});
