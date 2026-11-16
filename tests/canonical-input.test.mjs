import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalizeInput, digestCanonicalInput } from '../functions/lib/canonical-input.mjs';

test('canonicalizes object keys independent of insertion order', () => {
  assert.equal(canonicalizeInput({ z: 1, a: { y: true, x: 'ok' } }),
    canonicalizeInput({ a: { x: 'ok', y: true }, z: 1 }));
});

test('produces stable SHA-256 digests for equivalent JSON input', async () => {
  const left = await digestCanonicalInput({ action: 'read', args: { b: 2, a: 1 } });
  const right = await digestCanonicalInput({ args: { a: 1, b: 2 }, action: 'read' });
  assert.equal(left, right);
  assert.match(left, /^sha256:[a-f0-9]{64}$/);
});

test('distinguishes different input payloads', async () => {
  assert.notEqual(
    await digestCanonicalInput({ amount: 1 }),
    await digestCanonicalInput({ amount: 2 }),
  );
});

test('rejects non-JSON values, non-finite numbers and non-plain objects', () => {
  for (const value of [
    undefined, 1n, () => {}, Symbol('x'), NaN, Infinity,
    new Date('2026-01-01T00:00:00.000Z'),
  ]) assert.throws(() => canonicalizeInput(value));
});

test('rejects cycles, excessive nesting, sparse arrays and oversized payloads', () => {
  const cycle = {}; cycle.self = cycle;
  assert.throws(() => canonicalizeInput(cycle), /cycle/i);
  let deep = {};
  for (let i = 0; i < 20; i += 1) deep = { child: deep };
  assert.throws(() => canonicalizeInput(deep), /depth/i);
  const sparse = new Array(2); sparse[1] = 'x';
  assert.throws(() => canonicalizeInput(sparse), /array/i);
  assert.throws(() => canonicalizeInput({ text: 'x'.repeat(70_000) }), /size/i);
});

test('rejects prototype-pollution keys and exotic object properties', () => {
  const polluted = JSON.parse('{"__proto__":{"admin":true}}');
  assert.throws(() => canonicalizeInput(polluted), /key/i);
  const hidden = {};
  Object.defineProperty(hidden, 'secret', { value: 'x', enumerable: false });
  assert.throws(() => canonicalizeInput(hidden), /property/i);
});
