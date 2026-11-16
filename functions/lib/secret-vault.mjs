const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const PROVIDER_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;
const KEY_VERSION_PATTERN = /^v[1-9][0-9]{0,5}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SECRET_REF_PATTERN = /^vault:\/\/connections\/([0-9a-f-]{36})$/i;
const MAX_SECRET_BYTES = 16 * 1024;
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

function requiredId(value, label) {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    throw new TypeError('Invalid vault ' + label);
  }
}

function encodeBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function decodeBase64(value) {
  if (typeof value !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new Error('Invalid vault key encoding');
  }
  const binary = atob(value);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function loadKeyring(env) {
  let parsed;
  try { parsed = JSON.parse(env?.AEGIS_VAULT_KEYRING || ''); } catch {
    throw new Error('Vault keyring is unavailable');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Vault keyring is unavailable');
  }
  const activeVersion = env?.AEGIS_VAULT_ACTIVE_KEY_VERSION;
  if (typeof activeVersion !== 'string' || !KEY_VERSION_PATTERN.test(activeVersion)) {
    throw new Error('Vault active key version is unavailable');
  }
  const keys = new Map();
  for (const [version, encoded] of Object.entries(parsed)) {
    if (!KEY_VERSION_PATTERN.test(version)) throw new Error('Vault keyring is invalid');
    let raw;
    try { raw = decodeBase64(encoded); } catch {
      throw new Error('Vault keyring is invalid');
    }
    if (raw.byteLength !== 32) throw new Error('Vault keyring is invalid');
    keys.set(version, raw);
  }
  if (!keys.has(activeVersion)) throw new Error('Vault active key is unavailable');
  return { keys, activeVersion };
}

async function importAesKey(raw, usage) {
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, [usage]);
}

function additionalData({ id, principalId, providerId, keyVersion }) {
  return encoder.encode(['aegis-vault', '1', id, principalId, providerId, keyVersion].join(':'));
}

function parseSecretRef(secretRef) {
  if (typeof secretRef !== 'string') return null;
  const match = SECRET_REF_PATTERN.exec(secretRef);
  if (!match || !UUID_PATTERN.test(match[1])) return null;
  return match[1].toLowerCase();
}

function validateIdentity(principalId, providerId) {
  requiredId(principalId, 'principal');
  if (typeof providerId !== 'string' || !PROVIDER_PATTERN.test(providerId)) {
    throw new TypeError('Invalid vault provider');
  }
}

export async function storeVaultSecret(db, input, env, now = Date.now()) {
  if (!db || typeof db.prepare !== 'function') throw new TypeError('Vault database is required');
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).some(key => !['principalId', 'providerId', 'secret'].includes(key))) {
    throw new TypeError('Invalid vault secret fields');
  }
  validateIdentity(input.principalId, input.providerId);
  if (typeof input.secret !== 'string' || !input.secret.trim()) {
    throw new TypeError('Vault secret must be non-empty text');
  }
  const plaintext = encoder.encode(input.secret);
  if (plaintext.byteLength > MAX_SECRET_BYTES) throw new TypeError('Vault secret exceeds the 16 KiB size limit');
  if (!Number.isFinite(now)) throw new TypeError('Invalid vault clock');

  const { keys, activeVersion } = loadKeyring(env);
  const rawKey = keys.get(activeVersion);
  const key = await importAesKey(rawKey, 'encrypt');
  const id = crypto.randomUUID();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const aad = additionalData({
    id, principalId: input.principalId, providerId: input.providerId, keyVersion: activeVersion,
  });
  const encrypted = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: aad, tagLength: 128 },
    key,
    plaintext,
  ));
  const createdAt = new Date(now).toISOString();
  const result = await db.prepare(`
    INSERT INTO capability_secrets (
      secret_id, principal_id, provider_id, key_version, iv_b64,
      ciphertext_b64, created_at, updated_at, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
  `).bind(
    id, input.principalId, input.providerId, activeVersion,
    encodeBase64(iv), encodeBase64(encrypted), createdAt, createdAt,
  ).run();
  if (result?.meta?.changes === 0) throw new Error('Vault secret could not be stored');
  return { secretRef: 'vault://connections/' + id, keyVersion: activeVersion, createdAt };
}

/** Resolve only inside trusted server code after Sentinel has authorized the invocation. */
export async function resolveVaultSecret(db, input, env) {
  if (!db || typeof db.prepare !== 'function') throw new TypeError('Vault database is required');
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).some(key => !['principalId', 'providerId', 'secretRef'].includes(key))) {
    throw new TypeError('Invalid vault lookup fields');
  }
  validateIdentity(input.principalId, input.providerId);
  const id = parseSecretRef(input.secretRef);
  if (!id) throw new TypeError('Invalid vault secret reference');
  const row = await db.prepare(`
    SELECT * FROM capability_secrets
    WHERE secret_id = ? AND principal_id = ? AND provider_id = ?
  `).bind(id, input.principalId, input.providerId).first();
  if (!row || row.status !== 'active' || !row.iv_b64 || !row.ciphertext_b64) return null;

  const { keys } = loadKeyring(env);
  const rawKey = keys.get(row.key_version);
  if (!rawKey) throw new Error('Vault key version is unavailable');
  try {
    const key = await importAesKey(rawKey, 'decrypt');
    const plaintext = await crypto.subtle.decrypt({
      name: 'AES-GCM',
      iv: decodeBase64(row.iv_b64),
      additionalData: additionalData({
        id, principalId: input.principalId, providerId: input.providerId, keyVersion: row.key_version,
      }),
      tagLength: 128,
    }, key, decodeBase64(row.ciphertext_b64));
    return decoder.decode(plaintext);
  } catch {
    throw new Error('Vault secret could not be decrypted');
  }
}

export async function revokeVaultSecret(db, input, now = Date.now()) {
  if (!db || typeof db.prepare !== 'function') throw new TypeError('Vault database is required');
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).some(key => !['principalId', 'providerId', 'secretRef'].includes(key))) {
    throw new TypeError('Invalid vault revocation fields');
  }
  validateIdentity(input.principalId, input.providerId);
  const id = parseSecretRef(input.secretRef);
  if (!id) throw new TypeError('Invalid vault secret reference');
  if (!Number.isFinite(now)) throw new TypeError('Invalid vault clock');
  const timestamp = new Date(now).toISOString();
  const result = await db.prepare(`
    UPDATE capability_secrets
    SET status = 'revoked', iv_b64 = NULL, ciphertext_b64 = NULL,
        updated_at = ?, revoked_at = ?
    WHERE secret_id = ? AND principal_id = ? AND provider_id = ? AND status = 'active'
  `).bind(timestamp, timestamp, id, input.principalId, input.providerId).run();
  return result?.meta?.changes === 1;
}
