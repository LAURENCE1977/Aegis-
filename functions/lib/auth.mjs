const COOKIE_NAME = "__Host-aegis_session";
const SESSION_TTL_SECONDS = 12 * 60 * 60;
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

export function authConfigAvailable(env) { return Boolean(env&&typeof env.AEGIS_PASSWORD==="string"&&env.AEGIS_PASSWORD.length>=12&&typeof env.AEGIS_SESSION_SECRET==="string"&&env.AEGIS_SESSION_SECRET.length>=32); }
export function constantTimeEqual(left,right) { if(typeof left!=="string"||typeof right!=="string")return false; const length=Math.max(left.length,right.length); let difference=left.length^right.length; for(let i=0;i<length;i++)difference|=(left.charCodeAt(i)||0)^(right.charCodeAt(i)||0); return difference===0; }
// Stateless tokens remain available for isolated/local tests. Pages login uses the revocable form below.
export async function createSessionToken(secret,now=Date.now()) { if(typeof secret!=="string"||secret.length<32)throw new Error("A session signing secret of at least 32 characters is required."); return signClaims(secret,{exp:Math.floor(now/1000)+SESSION_TTL_SECONDS}); }
export async function createRevocableSessionToken(secret,now=Date.now()) { if(typeof secret!=="string"||secret.length<32)throw new Error("A session signing secret of at least 32 characters is required."); const sessionId=crypto.randomUUID(); const expiresAt=Math.floor(now/1000)+SESSION_TTL_SECONDS; return {token:await signClaims(secret,{sid:sessionId,exp:expiresAt}),sessionId,expiresAt}; }
export async function verifySessionToken(token,secret,now=Date.now()) { if(typeof secret!=="string"||secret.length<32||typeof token!=="string")return false; const parts=token.split("."); if(parts.length!==2||!parts[0]||!parts[1])return false; try { const claims=JSON.parse(new TextDecoder().decode(fromBase64Url(parts[0]))); if(!Number.isSafeInteger(claims.exp)||claims.exp<=Math.floor(now/1000))return false; return await crypto.subtle.verify("HMAC",await signingKey(secret),fromBase64Url(parts[1]),encoder.encode(parts[0])); } catch { return false; } }
export function readSessionToken(request) { const header=request.headers.get("Cookie")||""; for(const part of header.split(";")){const i=part.indexOf("=");if(i<0)continue;if(part.slice(0,i).trim()===COOKIE_NAME)return part.slice(i+1).trim();}return null; }
export async function isAuthorized(request,env,now=Date.now()) { if(!env||typeof env.AEGIS_SESSION_SECRET!=="string")return false; const token=readSessionToken(request); if(!token||!(await verifySessionToken(token,env.AEGIS_SESSION_SECRET,now)))return false; if(env.AEGIS_DB&&typeof env.AEGIS_DB.prepare==="function"){const claims=decodeClaims(token);if(typeof claims?.sid!=="string"||!claims.sid)return true; // Legacy HMAC cookies expire within the existing 12-hour TTL.
try{const row=await env.AEGIS_DB.prepare("SELECT session_id FROM auth_sessions WHERE session_id = ? AND expires_at > ? AND revoked_at IS NULL LIMIT 1").bind(claims.sid,Math.floor(now/1000)).first();return Boolean(row);}catch{return false;}} return true; }
export async function revokeSession(request,env) { const token=readSessionToken(request); if(!token||!env?.AEGIS_DB||typeof env.AEGIS_DB.prepare!=="function")return false; if(!(await verifySessionToken(token,env.AEGIS_SESSION_SECRET)))return false; const claims=decodeClaims(token); if(typeof claims?.sid!=="string"||!claims.sid)return false; await env.AEGIS_DB.prepare("UPDATE auth_sessions SET revoked_at = ? WHERE session_id = ? AND revoked_at IS NULL").bind(new Date().toISOString(),claims.sid).run(); return true; }
export function isSameOriginRequest(request) { const origin=request.headers.get("Origin");if(!origin)return false;try{return new URL(origin).origin===new URL(request.url).origin;}catch{return false;} }
export function sessionCookie(token,maxAge=SESSION_TTL_SECONDS) { return COOKIE_NAME+"="+token+"; Path=/; Max-Age="+maxAge+"; HttpOnly; Secure; SameSite=Strict"; }
export function clearSessionCookie() { return COOKIE_NAME+"=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Strict"; }
