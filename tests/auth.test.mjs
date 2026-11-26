import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRevocableSessionToken,
  verifySessionToken,
  readSessionToken,
  isAuthorized,
  resolveSessionPrincipal,
  sessionCookie,
} from '../functions/lib/auth.mjs';
import { onRequestGet as loginGet, onRequestPost as loginPost, onRequestDelete as loginDelete } from '../functions/api/login.js';
import { onRequestPost as askPost } from '../functions/api/ask.js';
import { createPasswordCredential, verifyPasswordCredential, normalizeLoginIdentifier } from '../functions/lib/identity.mjs';
import {
  onRequestGet as memoryGet,
  onRequestPost as memoryPost,
  onRequestDelete as memoryDelete,
} from '../functions/api/memory.js';

const secret = 'test-only-session-secret-with-sufficient-entropy';
const fixedNow = 1_800_000_000_000;
const configuredEnv = {
  AEGIS_PASSWORD: 'a-long-test-password-value',
  AEGIS_SESSION_SECRET: secret,
};
const storedSessions = new Map();
const loginBuckets = new Map();
const sessionDb = {
  prepare(sql) {
    return { bind(...values) {
      return {
        run: async () => {
          if (sql.startsWith('INSERT INTO auth_sessions')) storedSessions.set(values[0], { expires_at: values[2], revoked_at: null, principal_id: values[3], tenant_id: values[4], roles_json: values[5] });
          else if (sql.startsWith('UPDATE auth_sessions')) { const row = storedSessions.get(values[1]); if (row) row.revoked_at = values[0]; }
          return { success: true };
        },
        first: async () => { const row = storedSessions.get(values[0]); return row && row.expires_at > values[1] && !row.revoked_at ? { session_id: values[0], principal_id: row.principal_id, tenant_id: row.tenant_id, roles_json: row.roles_json, role: JSON.parse(row.roles_json)[0] } : null; },
        all: async () => ({ results: sql.includes("aegis_tenant_memberships") ? [{ tenant_id: 'org-root', tenant_name: 'AEGIS Root Tenant', role: 'owner' }] : [] }),
      };
    }};
  },
};
const loginDb = {
  prepare(sql) {
    if (sql.includes("INSERT INTO login_attempts")) {
      return { bind(...values) { return { first: async () => {
        const [identityHash, now, updatedAt, cutoff, , , threshold, lockSeconds] = values;
        let row = loginBuckets.get(identityHash);
        if (!row || row.window_started_at <= cutoff) row = { window_started_at: now, attempts: 1, locked_until: 0 };
        else row = { ...row, attempts: row.attempts + 1 };
        if (row.attempts >= threshold) row.locked_until = now + lockSeconds;
        row.updated_at = updatedAt;
        loginBuckets.set(identityHash, row);
        return { attempts: row.attempts, locked_until: row.locked_until };
      }}; }};
    }
    if (sql.includes("DELETE FROM login_attempts")) {
      return { bind(identityHash) { return { run: async () => { loginBuckets.delete(identityHash); return { success: true }; } }; } };
    }
    return sessionDb.prepare(sql);
  },
};
const persistedEnv = { ...configuredEnv, AEGIS_DB: loginDb };
async function createLegacySignedToken(secret, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(now / 1000) + 12 * 60 * 60 })).toString('base64url');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return payload + '.' + Buffer.from(signature).toString('base64url');
}

async function issueStoredSession(now = Date.now()) {
  const session = await createRevocableSessionToken(secret, now);
  storedSessions.set(session.sessionId, { expires_at: session.expiresAt, revoked_at: null, principal_id: 'usr-root', tenant_id: 'org-root', roles_json: '[\"owner\"]' });
  return session.token;
}
const throttledEnv = { ...configuredEnv, AEGIS_DB: loginDb };

