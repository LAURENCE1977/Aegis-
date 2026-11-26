const COOKIE_NAME = "__Host-aegis_session";
const SESSION_TTL_SECONDS = 12 * 60 * 60;
export const ROOT_PRINCIPAL_ID = "usr-root";
export const ROOT_TENANT_ID = "org-root";
const encoder = new TextEncoder();
function toBase64Url(bytes) { let binary=""; for (const byte of bytes) binary+=String.fromCharCode(byte); return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,""); }
function fromBase64Url(value) { const base64=value.replace(/-/g,"+").replace(/_/g,"/"); const padded=base64+"=".repeat((4-(base64.length%4))%4); const binary=atob(padded); return Uint8Array.from(binary,c=>c.charCodeAt(0)); }
async function signingKey(secret) { return crypto.subtle.importKey("raw",encoder.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign","verify"]); }
function decodeClaims(token) { try { const payload=token.split(".")[0]; return payload?JSON.parse(new TextDecoder().decode(fromBase64Url(payload))):null; } catch { return null; } }
async function signClaims(secret,claims) { const payload=toBase64Url(encoder.encode(JSON.stringify(claims))); const key=await signingKey(secret); const signature=new Uint8Array(await crypto.subtle.sign("HMAC",key,encoder.encode(payload))); return payload+"."+toBase64Url(signature); }
export async function hashLoginIdentity(identity, secret) {
  if (typeof identity !== "string" || !identity || typeof secret !== "string" || secret.length < 32) {
    throw new Error("A trusted login identity and session secret are required.");
  }
  const key = await signingKey(secret);
  const digest = new Uint8Array(await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode("aegis-login-rate-limit:" + identity)
  ));
  return toBase64Url(digest);
}

export function authConfigAvailable(env) { return Boolean(env && typeof env.AEGIS_SESSION_SECRET === "string" && env.AEGIS_SESSION_SECRET.length >= 32 && env.AEGIS_DB && typeof env.AEGIS_DB.prepare === "function"); }
export function constantTimeEqual(left,right) { if(typeof left!=="string"||typeof right!=="string")return false; const length=Math.max(left.length,right.length); let difference=left.length^right.length; for(let i=0;i<length;i++)difference|=(left.charCodeAt(i)||0)^(right.charCodeAt(i)||0); return difference===0; }
export async function createRevocableSessionToken(secret,now=Date.now()) { if(typeof secret!=="string"||secret.length<32)throw new Error("A session signing secret of at least 32 characters is required."); const sessionId=crypto.randomUUID(); const expiresAt=Math.floor(now/1000)+SESSION_TTL_SECONDS; return {token:await signClaims(secret,{sid:sessionId,exp:expiresAt}),sessionId,expiresAt}; }
async function verifySignedSessionToken(token, secret, now = Date.now()) {
  if (typeof secret !== "string" || secret.length < 32 || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  try {
    const claims = JSON.parse(new TextDecoder().decode(fromBase64Url(parts[0])));
    if (typeof claims.sid !== "string" || !/^[0-9a-f-]{36}$/i.test(claims.sid)) return null;
    if (!Number.isSafeInteger(claims.exp) || claims.exp <= Math.floor(now / 1000)) return null;
    const valid = await crypto.subtle.verify(
      "HMAC", await signingKey(secret), fromBase64Url(parts[1]), encoder.encode(parts[0])
    );
    return valid ? claims : null;
  } catch {
    return null;
  }
}

async function resolveSessionRecord(token, secret, db, now = Date.now()) {
  if (!db || typeof db.prepare !== "function") return null;
  const claims = await verifySignedSessionToken(token, secret, now);
  if (!claims) return null;
  try {
    const row = await db.prepare(`
      SELECT s.session_id, s.principal_id, s.tenant_id, m.role
      FROM auth_sessions s
      INNER JOIN aegis_principals p ON p.id = s.principal_id AND p.status = 'active'
      INNER JOIN aegis_tenants t ON t.id = s.tenant_id AND t.status = 'active'
      INNER JOIN aegis_tenant_memberships m
        ON m.principal_id = s.principal_id AND m.tenant_id = s.tenant_id
       AND m.status = 'active'
      WHERE s.session_id = ? AND s.expires_at > ? AND s.revoked_at IS NULL
      LIMIT 1
    `).bind(claims.sid, Math.floor(now / 1000)).first();
    if (!row || row.session_id !== claims.sid ||
        typeof row.principal_id !== "string" || !row.principal_id ||
        typeof row.tenant_id !== "string" || !row.tenant_id) return null;
    // The production query always returns m.role. The narrow fallback keeps
    // older D1 test adapters compatible; a real D1 INNER JOIN cannot return a
    // row without an active membership, and the stored role snapshot is
    // constrained by the session identity trigger.
    let resolvedRole = row.role;
    if (resolvedRole === undefined) {
      try {
        const snapshot = JSON.parse(row.roles_json);
        resolvedRole = Array.isArray(snapshot) && snapshot.length === 1 ? snapshot[0] : null;
      } catch { resolvedRole = null; }
    }
    if (!["owner", "admin", "member"].includes(resolvedRole)) return null;
    return Object.freeze({
      sid: row.session_id,
      principalId: row.principal_id,
      tenantId: row.tenant_id,
      roles: Object.freeze([resolvedRole]),
    });
  } catch {
    return null;
  }
}

export async function verifySessionToken(token, secret, now = Date.now(), db) {
  return Boolean(await resolveSessionRecord(token, secret, db, now));
}
export function readSessionToken(request) {
  const header = request.headers.get("Cookie") || "";
  let token = null;
  let found = false;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0 || part.slice(0, i).trim() !== COOKIE_NAME) continue;
    // Duplicate auth cookies are ambiguous across intermediaries/frameworks.
    // Reject the whole header instead of choosing first-wins or last-wins.
    if (found) return null;
    found = true;
    token = part.slice(i + 1).trim();
  }
  return found && token ? token : null;
}
export async function resolveSessionPrincipal(request, env, now = Date.now()) {
  if (!env || typeof env.AEGIS_SESSION_SECRET !== "string" ||
      !env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== "function") return null;
  const token = readSessionToken(request);
  if (!token) return null;
  return resolveSessionRecord(token, env.AEGIS_SESSION_SECRET, env.AEGIS_DB, now);
}

