import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMPANION_STATES,
  createSphereGeometry,
  normaliseVisemes,
  normaliseExpression,
  createCompanionRenderer,
} from '../companion/renderer.mjs';

test('procedural avatar sphere geometry is finite, indexed and has unit normals', () => {
  const geometry = createSphereGeometry(16, 12);
  assert.equal(geometry.positions.length, (16 + 1) * (12 + 1) * 3);
  assert.equal(geometry.normals.length, geometry.positions.length);
  assert.equal(geometry.indices.length, 16 * 12 * 6);
  for (const value of geometry.positions) assert.ok(Number.isFinite(value));
  for (let i = 0; i < geometry.normals.length; i += 3) {
    const length = Math.hypot(geometry.normals[i], geometry.normals[i + 1], geometry.normals[i + 2]);
    assert.ok(Math.abs(length - 1) < 1e-5);
  }
});

test('viseme weights are allowlisted, finite and clamped to the renderer contract', () => {
  assert.deepEqual(normaliseVisemes({ aa: 1.4, ee: -2, jawOpen: 0.35, injected: 1, oh: 'loud' }), {
    aa: 1, ee: 0, ih: 0, oh: 0, ou: 0, jawOpen: 0.35,
  });
});

test('expression input accepts only known expression IDs and bounded weights', () => {
  assert.deepEqual(normaliseExpression('smile', 1.8), { id: 'smile', weight: 1 });
  assert.deepEqual(normaliseExpression('unknown', 0.5), { id: 'neutral', weight: 0 });
  assert.deepEqual(normaliseExpression('focused', Number.NaN), { id: 'neutral', weight: 0 });
});

test('companion presence states are presentation-only and do not expose action authority', () => {
  assert.deepEqual(COMPANION_STATES, ['idle', 'listening', 'thinking', 'speaking', 'responding', 'interrupted', 'paused', 'disconnected', 'error']);
  assert.equal('execute' in COMPANION_STATES, false);
});

test('renderer fails closed to the CSS fallback when WebGL2 is unavailable', () => {
  const canvas = { getContext: () => null };
  const renderer = createCompanionRenderer(canvas);
  assert.equal(renderer.init().supported, false);
  assert.equal(renderer.init().reason, 'webgl2-unavailable');
  assert.equal(renderer.dispose(), true);
  assert.equal(renderer.dispose(), true);
});
