const encoder = new TextEncoder();
const ITERATIONS = 210000;
const MIN_ITERATIONS = 100000;
const MAX_ITERATIONS = 600000;
const DUMMY_SALT = "YWVnaXMtZHVtbXktcGFzc3dvcmQtc2FsdA";

function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{20,128}$/.test(value)) return null;
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4);
    const binary = atob(base64);
    return Uint8Array.from(binary, character => character.charCodeAt(0));
  } catch { return null; }
}

function equalBytes(left, right) {
  const length = Math.max(left.length, right.length);
  let mismatch = left.length ^ right.length;
  for (let i = 0; i < length; i += 1) mismatch |= (left[i] || 0) ^ (right[i] || 0);
  return mismatch === 0;
}

export function normalizeLoginIdentifier(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized.length < 3 || normalized.length > 254 ||
      !/^[a-z0-9][a-z0-9._+@-]*$/.test(normalized) ||
      normalized.includes("..") || normalized.endsWith(".") || normalized.startsWith(".")) return null;
  return normalized;
}

async function derivePassword(password, salt, iterations) {
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations }, material, 256
  ));
}

export async function createPasswordCredential(password) {
  if (typeof password !== "string" || password.length < 12 || password.length > 1024) {
    throw new TypeError("Password must contain between 12 and 1024 characters.");
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePassword(password, salt, ITERATIONS);
  return {
    passwordSalt: toBase64Url(salt),
    passwordHash: toBase64Url(hash),
    passwordIterations: ITERATIONS,
  };
}

export async function verifyPasswordCredential(password, credential) {
  if (typeof password !== "string" || password.length < 1 || password.length > 1024) return false;
  const salt = fromBase64Url(credential?.password_salt ?? DUMMY_SALT);
  const expected = fromBase64Url(credential?.password_hash ?? toBase64Url(new Uint8Array(32)));
  const iterations = Number(credential?.password_iterations ?? ITERATIONS);
  const safeIterations = Number.isSafeInteger(iterations) && iterations >= MIN_ITERATIONS && iterations <= MAX_ITERATIONS
    ? iterations : ITERATIONS;
  const derived = await derivePassword(password, salt || fromBase64Url(DUMMY_SALT), safeIterations);
  const validShape = Boolean(credential && salt && expected && safeIterations === iterations);
  return validShape && equalBytes(derived, expected);
}

export async function authenticatePrincipal(db, identity, password) {
  const normalized = normalizeLoginIdentifier(identity);
  let credential = null;
  if (normalized && db && typeof db.prepare === "function") {
    credential = await db.prepare(`
      SELECT c.principal_id, c.password_salt, c.password_hash, c.password_iterations
      FROM aegis_principal_credentials c
      JOIN aegis_principals p ON p.id = c.principal_id
      WHERE c.login_identifier = ? AND p.status = 'active'
      LIMIT 1
    `).bind(normalized).first();
  }
  const passwordValid = await verifyPasswordCredential(password, credential);
  if (!credential || !passwordValid) return null;

  const memberships = await db.prepare(`
    SELECT m.tenant_id, m.role, t.name AS tenant_name
    FROM aegis_tenant_memberships m
    JOIN aegis_tenants t ON t.id = m.tenant_id
    WHERE m.principal_id = ? AND m.status = 'active' AND t.status = 'active'
    ORDER BY m.tenant_id
  `).bind(credential.principal_id).all();

  return {
    principalId: credential.principal_id,
    memberships: (memberships?.results || []).map(row => ({
      tenantId: row.tenant_id,
      tenantName: row.tenant_name,
      role: row.role,
    })),
  };
}
