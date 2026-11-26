const MAX_CURSOR_LENGTH = 512;
const MAX_CURSOR_TTL_SECONDS = 86400;
const MIN_CURSOR_TTL_SECONDS = 60;
const MIN_SECRET_BYTES = 32;
const D1_TIMESTAMP = /^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$/;
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function getSigningKey(secretString) {
  if (typeof secretString !== "string" || secretString.trim().length === 0) {
    throw new Error("CURSOR_SIGNING_SECRET is missing or empty.");
  }
  const secretBytes = new TextEncoder().encode(secretString);
  if (secretBytes.byteLength < MIN_SECRET_BYTES) {
    throw new Error("CURSOR_SIGNING_SECRET must contain at least 32 UTF-8 bytes.");
  }
  return crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: { name: "SHA-256" } },
    false,
    ["sign", "verify"],
  );
}

function base64UrlEncode(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let index = 0; index < bytes.byteLength; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary).replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/, "");
}

function base64UrlDecodeToBytes(value) {
  if (typeof value !== "string" || value.length === 0 ||
      value.length % 4 === 1 || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error("Invalid Base64URL value.");
  }
  const padded = value.replace(/-/g, "+").replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  if (base64UrlEncode(bytes) !== value) throw new Error("Non-canonical Base64URL value.");
  return bytes;
}

function isD1Timestamp(value) {
  if (typeof value !== "string" || !D1_TIMESTAMP.test(value)) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function isScopeId(value) {
  return typeof value === "string" && value.length <= 100 && ID_PATTERN.test(value);
}

function validateCursorInputs(row, scope, filters) {
  if (!row || !isD1Timestamp(row.updated_at) || !isScopeId(row.id)) {
    throw new TypeError("Cursor position has an invalid D1 timestamp or identifier.");
  }
  if (!scope || !isScopeId(scope.tenant_id) || !isScopeId(scope.principal_id) ||
      !(scope.project_id === null || isScopeId(scope.project_id))) {
    throw new TypeError("Cursor scope is invalid.");
  }
  if (!filters || typeof filters.review !== "boolean") {
    throw new TypeError("Cursor filters are invalid.");
  }
}

/**
 * Creates an HMAC-SHA256 signed cursor bound to the authenticated identity,
 * project and review filter. The payload is integrity-protected, not encrypted.
 */
export async function encodeSignedCursor(row, scope, filters, secret) {
  validateCursorInputs(row, scope, filters);
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    v: 1,
    updated_at: row.updated_at,
    id: row.id,
    tenant_id: scope.tenant_id,
    principal_id: scope.principal_id,
    project_id: scope.project_id,
    review: filters.review,
    iat: now,
    exp: now + MAX_CURSOR_TTL_SECONDS,
  };
  const encodedPayload = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await getSigningKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(encodedPayload));
  return encodedPayload + "." + base64UrlEncode(signature);
}

/**
 * Returns the validated cursor payload, or null for malformed, invalid,
 * expired, tampered, non-canonical or out-of-scope cursors.
 */
export async function verifyAndDecodeCursor(rawCursor, currentScope, currentFilters, secret) {
  if (typeof rawCursor !== "string" || rawCursor.length === 0 ||
      rawCursor.length > MAX_CURSOR_LENGTH) return null;
  const parts = rawCursor.split(".");
  if (parts.length !== 2) return null;
  const [encodedPayload, encodedSignature] = parts;

  try {
    if (typeof currentScope?.tenant_id !== "string" ||
        typeof currentScope?.principal_id !== "string" ||
        !(currentScope.project_id === null || typeof currentScope.project_id === "string") ||
        typeof currentFilters?.review !== "boolean") return null;

    const signatureBytes = base64UrlDecodeToBytes(encodedSignature);
    if (signatureBytes.byteLength !== 32) return null;
    const key = await getSigningKey(secret);
    const valid = await crypto.subtle.verify(
      "HMAC", key, signatureBytes, new TextEncoder().encode(encodedPayload),
    );
    if (!valid) return null;

    const payloadBytes = base64UrlDecodeToBytes(encodedPayload);
    const json = new TextDecoder("utf-8", { fatal: true }).decode(payloadBytes);
    const payload = JSON.parse(json);
    if (!payload || typeof payload !== "object" || Array.isArray(payload) ||
        payload.v !== 1 || !isD1Timestamp(payload.updated_at) ||
        !isScopeId(payload.id) || !isScopeId(payload.tenant_id) ||
        !isScopeId(payload.principal_id) ||
        !(payload.project_id === null || isScopeId(payload.project_id)) ||
        typeof payload.review !== "boolean" ||
        !Number.isSafeInteger(payload.iat) || !Number.isSafeInteger(payload.exp)) return null;

    const now = Math.floor(Date.now() / 1000);
    const ttl = payload.exp - payload.iat;
    if (payload.exp <= now || payload.iat > now ||
        ttl < MIN_CURSOR_TTL_SECONDS || ttl > MAX_CURSOR_TTL_SECONDS) return null;

    if (payload.tenant_id !== currentScope.tenant_id ||
        payload.principal_id !== currentScope.principal_id ||
        payload.project_id !== currentScope.project_id ||
        payload.review !== currentFilters.review) return null;

    return payload;
  } catch {
    return null;
  }
}
