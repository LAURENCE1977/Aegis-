import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPasswordCredential,
  verifyPasswordCredential,
  normalizeLoginIdentifier,
} from '../functions/lib/identity.mjs';

test('principal password credentials use salted PBKDF2 and verify only the exact password', async () => {
  const credential = await createPasswordCredential('correct-horse-battery-staple');
  assert.equal(credential.passwordIterations, 210000);
  assert.notEqual(credential.passwordSalt, credential.passwordHash);
  assert.equal(await verifyPasswordCredential('correct-horse-battery-staple', {
    password_salt: credential.passwordSalt,
    password_hash: credential.passwordHash,
    password_iterations: credential.passwordIterations,
  }), true);
  assert.equal(await verifyPasswordCredential('incorrect-password-value', {
    password_salt: credential.passwordSalt,
    password_hash: credential.passwordHash,
    password_iterations: credential.passwordIterations,
  }), false);
});

test('principal password hashing rejects weak or oversized passwords', async () => {
  await assert.rejects(() => createPasswordCredential('short'), /between 12 and 1024/);
  await assert.rejects(() => createPasswordCredential('x'.repeat(1025)), /between 12 and 1024/);
});

test('login identifiers are canonicalized and reject malformed values', () => {
  assert.equal(normalizeLoginIdentifier('  Admin.User+1@Example.test '), 'admin.user+1@example.test');
  assert.equal(normalizeLoginIdentifier('a'), null);
  assert.equal(normalizeLoginIdentifier('bad..name@example.test'), null);
  assert.equal(normalizeLoginIdentifier('name; DROP TABLE users'), null);
});
