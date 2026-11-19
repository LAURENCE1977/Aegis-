import test from 'node:test';
import assert from 'node:assert/strict';
import { getFreshVisemes } from '../companion/renderer.mjs';

test('fresh viseme weights remain available to the renderer', () => {
  const result = getFreshVisemes({ aa: 0.7, jawOpen: 0.4 }, 1000, 1100);
  assert.equal(result.aa, 0.7);
  assert.equal(result.jawOpen, 0.4);
  assert.equal(result.ee, 0);
});

test('stale viseme weights expire instead of leaving the avatar mouth open', () => {
  const result = getFreshVisemes({ aa: 1, jawOpen: 1 }, 1000, 1300, 250);
  assert.deepEqual(result, { aa: 0, ee: 0, ih: 0, oh: 0, ou: 0, jawOpen: 0 });
});

test('future or invalid receive times fail closed to neutral mouth weights', () => {
  const expected = { aa: 0, ee: 0, ih: 0, oh: 0, ou: 0, jawOpen: 0 };
  assert.deepEqual(getFreshVisemes({ aa: 1 }, 1200, 1100), expected);
  assert.deepEqual(getFreshVisemes({ aa: 1 }, Number.NaN, 1100), expected);
});
