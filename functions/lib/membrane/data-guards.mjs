export class MembraneError extends Error {
  constructor(message, { code = 'INVALID_INPUT', status = 400, cause, allow } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'MembraneError';
    this.code = code;
    this.status = status;
    if (allow) this.allow = allow;
  }
}
export class ValidationError extends MembraneError {
  constructor(message, code = 'INVALID_VALUE') { super(message, { code, status: 400 }); this.name = 'ValidationError'; }
}
export class LimitError extends MembraneError {
  constructor(message, code = 'RESOURCE_LIMIT') { super(message, { code, status: 413 }); this.name = 'LimitError'; }
}

export const LIMITS = Object.freeze({ depth: 10, propertiesPerObject: 64, arrayLength: 100, totalNodes: 2048, stringLength: 8192, keyLength: 128 });
export const FORBIDDEN_KEYS = Object.freeze(['__proto__', 'prototype', 'constructor', 'isPrototypeOf', 'propertyIsEnumerable', 'toLocaleString']);
const PROFILES = new Set(['strict', 'standard', 'minimal']);
const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

function validateString(value, field) {
  if (typeof value !== 'string') throw new ValidationError(`${field} must be a string`, 'INVALID_TYPE');
  if (value.length > LIMITS.stringLength) throw new LimitError(`${field} exceeds maximum string length`, 'STRING_TOO_LONG');
  if (value.includes('\0')) throw new ValidationError(`${field} contains a null byte`, 'NULL_BYTE');
  return value;
}
function sanitizeNonCredential(value, profile, field) {
  const valid = validateString(value, field);
  // This is conservative input hygiene, not a substitute for output encoding.
  if (profile === 'strict' && /<\s*script\b|javascript\s*:/i.test(valid)) {
    throw new ValidationError(`${field} contains a prohibited active-content pattern`, 'PROHIBITED_CONTENT');
  }
  return valid;
}

export function deepScrub(input, profile = 'standard', credentialFields = [], options = {}) {
  if (!PROFILES.has(profile)) throw new ValidationError('Unknown data-guard profile', 'INVALID_PROFILE');
  if (!Array.isArray(credentialFields) || credentialFields.some((x) => typeof x !== 'string' || !x.length)) {
    throw new ValidationError('credentialFields must be an array of non-empty strings', 'INVALID_GUARD_CONFIG');
  }
  const credentials = new Set(credentialFields.map((x) => x.toLowerCase()));
  const state = { nodes: 0 };
  const visit = (value, depth, fieldName = '$', isCredential = false) => {
    state.nodes += 1;
    if (state.nodes > LIMITS.totalNodes) throw new LimitError('Payload node budget exceeded', 'NODE_LIMIT');
    if (depth > LIMITS.depth) throw new LimitError('Maximum nesting depth exceeded', 'MAX_DEPTH');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'string') return isCredential ? validateString(value, fieldName) : sanitizeNonCredential(value, profile, fieldName);
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new ValidationError(`${fieldName} must be finite`, 'NON_FINITE_NUMBER');
      return value;
    }
    if (typeof value !== 'object' || value === undefined) throw new ValidationError(`${fieldName} has an unsupported value type`, 'UNSUPPORTED_TYPE');
    if (Array.isArray(value)) {
      if (value.length > LIMITS.arrayLength) throw new LimitError(`${fieldName} array is too large`, 'ARRAY_LIMIT');
      return value.map((item, index) => visit(item, depth + 1, `${fieldName}[${index}]`, false));
    }
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) throw new ValidationError(`${fieldName} must be a plain object`, 'NON_PLAIN_OBJECT');
    const entries = Object.entries(value);
    if (entries.length > LIMITS.propertiesPerObject) throw new LimitError(`${fieldName} has too many properties`, 'PROPERTY_LIMIT');
    const output = Object.create(null);
    for (const [key, child] of entries) {
      if (key.length > LIMITS.keyLength) throw new LimitError('Object key is too long', 'KEY_TOO_LONG');
      if (FORBIDDEN_KEYS.includes(key) || /[.\[\]\\/]/.test(key)) throw new ValidationError(`Forbidden object key: ${key}`, 'FORBIDDEN_KEY');
      output[key] = visit(child, depth + 1, `${fieldName}.${key}`, credentials.has(key.toLowerCase()));
    }
    return output;
  };
  return visit(input, 0, '$', false);
}

export function scrubSensitiveData(input, profile = 'standard', credentialFields = [], options = {}) {
  try { return { ok: true, value: deepScrub(input, profile, credentialFields, options) }; }
  catch (error) { return { ok: false, error: error instanceof MembraneError ? error : new MembraneError('Internal data guard failure', { code: 'DATA_GUARD_INTERNAL', status: 500, cause: error }) }; }
}
