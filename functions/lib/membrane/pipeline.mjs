import { MembraneError, LimitError, scrubSensitiveData, FORBIDDEN_KEYS, LIMITS } from './data-guards.mjs';
import { evaluateRoutePolicy, GLOBAL_MAX_BODY_SIZE } from './route-policy.mjs';

const MAX_FORM_FIELDS = 64;
const MAX_FORM_KEY_LENGTH = 64;
const MAX_FORM_VALUE_LENGTH = 8192;
const MAX_STREAM_CHUNKS = 4096;
const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

function rawPathFromUrl(input) {
  const match = String(input).match(/^[A-Za-z][A-Za-z0-9+.-]*:\/\/[^/?#]*(?<path>[^?#]*)/);
  return match?.groups?.path || '/';
}

export function classifyApiPath(input) {
  let url;
  try { url = new URL(input); }
  catch { return { kind: 'invalid', reason: 'Malformed request URL' }; }

  const raw = rawPathFromUrl(input);
  let decoded = null;
  try { decoded = decodeURIComponent(raw); }
  catch { /* Malformed escapes are rejected below for API paths. */ }

  // Encoded separators are ambiguous to routers and are rejected globally so
  // they cannot be normalised into a protected route by a later layer.
  if (raw.includes('\\') || /%2f|%5c/i.test(raw)) {
    return { kind: 'invalid', reason: 'Encoded or literal path separator is not accepted' };
  }

  const looksApi = /^\/+api(?:\/|$|\\)/i.test(raw)
    || /^\/+api(?:\/|$|\\)/i.test(url.pathname)
    || (decoded !== null && /^\/+api(?:\/|$|\\)/i.test(decoded));
  if (!looksApi) return { kind: 'public', path: url.pathname };
  if (decoded === null || /%(?![0-9a-f]{2})/i.test(raw)) {
    return { kind: 'invalid', reason: 'Malformed API path encoding' };
  }
  if (raw !== url.pathname) return { kind: 'invalid', reason: 'API path was normalised by URL parsing' };
  if (/%[0-9a-f]{2}/i.test(raw)) return { kind: 'invalid', reason: 'Percent-encoded API path segments are not accepted' };
  if (!/^\/api(?:\/[a-z0-9-]+)*$/i.test(raw)) return { kind: 'invalid', reason: 'Non-canonical API path' };
  if (raw !== raw.toLowerCase()) return { kind: 'invalid', reason: 'API paths must use canonical lowercase spelling' };
  return { kind: 'api', path: raw };
}
function parseContentType(header) {
  if (typeof header !== 'string' || !header.trim()) throw new MembraneError('Content-Type is required', { code: 'CONTENT_TYPE_REQUIRED', status: 415 });
  const parts = header.split(';');
  const mediaType = parts.shift().trim().toLowerCase();
  if (!/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(mediaType)) throw new MembraneError('Malformed media type', { code: 'INVALID_MEDIA_TYPE', status: 415 });
  let charsetSeen = false;
  for (const part of parts) {
    const segment = part.trim();
    if (!segment || segment.includes("'")) throw new MembraneError('Malformed media type parameter', { code: 'INVALID_MEDIA_PARAMETER', status: 415 });
    const match = segment.match(/^([A-Za-z0-9_-]+)\s*=\s*(?:"([^"]*)"|([A-Za-z0-9._+-]+))$/);
    if (!match) throw new MembraneError('Malformed media type parameter', { code: 'INVALID_MEDIA_PARAMETER', status: 415 });
    if (match[1].toLowerCase() !== 'charset') throw new MembraneError('Unsupported media type parameter', { code: 'UNSUPPORTED_MEDIA_PARAMETER', status: 415 });
    if (charsetSeen || (match[2] ?? match[3]).toLowerCase() !== 'utf-8') throw new MembraneError('Only UTF-8 charset is supported', { code: 'UNSUPPORTED_CHARSET', status: 415 });
    charsetSeen = true;
  }
  return mediaType;
}
function parseContentLength(value) {
  if (value === null) return null;
  if (!/^(0|[1-9][0-9]*)$/.test(value)) throw new MembraneError('Invalid Content-Length', { code: 'INVALID_CONTENT_LENGTH', status: 400 });
  const n = Number(value);
  if (!Number.isSafeInteger(n)) throw new MembraneError('Invalid Content-Length', { code: 'INVALID_CONTENT_LENGTH', status: 400 });
  return n;
}
async function readBoundedBody(request, maxBytes) {
  const declared = parseContentLength(request.headers.get('content-length'));
  if (declared !== null && declared > maxBytes) throw new LimitError('Request body exceeds route limit', 'BODY_TOO_LARGE');
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks = []; let total = 0; let reads = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      reads += 1;
      if (reads > MAX_STREAM_CHUNKS) throw new LimitError('Request contains too many stream chunks', 'CHUNK_LIMIT');
      if (done) break;
      if (!(value instanceof Uint8Array)) throw new MembraneError('Invalid request stream chunk', { code: 'INVALID_STREAM', status: 400 });
      total += value.byteLength;
      if (total > maxBytes || total > GLOBAL_MAX_BODY_SIZE) throw new LimitError('Request body exceeds configured limit', 'BODY_TOO_LARGE');
      chunks.push(value);
    }
  } catch (error) { try { await reader.cancel(); } catch {} throw error; }
  if (declared !== null && declared !== total) throw new MembraneError('Content-Length does not match received body', { code: 'CONTENT_LENGTH_MISMATCH', status: 400 });
  const result = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
  return result;
}
function decodeUtf8(bytes) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch (cause) { throw new MembraneError('Body is not valid UTF-8', { code: 'INVALID_UTF8', status: 400, cause }); }
}