test('a newly created session token verifies before its expiry', async () => {
  const token = await issueStoredSession(fixedNow);
  assert.equal(await verifySessionToken(token, secret, fixedNow + 1_000, persistedEnv.AEGIS_DB), true);
});

test('an expired session token is rejected', async () => {
  const { token } = await createRevocableSessionToken(secret, fixedNow);
  assert.equal(await verifySessionToken(token, secret, fixedNow + 12 * 60 * 60 * 1000 + 1, persistedEnv.AEGIS_DB), false);
});

test('a modified session token is rejected', async () => {
  const { token } = await createRevocableSessionToken(secret, fixedNow);
  const [payload, signature] = token.split('.');
  const changedSignature = (signature[0] === 'A' ? 'B' : 'A') + signature.slice(1);
  assert.equal(await verifySessionToken(payload + '.' + changedSignature, secret, fixedNow, persistedEnv.AEGIS_DB), false);
});

test('session verification fails closed when the signing secret is missing', async () => {
  const { token } = await createRevocableSessionToken(secret, fixedNow);
  assert.equal(await verifySessionToken(token, '', fixedNow, persistedEnv.AEGIS_DB), false);
});

test('the session cookie is HttpOnly, Secure, SameSite Strict and host-only', () => {
  const cookie = sessionCookie('signed-token');
  assert.match(cookie, /^__Host-aegis_session=signed-token;/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Path=\//);
  assert.doesNotMatch(cookie, /Domain=/);
});

test('the session token is read from the named cookie only', () => {
  const request = new Request('https://aegis.example/', {
    headers: { Cookie: 'other=value; __Host-aegis_session=abc.def; another=x' },
  });
  assert.equal(readSessionToken(request), 'abc.def');
});

test('API authorization fails closed without a configured session secret', async () => {
  const request = new Request('https://aegis.example/');
  assert.equal(await isAuthorized(request, {}), false);
});

test('the login endpoint reports missing security configuration', async () => {
  const response = await loginGet({
    request: new Request('https://aegis.example/api/login'),
    env: {},
  });
  assert.equal(response.status, 503);
});

test('the login endpoint rejects an incorrect password', async () => {
  const response = await loginPost({
    request: new Request('https://aegis.example/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://aegis.example', 'CF-Connecting-IP': '192.0.2.10' },
      body: JSON.stringify({ password: 'wrong-password-value' }),
    }),
    env: throttledEnv,
  });
  assert.equal(response.status, 401);
});

test('successful login persists a revocable session accepted by the API guard', async () => {
  const response = await loginPost({
    request: new Request('https://aegis.example/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://aegis.example', 'CF-Connecting-IP': '192.0.2.10' },
      body: JSON.stringify({ password: configuredEnv.AEGIS_PASSWORD }),
    }),
    env: persistedEnv,
  });
  assert.equal(response.status, 200);
  const token = response.headers.get('Set-Cookie').match(/__Host-aegis_session=([^;]+)/)[1];
  const authenticatedRequest = new Request('https://aegis.example/api/ask', {
    headers: { Cookie: '__Host-aegis_session=' + token },
  });
  assert.equal(await isAuthorized(authenticatedRequest, persistedEnv), true);
  const sessionId = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8')).sid;
  assert.deepEqual(await resolveSessionPrincipal(authenticatedRequest, persistedEnv), { sid: sessionId, principalId: 'usr-root', tenantId: 'org-root', roles: ['owner'] });
});

test('cross-origin login attempts are rejected', async () => {
  const response = await loginPost({
    request: new Request('https://aegis.example/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://attacker.example' },
      body: JSON.stringify({ password: configuredEnv.AEGIS_PASSWORD }),
    }),
    env: configuredEnv,
  });
  assert.equal(response.status, 403);
});

test('the chat API rejects unauthenticated requests before calling the model', async () => {
  const response = await askPost({
    request: new Request('https://aegis.example/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'hello' }),
    }),
    env: { ...configuredEnv, AI: { run: async () => { throw new Error('must not run'); } } },
  });
  assert.equal(response.status, 401);
});

