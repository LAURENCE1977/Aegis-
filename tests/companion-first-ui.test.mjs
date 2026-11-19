import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSphereGeometry } from '../companion/renderer.mjs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('signed-in AEGIS workspace exposes a dedicated companion Home surface', () => {
  assert.match(html, /id="homeTab"/);
  assert.match(html, /id="homeSection"/);
  assert.match(html, /id="companionVisual"/);
  assert.match(html, /data-presence="idle"/);
});

test('companion renderer is loaded by the actual AEGIS page as a browser module', () => {
  assert.match(html, /<script\s+type="module"\s+src="\/companion\/renderer\.mjs"><\/script>/);
});

test('Home is the default signed-in view and all existing workspace panels remain navigable', () => {
  assert.match(html, /function showApp\(\)[\s\S]*?showPanel\('home'\)/);
  assert.match(html, /homeSection\.hidden = panel !== 'home'/);
  assert.match(html, /homeTab\.addEventListener\('click',\s*\(\)\s*=>\s*showPanel\('home'\)\)/);
  for (const panel of ['chat', 'projects', 'memory', 'approvals', 'forge', 'security']) {
    assert.match(html, new RegExp("showPanel\\('" + panel + "'\\)"));
  }
});

test('companion surface discloses prototype status and does not imply microphone or camera capture', () => {
  assert.match(html, /Procedural 3D companion prototype/);
  assert.match(html, /No microphone or camera access is active/);
  assert.doesNotMatch(html, /getUserMedia\s*\(/);
});

test('the browser renderer module imports and exposes bounded procedural geometry', () => {
  const geometry = createSphereGeometry(8, 6);
  assert.equal(geometry.positions.length, 9 * 7 * 3);
  assert.equal(geometry.normals.length, geometry.positions.length);
  assert.equal(geometry.indices.length, 8 * 6 * 6);
});
