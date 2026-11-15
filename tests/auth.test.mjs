import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSessionToken,
  verifySessionToken,
  readSessionToken,
  isAuthorized,
  sessionCookie,
} from '../functions/lib/auth.mjs';

const secret = 'test-only-session-secret-with-sufficient-entropy';
const fixedNow = 1_800_000_000_000;

test('a newly created session token verifies before its expiry', async () => {
  const token = await createSessionToken(secret, fixedNow);
  assert.equal(await verifySessionToken(token, secret, fixedNow + 1_000), true);
});

test('an expired session token is rejected', async () => {
  const token = await createSessionToken(secret, fixedNow);
  assert.equal(await verifySessionToken(token, secret, fixedNow + 12 * 60 * 60 * 1000 + 1), false);
});

test('a modified session token is rejected', async () => {
  const token = await createSessionToken(secret, fixedNow);
  const [payload, signature] = token.split('.');
  const changedSignature = (signature[0] === 'A' ? 'B' : 'A') + signature.slice(1);
  assert.equal(await verifySessionToken(payload + '.' + changedSignature, secret, fixedNow), false);
});

test('session verification fails closed when the signing secret is missing', async () => {
  const token = await createSessionToken(secret, fixedNow);
  assert.equal(await verifySessionToken(token, '', fixedNow), false);
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
