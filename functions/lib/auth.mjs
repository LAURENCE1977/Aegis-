const COOKIE_NAME = "__Host-aegis_session";
const SESSION_TTL_SECONDS = 12 * 60 * 60;
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

export async function createSessionToken(secret, now = Date.now()) {
  if (typeof secret !== "string" || secret.length < 32) {
    throw new Error("A session signing secret of at least 32 characters is required.");
  }
  const payload = toBase64Url(encoder.encode(JSON.stringify({
    exp: Math.floor(now / 1000) + SESSION_TTL_SECONDS,
  })));
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
    if (!Number.isSafeInteger(payload.exp) || payload.exp <= Math.floor(now / 1000)) return false;
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
