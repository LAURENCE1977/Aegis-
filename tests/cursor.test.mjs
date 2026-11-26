import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeSignedCursor, verifyAndDecodeCursor } from '../functions/lib/cursor.js';

const secret = 'cursor-pagination-test-secret-with-at-least-32-bytes';
const scope = { tenant_id: 'org-root', principal_id: 'usr-root', project_id: null };
const filters = { review: false };
const row = { updated_at: '2026-11-26T19:00:00.000Z', id: 'memory-001' };

test('signed cursor round-trips its position and authenticated scope', async () => {
  const cursor = await encodeSignedCursor(row, scope, filters, secret);
  const payload = await verifyAndDecodeCursor(cursor, scope, filters, secret);
  assert.equal(payload.updated_at, row.updated_at);
  assert.equal(payload.id, row.id);
  assert.equal(payload.tenant_id, scope.tenant_id);
  assert.equal(payload.principal_id, scope.principal_id);
  assert.equal(payload.project_id, null);
  assert.equal(payload.review, false);
});

test('cursor rejects missing or weak signing secrets', async () => {
  const cursor = await encodeSignedCursor(row, scope, filters, secret);
  await assert.rejects(() => encodeSignedCursor(row, scope, filters, ''), /CURSOR_SIGNING_SECRET/);
  await assert.rejects(() => encodeSignedCursor(row, scope, filters, 'short'), /32 bytes/);
  assert.equal(await verifyAndDecodeCursor(cursor, scope, filters, undefined), null);
  const payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(
    atob(cursor.split('.')[0].replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - cursor.split('.')[0].length % 4) % 4)),
    character => character.charCodeAt(0),
  )));
  assert.equal(payload.exp - payload.iat, 86400);
});

test('cursor rejects signature tampering and non-canonical Base64URL', async () => {
  const cursor = await encodeSignedCursor(row, scope, filters, secret);
  const [payload, signature] = cursor.split('.');
  const changed = (signature[0] === 'A' ? 'B' : 'A') + signature.slice(1);
  assert.equal(await verifyAndDecodeCursor(payload + '.' + changed, scope, filters, secret), null);
  assert.equal(await verifyAndDecodeCursor(payload + '.!!!!', scope, filters, secret), null);
  assert.equal(await verifyAndDecodeCursor(payload + '.' + signature + '=', scope, filters, secret), null);
});

test('cursor rejects signatures that are not exactly 32 bytes', async () => {
  const cursor = await encodeSignedCursor(row, scope, filters, secret);
  const [payload] = cursor.split('.');
  assert.equal(await verifyAndDecodeCursor(payload + '.AQ', scope, filters, secret), null);
});

test('cursor rejects tenant, principal, project and review filter replay', async () => {
  const cursor = await encodeSignedCursor(row, scope, filters, secret);
  assert.equal(await verifyAndDecodeCursor(cursor, { ...scope, tenant_id: 'org-other' }, filters, secret), null);
  assert.equal(await verifyAndDecodeCursor(cursor, { ...scope, principal_id: 'usr-other' }, filters, secret), null);
  assert.equal(await verifyAndDecodeCursor(cursor, { ...scope, project_id: 'project-a' }, filters, secret), null);
  assert.equal(await verifyAndDecodeCursor(cursor, scope, { review: true }, secret), null);
});

test('cursor rejects malformed D1 timestamps and malformed positions at issuance', async () => {
  await assert.rejects(() => encodeSignedCursor({ ...row, updated_at: '2026-11-26' }, scope, filters, secret), /timestamp/i);
  await assert.rejects(() => encodeSignedCursor({ ...row, id: 'bad id' }, scope, filters, secret), /identifier/i);
});

test('cursor rejects expired, future-issued and TTL-out-of-policy payloads', async () => {
  const cursor = await encodeSignedCursor(row, scope, filters, secret);
  const originalNow = Date.now;
  try {
    Date.now = () => originalNow() + (25 * 60 * 60 * 1000);
    assert.equal(await verifyAndDecodeCursor(cursor, scope, filters, secret), null);
  } finally {
    Date.now = originalNow;
  }
});

test('cursor rejects oversized and structurally malformed tokens', async () => {
  assert.equal(await verifyAndDecodeCursor('x'.repeat(513), scope, filters, secret), null);
  assert.equal(await verifyAndDecodeCursor('one.two.three', scope, filters, secret), null);
  assert.equal(await verifyAndDecodeCursor('', scope, filters, secret), null);
});