test('the memory read API rejects unauthenticated requests before reading KV', async () => {
  const response = await memoryGet({
    request: new Request('https://aegis.example/api/memory'),
    env: { ...configuredEnv, MEMORY: { get: async () => { throw new Error('must not read'); } } },
  });
  assert.equal(response.status, 401);
});

test('memory writes and deletes reject unauthenticated requests', async () => {
  const env = {
    ...configuredEnv,
    MEMORY: {
      get: async () => '[]',
      put: async () => { throw new Error('must not write'); },
      delete: async () => { throw new Error('must not delete'); },
    },
  };
  const post = await memoryPost({
    request: new Request('https://aegis.example/api/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: 'private note' }),
    }),
    env,
  });
  const del = await memoryDelete({
    request: new Request('https://aegis.example/api/memory', { method: 'DELETE' }),
    env,
  });
  assert.equal(post.status, 401);
  assert.equal(del.status, 401);
});


test('login rejects requests without an Origin header', async () => {
  const response = await loginPost({
    request: new Request('https://aegis.example/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: configuredEnv.AEGIS_PASSWORD }),
    }),
    env: configuredEnv,
  });
  assert.equal(response.status, 403);
});

test('memory writes reject cross-origin requests before changing KV', async () => {
  const token = await issueStoredSession();
  let writes = 0;
  const response = await memoryPost({
    request: new Request('https://aegis.example/api/memory', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://attacker.example',
        Cookie: '__Host-aegis_session=' + token,
      },
      body: JSON.stringify({ note: 'private note' }),
    }),
    env: { ...persistedEnv, MEMORY: { get: async () => '[]', put: async () => { writes += 1; } } },
  });
  assert.equal(response.status, 403);
  assert.equal(writes, 0);
});

test('memory deletes reject cross-origin requests before changing KV', async () => {
  const token = await issueStoredSession();
  let deletes = 0;
  const response = await memoryDelete({
    request: new Request('https://aegis.example/api/memory', {
      method: 'DELETE',
      headers: { Origin: 'https://attacker.example', Cookie: '__Host-aegis_session=' + token },
    }),
    env: { ...persistedEnv, MEMORY: { get: async () => '[]', put: async () => {}, delete: async () => { deletes += 1; } } },
  });
  assert.equal(response.status, 403);
  assert.equal(deletes, 0);
});


test('chat rejects cross-origin requests before invoking the model', async () => {
  const token = await issueStoredSession();
  let modelCalls = 0;
  const response = await askPost({
    request: new Request('https://aegis.example/api/ask', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://attacker.example',
        Cookie: '__Host-aegis_session=' + token,
      },
      body: JSON.stringify({ question: 'hello' }),
    }),
    env: { ...persistedEnv, AI: { run: async () => { modelCalls += 1; return { response: 'hello' }; } } },
  });
  assert.equal(response.status, 403);
  assert.equal(modelCalls, 0);
});


test('login refuses to issue a session when D1 session storage is unavailable', async () => {
  const response = await loginPost({
    request: new Request('https://aegis.example/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://aegis.example', 'CF-Connecting-IP': '192.0.2.10' },
      body: JSON.stringify({ password: configuredEnv.AEGIS_PASSWORD }),
    }),
    env: configuredEnv,
  });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('Set-Cookie'), null);
});