export async function isAuthorized(request, env, now = Date.now()) {
  return Boolean(await resolveSessionPrincipal(request, env, now));
}
export async function revokeSession(request, env) {
  const token = readSessionToken(request);
  if (!token) return true;
  // Invalid/expired cookies can be cleared without touching the session store.
  if (!(await verifySignedSessionToken(token, env?.AEGIS_SESSION_SECRET))) return true;
  if (!env?.AEGIS_DB || typeof env.AEGIS_DB.prepare !== "function") {
    throw new Error("D1 session storage is unavailable.");
  }
  const claims = decodeClaims(token);
  if (typeof claims?.sid !== "string" || !claims.sid) return true;
  // A resolved UPDATE is success even if already revoked (idempotent logout).
  // Storage errors propagate so the endpoint cannot report a successful logout
  // while a still-valid stolen token remains active.
  await env.AEGIS_DB.prepare(
    "UPDATE auth_sessions SET revoked_at = ? WHERE session_id = ? AND revoked_at IS NULL"
  ).bind(new Date().toISOString(), claims.sid).run();
  return true;
}
export function isSameOriginRequest(request) { const origin=request.headers.get("Origin");if(!origin)return false;try{return new URL(origin).origin===new URL(request.url).origin;}catch{return false;} }
export function sessionCookie(token,maxAge=SESSION_TTL_SECONDS) { return COOKIE_NAME+"="+token+"; Path=/; Max-Age="+maxAge+"; HttpOnly; Secure; SameSite=Strict"; }
export function clearSessionCookie() { return COOKIE_NAME+"=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Strict"; }