// Small recursive-descent JSON parser: JSON.parse alone silently overwrites duplicate object keys.
export function parseJsonNoDuplicates(source) {
  let i = 0;
  const ws = () => { while (/[ \t\r\n]/.test(source[i] ?? '') && i < source.length) i++; };
  const fail = (message) => { throw new MembraneError(`${message} at JSON offset ${i}`, { code: 'INVALID_JSON', status: 400 }); };
  const string = () => {
    const start = i;
    if (source[i++] !== '"') fail('Expected string');
    while (i < source.length) {
      const c = source[i++];
      if (c === '"') { try { return JSON.parse(source.slice(start, i)); } catch { fail('Invalid JSON string'); } }
      if (c === '\\') { if (i >= source.length) fail('Invalid escape'); i++; }
      else if (c.charCodeAt(0) < 0x20) fail('Control character in string');
    }
    fail('Unterminated string');
  };
  const value = (depth = 0) => {
    if (depth > LIMITS.depth + 4) throw new LimitError('JSON nesting limit exceeded', 'JSON_DEPTH_LIMIT');
    ws(); const c = source[i];
    if (c === '"') return string();
    if (c === '{') {
      i++; ws(); const out = Object.create(null); const keys = new Set();
      if (source[i] === '}') { i++; return out; }
      while (true) {
        ws(); if (source[i] !== '"') fail('Object key must be a string');
        const key = string(); if (keys.has(key)) fail(`Duplicate object property ${key}`); keys.add(key);
        ws(); if (source[i++] !== ':') fail('Expected colon'); out[key] = value(depth + 1); ws();
        if (source[i] === '}') { i++; return out; }
        if (source[i++] !== ',') fail('Expected comma');
      }
    }
    if (c === '[') {
      i++; ws(); const out = [];
      if (source[i] === ']') { i++; return out; }
      while (true) { out.push(value(depth + 1)); ws(); if (source[i] === ']') { i++; return out; } if (source[i++] !== ',') fail('Expected comma'); }
    }
    for (const [literal, result] of [['true', true], ['false', false], ['null', null]]) if (source.startsWith(literal, i)) { i += literal.length; return result; }
    const number = source.slice(i).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
    if (number) { i += number[0].length; const n = Number(number[0]); if (!Number.isFinite(n)) fail('Non-finite number'); return n; }
    fail('Unexpected token');
  };
  const result = value(); ws(); if (i !== source.length) fail('Trailing JSON content'); return result;
}

