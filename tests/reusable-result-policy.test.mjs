import test from 'node:test';
import assert from 'node:assert/strict';
import { decideReusableResult } from '../workers/runtime/reusable-result-policy.mjs';

const digest = (char) => char.repeat(64);
const now = '2026-11-21T17:20:00.000Z';
const valid = (overrides = {}) => ({
  taskDigest: digest('a'),
  inputDigest: digest('b'),
  scopeDigest: digest('c'),
  cachedTaskDigest: digest('a'),
  cachedInputDigest: digest('b'),
  cachedScopeDigest: digest('c'),
  resultDigest: digest('d'),
  sourceDigest: digest('e'),
  currentSourceDigest: digest('e'),
  verificationStatus: 'verified',
  sensitivity: 'internal',
  verifiedAt: '2026-11-21T17:00:00.000Z',
  expiresAt: '2026-11-21T18:00:00.000Z',
  now,
  ...overrides,
});

test('reuses a verified result only when task, inputs, scope and source all match', () => {
  const result = decideReusableResult(valid());
  assert.equal(result.decision, 'reuse');
  assert.equal(result.reason, 'verified_exact_match');
  assert.equal(result.resultDigest, digest('d'));
  assert.equal(Object.isFrozen(result), true);
});

test('requires exact task and input digests', () => {
  assert.equal(decideReusableResult(valid({ cachedTaskDigest: digest('f') })).reason, 'task_changed');
  assert.equal(decideReusableResult(valid({ cachedInputDigest: digest('f') })).reason, 'inputs_changed');
});

test('never reuses a result across owner or project scopes', () => {
  const result = decideReusableResult(valid({ cachedScopeDigest: digest('f') }));
  assert.equal(result.decision, 'recompute');
  assert.equal(result.reason, 'scope_mismatch');
});

test('invalidates a result when its source revision changes', () => {
  assert.equal(decideReusableResult(valid({ currentSourceDigest: digest('f') })).reason, 'source_changed');
});

test('does not reuse unverified or restricted results', () => {
  assert.equal(decideReusableResult(valid({ verificationStatus: 'candidate' })).reason, 'not_verified');
  assert.equal(decideReusableResult(valid({ sensitivity: 'restricted' })).reason, 'restricted_data');
});

test('does not reuse expired or not-yet-verified results', () => {
  assert.equal(decideReusableResult(valid({ expiresAt: '2026-11-21T17:19:59.999Z' })).reason, 'expired');
  assert.equal(decideReusableResult(valid({ verifiedAt: '2026-11-21T17:20:00.001Z' })).reason, 'not_yet_verified');
});

test('rejects malformed digests, timestamps, unknown fields and invalid classifications', () => {
  assert.throws(() => decideReusableResult(valid({ resultDigest: 'bad' })));
  assert.throws(() => decideReusableResult(valid({ now: 'not-a-date' })));
  assert.throws(() => decideReusableResult(valid({ surprise: true })));
  assert.throws(() => decideReusableResult(valid({ sensitivity: 'publicly-share-everything' })));
});

test('rejects accessor-backed fields without invoking getters', () => {
  let invoked = false;
  const input = valid();
  Object.defineProperty(input, 'cachedInputDigest', {
    enumerable: true,
    get() { invoked = true; return digest('b'); },
  });
  assert.throws(() => decideReusableResult(input));
  assert.equal(invoked, false);
});