test('logout revokes the D1 session and clears the browser cookie', async () => {
  const login = await loginPost({
    request: new Request('https://aegis.example/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://aegis.example', 'CF-Connecting-IP': '192.0.2.10' },
      body: JSON.stringify({ password: configuredEnv.AEGIS_PASSWORD }),
    }),
    env: persistedEnv,
  });
  const token = login.headers.get('Set-Cookie').match(/__Host-aegis_session=([^;]+)/)[1];
  const cookie = '__Host-aegis_session=' + token;
  const request = new Request('https://aegis.example/api/ask', { headers: { Cookie: cookie } });
  assert.equal(await isAuthorized(request, persistedEnv), true);
  const { onRequestDelete } = await import('../functions/api/login.js');
  const logout = await onRequestDelete({
    request: new Request('https://aegis.example/api/login', { method: 'DELETE', headers: { Origin: 'https://aegis.example', Cookie: cookie } }),
    env: persistedEnv,
  });
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get('Set-Cookie') || '', /Max-Age=0/);
  assert.equal(await isAuthorized(request, persistedEnv), false);
});

test('a valid signed legacy token without sid is rejected even inside its former 12-hour window', async () => {
  const token = await createLegacySignedToken(secret, fixedNow);
  const request = new Request('https://aegis.example/api/ask', { headers: { Cookie: '__Host-aegis_session=' + token } });
  assert.equal(await verifySessionToken(token, secret, fixedNow + 1_000, persistedEnv.AEGIS_DB), false);
  assert.equal(await isAuthorized(request, persistedEnv, fixedNow + 1_000), false);
});

test('D1 session lookup errors fail closed', async () => {
  const { token } = await createRevocableSessionToken(secret, fixedNow);
  const request = new Request('https://aegis.example/api/ask', { headers: { Cookie: '__Host-aegis_session=' + token } });
  const brokenEnv = { ...configuredEnv, AEGIS_DB: { prepare() { throw new Error('D1 unavailable'); } } };
  assert.equal(await isAuthorized(request, brokenEnv, fixedNow + 1_000), false);
});


test('login blocks the sixth attempt from one client IP without revealing a different error', async () => {
  loginBuckets.clear();
  const makeRequest = password => new Request('https://aegis.example/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://aegis.example', 'CF-Connecting-IP': '198.51.100.44' },
    body: JSON.stringify({ password }),
  });
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await loginPost({ request: makeRequest('incorrect-password'), env: throttledEnv });
    assert.equal(response.status, 401);
    assert.equal(await response.text(), JSON.stringify({ error: 'Incorrect password.' }));
  }
  const blocked = await loginPost({ request: makeRequest(configuredEnv.AEGIS_PASSWORD), env: throttledEnv });
  assert.equal(blocked.status, 401);
  assert.equal(await blocked.text(), JSON.stringify({ error: 'Incorrect password.' }));
  assert.equal(blocked.headers.get('Set-Cookie'), null);
});

test('login throttling isolates client IPs and stores only keyed hashes', async () => {
  loginBuckets.clear();
  const request = new Request('https://aegis.example/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://aegis.example', 'CF-Connecting-IP': '203.0.113.88' },
    body: JSON.stringify({ password: configuredEnv.AEGIS_PASSWORD }),
  });
  const response = await loginPost({ request, env: throttledEnv });
  assert.equal(response.status, 200);
  assert.equal(loginBuckets.size, 0);
  assert.equal([...loginBuckets.keys()].includes('203.0.113.88'), false);
});

test('login protection fails closed when the trusted client IP is unavailable', async () => {
  const response = await loginPost({
    request: new Request('https://aegis.example/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://aegis.example' },
      body: JSON.stringify({ password: configuredEnv.AEGIS_PASSWORD }),
    }),
    env: throttledEnv,
  });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('Set-Cookie'), null);
});


test('ambiguous duplicate session cookies fail closed instead of selecting the first token', () => {
  const request = new Request('https://aegis.example/api/ask', {
    headers: {
      Cookie: '__Host-aegis_session=valid-looking.token; __Host-aegis_session=attacker.token',
    },
  });
  assert.equal(readSessionToken(request), null);
});


