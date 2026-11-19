import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../reviewer.html', import.meta.url), 'utf8');

test('standalone reviewer portal has its own sign-in and does not depend on the owner login', () => {
  assert.match(html, /Independent reviewer sign-in/);
  assert.match(html, /\/api\/reviewer-login/);
  assert.match(html, /reviewerPassword/);
  assert.doesNotMatch(html, /AEGIS_PASSWORD|__Host-aegis_session/);
});

test('reviewer portal can read pending approvals and the Guardian catalogue with reviewer credentials only', () => {
  assert.match(html, /\/api\/approvals/);
  assert.match(html, /\/api\/guardian\/resources\?limit=100/);
  assert.match(html, /\/api\/guardian\/resources\//);
});

test('reviewer portal records decisions but never authorises or executes agent runs', () => {
  assert.match(html, /\/api\/sentinel\/agent-run-approval\//);
  assert.match(html, /\/api\/approvals/);
  assert.match(html, /Owner must still authorise/);
  assert.match(html, /No execution started/);
  assert.doesNotMatch(html, /\/authorize/);
});

test('reviewer portal uses text-safe rendering and offers explicit sign-out', () => {
  assert.match(html, /textContent/);
  assert.match(html, /reviewerLogout/);
  assert.match(html, /method:\s*'DELETE'/);
  assert.doesNotMatch(html, /innerHTML/);
});
