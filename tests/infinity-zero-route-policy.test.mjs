import test from 'node:test';
import assert from 'node:assert/strict';
import { decideInfinityZeroRoute } from '../workers/runtime/infinity-zero-route-policy.mjs';

const digest = 'a'.repeat(64);
const candidate = (id, costClass, extra = {}) => ({
  id,
  costClass,
  available: true,
  suitable: true,
  qualityAdequate: true,
  termsVerified: costClass !== 'no_charge',
  quotaAvailable: costClass !== 'no_charge',
  ...extra,
});
const input = candidates => ({ mode: 'infinity_zero', taskDigest: digest, candidates });

test('prefers deterministic capability over local and no-charge hosted routes', () => {
  const result = decideInfinityZeroRoute(input([
    candidate('hosted', 'no_charge', { termsVerified: true, quotaAvailable: true }),
    candidate('local', 'local'),
    candidate('rules', 'deterministic'),
  ]));
  assert.equal(result.decision, 'selected');
  assert.equal(result.routeId, 'rules');
  assert.equal(result.costClass, 'deterministic');
  assert.equal(result.paidFallback, 'disabled');
});

test('selects local compute before a no-charge hosted allowance', () => {
  const result = decideInfinityZeroRoute(input([
    candidate('hosted', 'no_charge', { termsVerified: true, quotaAvailable: true }),
    candidate('device-model', 'local'),
  ]));
  assert.equal(result.routeId, 'device-model');
  assert.equal(result.costClass, 'local');
});

test('uses no-charge hosted route only when current terms and quota are verified', () => {
  const usable = decideInfinityZeroRoute(input([
    candidate('hosted', 'no_charge', { termsVerified: true, quotaAvailable: true }),
  ]));
  assert.equal(usable.routeId, 'hosted');

  for (const extra of [
    { termsVerified: false, quotaAvailable: true },
    { termsVerified: true, quotaAvailable: false },
  ]) {
    const blocked = decideInfinityZeroRoute(input([
      candidate('hosted', 'no_charge', extra),
    ]));
    assert.equal(blocked.decision, 'blocked');
    assert.equal(blocked.routeId, null);
  }
});

test('never silently falls back to metered or unknown-cost routes', () => {
  const result = decideInfinityZeroRoute(input([
    candidate('paid-api', 'metered'),
    candidate('mystery-api', 'unknown'),
  ]));
  assert.equal(result.decision, 'blocked');
  assert.equal(result.routeId, null);
  assert.equal(result.reason, 'no_eligible_zero_cost_route');
});

test('skips unavailable, unsuitable or quality-inadequate free candidates', () => {
  const result = decideInfinityZeroRoute(input([
    candidate('offline-local', 'local', { available: false }),
    candidate('wrong-task', 'deterministic', { suitable: false }),
    candidate('weak-model', 'local', { qualityAdequate: false }),
  ]));
  assert.equal(result.decision, 'blocked');
});

test('is deterministic regardless of candidate input order', () => {
  const a = decideInfinityZeroRoute(input([
    candidate('local-z', 'local'),
    candidate('local-a', 'local'),
  ]));
  const b = decideInfinityZeroRoute(input([
    candidate('local-a', 'local'),
    candidate('local-z', 'local'),
  ]));
  assert.equal(a.routeId, 'local-a');
  assert.deepEqual(a, b);
});

test('rejects malformed modes, digests, candidate identities and unknown fields', () => {
  assert.throws(() => decideInfinityZeroRoute({ ...input([]), mode: 'automatic_paid' }));
  assert.throws(() => decideInfinityZeroRoute({ ...input([]), taskDigest: 'not-a-digest' }));
  assert.throws(() => decideInfinityZeroRoute({ ...input([candidate('good', 'local')]), unexpected: true }));
  assert.throws(() => decideInfinityZeroRoute(input([candidate('../paid', 'local')])));
});

test('rejects accessor-backed inputs without invoking getters', () => {
  let invoked = false;
  const item = candidate('local', 'local');
  Object.defineProperty(item, 'available', {
    enumerable: true,
    get() { invoked = true; return true; },
  });
  assert.throws(() => decideInfinityZeroRoute(input([item])));
  assert.equal(invoked, false);
});

test('returns immutable decisions bound to the task digest', () => {
  const result = decideInfinityZeroRoute(input([candidate('rules', 'deterministic')]));
  assert.equal(result.taskDigest, digest);
  assert.equal(Object.isFrozen(result), true);
});