function validateSchema(value, schema, path = '$') {
  const bad = (message) => { throw new MembraneError(`${path}: ${message}`, { code: 'SCHEMA_VALIDATION', status: 400 }); };
  if (value === null && schema.nullable === true) return;
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) bad('must be an object');
    for (const key of Object.keys(value)) {
      if (FORBIDDEN_KEYS.includes(key) || /[.\[\]\\/]/.test(key)) bad(`forbidden property ${key}`);
      if (!hasOwn(schema.properties, key)) { if (!schema.additionalProperties) bad(`unknown property ${key}`); else continue; }
      validateSchema(value[key], schema.properties[key], `${path}.${key}`);
    }
    for (const key of schema.required) if (!hasOwn(value, key)) bad(`missing required property ${key}`);
    return;
  }
  if (schema.type === 'string') {
    if (typeof value !== 'string') bad('must be a string');
    if (value.length < (schema.minLength ?? 0) || value.length > schema.maxLength) bad('string length out of range');
    if (schema.enum && !schema.enum.includes(value)) bad('value is not an allowed enum member');
  } else if (schema.type === 'boolean') { if (typeof value !== 'boolean') bad('must be a boolean'); }
  else if (schema.type === 'integer') { if (!Number.isSafeInteger(value) || value < schema.minimum || value > schema.maximum) bad('integer out of range'); }
  else if (schema.type === 'number') { if (!Number.isFinite(value) || value < schema.minimum || value > schema.maximum) bad('number out of range'); }
  else if (schema.type === 'array') { if (!Array.isArray(value) || value.length > schema.maxItems) bad('array invalid or too large'); value.forEach((x, i) => validateSchema(x, schema.items, `${path}[${i}]`)); }
}
function parseForm(source, policy) {
  const fields = source === '' ? [] : source.split('&');
  if (fields.length > MAX_FORM_FIELDS) throw new LimitError('Too many form fields', 'FORM_FIELD_LIMIT');
  const output = Object.create(null); const counts = new Map();
  for (const part of fields) {
    if (!part) throw new MembraneError('Empty form segment is not allowed', { code: 'INVALID_FORM', status: 400 });
    const eq = part.indexOf('='); if (eq < 1) throw new MembraneError('Form fields must use key=value syntax', { code: 'INVALID_FORM', status: 400 });
    let key, value;
    try { key = decodeURIComponent(part.slice(0, eq).replace(/\+/g, ' ')); value = decodeURIComponent(part.slice(eq + 1).replace(/\+/g, ' ')); }
    catch (cause) { throw new MembraneError('Malformed form percent encoding', { code: 'INVALID_FORM_ENCODING', status: 400, cause }); }
    if (!key || key.length > MAX_FORM_KEY_LENGTH || value.length > MAX_FORM_VALUE_LENGTH) throw new LimitError('Form key or value limit exceeded', 'FORM_VALUE_LIMIT');
    if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(key) || FORBIDDEN_KEYS.includes(key)) throw new MembraneError('Invalid form field name', { code: 'INVALID_FORM_KEY', status: 400 });
    if (!policy.formFields.includes(key)) throw new MembraneError(`Form field ${key} is not allowed`, { code: 'UNKNOWN_FORM_FIELD', status: 400 });
    const count = (counts.get(key) ?? 0) + 1; counts.set(key, count);
    if (count > 1 && (!policy.allowDuplicateFormFields || !policy.multiValuedFormFields.includes(key))) throw new MembraneError(`Duplicate form field ${key}`, { code: 'DUPLICATE_FORM_FIELD', status: 400 });
    if (count > 1) output[key].push(value); else output[key] = policy.multiValuedFormFields.includes(key) ? [value] : value;
  }
  for (const key of policy.schema.required) if (!hasOwn(output, key)) throw new MembraneError(`Missing required form field ${key}`, { code: 'MISSING_REQUIRED_FIELD', status: 400 });
  return output;
}
function validateQueryParameters(request, schema) {
  if (!schema) return request;
  const params = new URL(request.url).searchParams;
  const query = Object.create(null);
  for (const [key, value] of params) {
    if (hasOwn(query, key)) {
      throw new MembraneError('Duplicate query parameter ' + key, {
        code: 'DUPLICATE_QUERY_PARAMETER', status: 400,
      });
    }
    query[key] = value;
  }
  const clean = scrubAndValidate(query, {
    profile: 'standard', credentialFields: [], schema,
  });
  const url = new URL(request.url);
  url.search = '';
  for (const [key, value] of Object.entries(clean)) url.searchParams.append(key, value);
  return new Request(url, request);
}
function scrubAndValidate(value, policy) {
  const scrubbed = scrubSensitiveData(value, policy.profile, policy.credentialFields);
  if (!scrubbed.ok) throw scrubbed.error;
  validateSchema(scrubbed.value, policy.schema);
  return scrubbed.value;
}
function responseFor(error) {
  const status = error instanceof MembraneError ? error.status : 500;
  const code = error instanceof MembraneError ? error.code : 'INTERNAL_MEMBRANE_ERROR';
  const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
  if (error?.allow) headers.allow = error.allow;
  return new Response(JSON.stringify({ error: code }), { status, headers });
}


