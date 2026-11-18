const COOKIE_NAME = "__Host-aegis_session";
const SESSION_TTL_SECONDS = 12 * 60 * 60;
export const SESSION_CLAIMS_SCHEMA_VERSION = '1.0';
const SESSION_PRINCIPAL_ID = 'owner';
const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SESSION_CLAIM_KEYS = ['schemaVersion', 'principalId', 'sessionId', 'issuedAt', 'expiresAt'];
const encoder = new TextEncoder();

function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

async function signingKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export function authConfigAvailable(env) {
  return Boolean(
    env &&
    typeof env.AEGIS_PASSWORD === "string" && env.AEGIS_PASSWORD.length >= 12 &&
    typeof env.AEGIS_SESSION_SECRET === "string" && env.AEGIS_SESSION_SECRET.length >= 32
  );
}

export function constantTimeEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string") return false;
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

function exactSessionClaimKeys(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === SESSION_CLAIM_KEYS.length &&
    Object.keys(value).every((key) => SESSION_CLAIM_KEYS.includes(key));
}

function canonicalSessionTimestamp(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value;
}

/**
 * Validates the signed session identity for the current single-owner install.
 * This identifies the authenticated principal; it does not imply multi-user
 * tenancy or replace per-resource authorisation.
 */
export function validateSessionClaims(claims, now = Date.now()) {
  if (!exactSessionClaimKeys(claims) ||
      claims.schemaVersion !== SESSION_CLAIMS_SCHEMA_VERSION ||
      claims.principalId !== SESSION_PRINCIPAL_ID ||
      typeof claims.sessionId !== 'string' || !SESSION_ID_PATTERN.test(claims.sessionId) ||
      !canonicalSessionTimestamp(claims.issuedAt) ||
      !canonicalSessionTimestamp(claims.expiresAt) ||
      !Number.isFinite(now)) {
    throw new TypeError('Invalid AEGIS session claims.');
  }
  const issuedAt = Date.parse(claims.issuedAt);
  const expiresAt = Date.parse(claims.expiresAt);
  if (expiresAt - issuedAt !== SESSION_TTL_SECONDS * 1000 ||
      issuedAt > now || expiresAt <= now) {
    throw new TypeError('AEGIS session claims are outside their valid lifetime.');
  }
  return true;
}

export async function createSessionToken(secret, now = Date.now()) {
  if (typeof secret !== "string" || secret.length < 32) {
    throw new Error("A session signing secret of at least 32 characters is required.");
  }
  if (!Number.isFinite(now)) throw new TypeError('A valid session creation time is required.');
  const issuedAt = Math.floor(now / 1000) * 1000;
  const claims = {
    schemaVersion: SESSION_CLAIMS_SCHEMA_VERSION,
    principalId: SESSION_PRINCIPAL_ID,
    sessionId: crypto.randomUUID(),
    issuedAt: new Date(issuedAt).toISOString(),
    expiresAt: new Date(issuedAt + SESSION_TTL_SECONDS * 1000).toISOString(),
  };
  validateSessionClaims(claims, now);
  const payload = toBase64Url(encoder.encode(JSON.stringify(claims)));
  const key = await signingKey(secret);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
  return payload + "." + toBase64Url(signature);
}

export async function verifySessionToken(token, secret, now = Date.now()) {
  if (typeof secret !== "string" || secret.length < 32 || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return false;

  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(parts[0])));
    validateSessionClaims(payload, now);
    const key = await signingKey(secret);
    return await crypto.subtle.verify("HMAC", key, fromBase64Url(parts[1]), encoder.encode(parts[0]));
  } catch {
    return false;
  }
}

export function readSessionToken(request) {
  const cookieHeader = request.headers.get("Cookie") || "";
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === COOKIE_NAME) {
      return part.slice(separator + 1).trim();
    }
  }
  return null;
}

export async function isAuthorized(request, env, now = Date.now()) {
  if (!env || typeof env.AEGIS_SESSION_SECRET !== "string") return false;
  const token = readSessionToken(request);
  return token ? verifySessionToken(token, env.AEGIS_SESSION_SECRET, now) : false;
}

export function isSameOriginRequest(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function sessionCookie(token, maxAge = SESSION_TTL_SECONDS) {
  return COOKIE_NAME + "=" + token +
    "; Path=/; Max-Age=" + maxAge +
    "; HttpOnly; Secure; SameSite=Strict";
}

export function clearSessionCookie() {
  return COOKIE_NAME + "=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Strict";
}
