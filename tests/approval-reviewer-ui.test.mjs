import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('approval inbox exposes a separate reviewer sign-in without collecting owner credentials', () => {
  assert.match(html, /id="reviewerLoginForm"/);
  assert.match(html, /id="reviewerPassword" type="password"/);
  assert.match(html, /fetch\('\/api\/reviewer-login'/);
  assert.match(html, /reviewerResponse\.ok && reviewerData\.authenticated === true/);
  assert.match(html, /reviewerLoginForm\.addEventListener\('submit'/);
  assert.match(html, /reviewerLogoutBtn\.addEventListener\('click'/);
});

test('approval decision controls are rendered only for a live reviewer session', () => {
  assert.match(html, /if \(!approval\.expired && reviewerAuthenticated\)/);
  assert.match(html, /Independent reviewer sign-in is required before this decision can be recorded/);
  assert.match(html, /reviewer sign-in required for decisions/);
});

test('reviewer password is not persisted in browser storage', () => {
  assert.doesNotMatch(html, /localStorage\.(?:setItem|getItem)\([^\n]*reviewerPassword/i);
  assert.doesNotMatch(html, /sessionStorage\.(?:setItem|getItem)\([^\n]*reviewerPassword/i);
});
