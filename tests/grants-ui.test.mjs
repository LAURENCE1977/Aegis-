import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('Security Centre exposes the owner grant controls and live status regions', () => {
  for (const id of [
    'grantForm',
    'grantCapabilitySelect',
    'grantActionSelect',
    'grantResourceId',
    'grantExpiresAt',
    'createGrantBtn',
    'grantStatus',
    'grantList',
  ]) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }
});

test('inline browser scripts remain syntactically valid after grant UI changes', () => {
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
    .map(match => match[1])
    .filter(source => source.trim());
  assert.ok(scripts.length > 0);
  scripts.forEach((source, index) => {
    assert.doesNotThrow(() => new vm.Script(source, { filename: 'index.html inline script ' + index }));
  });
});

test('grant UI calls the owner-only API and never sends caller-supplied scopes or principal IDs', () => {
  assert.match(html, /controlApi\('\/api\/grants'\)/);
  assert.match(html, /method: 'DELETE'/);
  assert.match(html, /method: 'POST'/);
  assert.match(html, /actionIds,/);
  assert.doesNotMatch(html, /scopes:\s*grantActionSelect/);
  assert.doesNotMatch(html, /principalId:\s*['"]owner['"]/);
});