test('logout revokes the D1 session and D1 failure is reported instead of false success', async () => {
  const token = await issueStoredSession();
  const sid = [...storedSessions.keys()].at(-1);
  const response = await loginDelete({
    request: new Request('https://aegis.example/api/login', {
      method: 'DELETE',
      headers: { Origin: 'https://aegis.example', Cookie: '__Host-aegis_session=' + token },
    }),
    env: persistedEnv,
  });
  assert.equal(response.status, 200);
  assert.ok(storedSessions.get(sid).revoked_at);
  const replay = new Request('https://aegis.example/api/ask', {
    headers: { Cookie: '__Host-aegis_session=' + token },
  });
  assert.equal(await isAuthorized(replay, persistedEnv), false);

  const failing = await loginDelete({
    request: new Request('https://aegis.example/api/login', {
      method: 'DELETE',
      headers: { Origin: 'https://aegis.example', Cookie: '__Host-aegis_session=' + token },
    }),
    env: { ...persistedEnv, AEGIS_DB: { prepare() { return { bind() { return { run: async () => { throw new Error('D1 offline'); } }; } }; } } },
  });
  assert.equal(failing.status, 503);
  assert.match(failing.headers.get('Set-Cookie') || '', /Max-Age=0/);
});


test('verifySessionToken fails closed without D1 or without a matching active row', async () => {
  const token = await issueStoredSession();
  assert.equal(await verifySessionToken(token, secret), false);
  const emptyDb = { prepare() { return { bind() { return { first: async () => null }; } }; } };
  assert.equal(await verifySessionToken(token, secret, Date.now(), emptyDb), false);
});

test('PBKDF2 credentials use a fresh 16-byte salt and explicit algorithm version',async()=>{
 const a=await createPasswordCredential('governance-test-password-2026'),b=await createPasswordCredential('governance-test-password-2026');
 assert.equal(a.passwordAlgorithm,'PBKDF2-SHA256-v1'); assert.equal(a.passwordPepperVersion,'none');
 assert.equal(a.passwordIterations,210000); assert.equal(Buffer.from(a.passwordSalt,'base64url').length,16); assert.notEqual(a.passwordSalt,b.passwordSalt);
 const row={password_salt:a.passwordSalt,password_hash:a.passwordHash,password_iterations:a.passwordIterations,password_algorithm:a.passwordAlgorithm,password_pepper_version:a.passwordPepperVersion};
 assert.equal(await verifyPasswordCredential('governance-test-password-2026',row),true);
 assert.equal(await verifyPasswordCredential('incorrect-password',row),false);
});
test('PBKDF2 credentials require the configured pepper version',async()=>{
 const env={AEGIS_PASSWORD_PEPPER:'test-pepper-secret-with-at-least-32-bytes',AEGIS_PASSWORD_PEPPER_VERSION:'pepper-2026-01'};
 const c=await createPasswordCredential('peppered-governance-password-2026',env);
 const row={password_salt:c.passwordSalt,password_hash:c.passwordHash,password_iterations:c.passwordIterations,password_algorithm:c.passwordAlgorithm,password_pepper_version:c.passwordPepperVersion};
 assert.equal(await verifyPasswordCredential('peppered-governance-password-2026',row,env),true);
 assert.equal(await verifyPasswordCredential('peppered-governance-password-2026',row,{}),false);
 assert.equal(await verifyPasswordCredential('peppered-governance-password-2026',row,{...env,AEGIS_PASSWORD_PEPPER:'different-pepper-secret-with-32-bytes-minimum'}),false);
});
test('login identifiers normalize consistently',()=>{
 assert.equal(normalizeLoginIdentifier(' USER.Name+tag@Example.Test '),'user.name+tag@example.test');
 assert.equal(normalizeLoginIdentifier('User.Name'),'user.name');
 assert.equal(normalizeLoginIdentifier('../admin'),null);
 assert.equal(normalizeLoginIdentifier('x'.repeat(255)),null);
});