export async function withAegisImmunePipeline(context) {
  const { request, next } = context;
  let verifiedRequest;
  try {
    const classification = classifyApiPath(request.url);
    if (classification.kind !== 'api') throw new MembraneError(classification.reason ?? 'Invalid API path', { code: 'INVALID_API_PATH', status: 400 });
    const path = classification.path;
    const route = evaluateRoutePolicy(path, request.method);
    if (!route.ok) throw new MembraneError(route.code, { code: route.code, status: route.status, ...(route.allow ? { allow: route.allow } : {}) });
    const policy = route.policy;
    if (request.method === 'GET' || request.method === 'HEAD') {
      if (request.body !== null) throw new MembraneError('GET and HEAD bodies are forbidden', { code: 'BODY_NOT_ALLOWED', status: 400 });
      verifiedRequest = request.method === 'GET' ? validateQueryParameters(request, policy.querySchema) : request;
    } else if (request.method === 'DELETE') {
      // Pages may expose a zero-byte stream for DELETE rather than a null body.
      // Consume that stream and rebuild a bodyless request for the logout handler.
      if (request.body !== null) {
        try {
          await readBoundedBody(request, 0);
        } catch (error) {
          if (error instanceof LimitError) {
            throw new MembraneError('Body is forbidden for this method', { code: 'BODY_NOT_ALLOWED', status: 400 });
          }
          throw error;
        }
        const headers = new Headers(request.headers);
        headers.delete('content-length');
        headers.delete('transfer-encoding');
        verifiedRequest = new Request(request.url, { method: 'DELETE', headers });
      } else {
        verifiedRequest = request;
      }
    } else {
      if (!policy.allowBodies) throw new MembraneError('Request body is forbidden for this route', { code: 'BODY_NOT_ALLOWED', status: 400 });
      const contentEncoding = request.headers.get('content-encoding');
    if (contentEncoding && contentEncoding.trim().toLowerCase() !== 'identity') throw new MembraneError('Content-Encoding is unsupported', { code: 'UNSUPPORTED_CONTENT_ENCODING', status: 415 });
    if (request.headers.has('content-md5') || request.headers.has('digest') || request.headers.has('signature')) throw new MembraneError('Integrity headers cannot be retained across body verification', { code: 'UNSUPPORTED_INTEGRITY_HEADER', status: 400 });
    const mediaType = parseContentType(request.headers.get('content-type'));
    if (!policy.allowedMediaTypes.includes(mediaType)) throw new MembraneError('Media type is not allowed for this route', { code: 'UNSUPPORTED_MEDIA_TYPE', status: 415 });
    const bytes = await readBoundedBody(request, Math.min(policy.maxBodySize, GLOBAL_MAX_BODY_SIZE));
    const text = decodeUtf8(bytes);
    let parsed;
    if (mediaType === 'application/json') parsed = parseJsonNoDuplicates(text);
    else if (mediaType === 'application/x-www-form-urlencoded') parsed = parseForm(text, policy);
    else throw new MembraneError('Unsupported media type', { code: 'UNSUPPORTED_MEDIA_TYPE', status: 415 });
    const clean = scrubAndValidate(parsed, policy);
    const serialized = mediaType === 'application/json' ? JSON.stringify(clean) : new URLSearchParams(Object.entries(clean).flatMap(([k, v]) => Array.isArray(v) ? v.map((x) => [k, x]) : [[k, v]])).toString();
    const headers = new Headers(request.headers);
    headers.delete('content-length'); headers.delete('content-encoding');
      verifiedRequest = new Request(request, { headers, body: serialized });
    }
  } catch (error) { return responseFor(error); }
  // Keep downstream exceptions outside the membrane's input-error mapping.
  return await next(verifiedRequest);
}