test('versioned pepper keyring verifies previous keys and rejects unknown versions',async()=>{
 const {passwordCredentialNeedsUpgrade}=await import('../functions/lib/identity.mjs');
 const v1={AEGIS_PASSWORD_PEPPER_KEYRING:JSON.stringify({v1:'first-pepper-material-with-at-least-32-bytes',v2:'second-pepper-material-with-at-least-32-bytes'}),AEGIS_PASSWORD_PEPPER_ACTIVE_VERSION:'v1'};
 const c=await createPasswordCredential('rotation-test-password-2026',v1);
 const row={password_salt:c.passwordSalt,password_hash:c.passwordHash,password_iterations:c.passwordIterations,password_algorithm:c.passwordAlgorithm,password_pepper_version:c.passwordPepperVersion};
 const v2={...v1,AEGIS_PASSWORD_PEPPER_ACTIVE_VERSION:'v2'};
 assert.equal(await verifyPasswordCredential('rotation-test-password-2026',row,v2),true);
 assert.equal(passwordCredentialNeedsUpgrade(row,v2),true);
 const unknown={...v2,AEGIS_PASSWORD_PEPPER_KEYRING:JSON.stringify({v2:'second-pepper-material-with-at-least-32-bytes'})};
 assert.equal(await verifyPasswordCredential('rotation-test-password-2026',row,unknown),false);
});

test('password rotation strength policy rejects low-diversity and short credentials',async()=>{
 const {isStrongPassword}=await import('../functions/lib/identity.mjs');
 assert.equal(isStrongPassword('short'),false);
 assert.equal(isStrongPassword('alllowercasepassword'),false);
 assert.equal(isStrongPassword('Strong-password-2026'),true);
});
test('successful login transparently rehashes a v1 credential to the active v2 pepper',async()=>{
 const {authenticatePrincipal}=await import('../functions/lib/identity.mjs');
 const v1={AEGIS_PASSWORD_PEPPER_KEYRING:JSON.stringify({v1:'first-pepper-material-with-at-least-32-bytes',v2:'second-pepper-material-with-at-least-32-bytes'}),AEGIS_PASSWORD_PEPPER_ACTIVE_VERSION:'v1'};
 const v2={...v1,AEGIS_PASSWORD_PEPPER_ACTIVE_VERSION:'v2'};
 const created=await createPasswordCredential('transparent-rehash-password-2026',v1);
 let row={principal_id:'usr-test',password_salt:created.passwordSalt,password_hash:created.passwordHash,password_iterations:created.passwordIterations,password_algorithm:created.passwordAlgorithm,password_pepper_version:created.passwordPepperVersion};
 const db={prepare(sql){return{bind(...values){return{
  first:async()=>sql.includes('aegis_principal_credentials')?{...row}:null,
  all:async()=>({results:[{tenant_id:'org-test',tenant_name:'Test',role:'member'}]}),
  run:async()=>{if(sql.startsWith('UPDATE aegis_principal_credentials'))row={...row,password_algorithm:values[0],password_pepper_version:values[1],password_salt:values[2],password_hash:values[3],password_iterations:values[4]};return{success:true};}
 };}};}};
 const account=await authenticatePrincipal(db,'person@example.test','transparent-rehash-password-2026',v2);
 assert.equal(account.principalId,'usr-test');assert.equal(row.password_pepper_version,'v2');
 assert.equal(await verifyPasswordCredential('transparent-rehash-password-2026',row,v2),true);
});

import { invitationState } from '../functions/api/tenants/invitations.js';

test('invitation lifecycle rejects expired and consumed tokens deterministically',()=>{
 const now=1_800_000_000;
 assert.equal(invitationState({expires_at:now-1,accepted_at:null},now),'expired');
 assert.equal(invitationState({expires_at:now+60,accepted_at:'2026-11-26T00:00:00.000Z'},now),'used');
 assert.equal(invitationState({expires_at:now+60,accepted_at:null},now),'active');
});
