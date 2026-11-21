import test from 'node:test';
import assert from 'node:assert/strict';
import { selectModelRoute } from '../functions/lib/provider-routing.mjs';

const freeWorkers = {
  provider: 'workers-ai',
  model: 'llama-3.3-70b',
  priority: 20,
  enabled: true,
  healthy: true,
  quotaState: 'available',
  costClass: 'free',
  paidFallbackApproved: false,
  capabilities: ['chat', 'streaming'],
};

const paidOpenRouter = {
  provider: 'openrouter',
  model: 'provider/model',
  priority: 10,
  enabled: true,
  healthy: true,
  quotaState: 'available',
  costClass: 'paid',
  paidFallbackApproved: true,
  capabilities: ['chat', 'streaming', 'tools'],
};

test('free-only mode selects an eligible free provider even when a paid provider has higher priority', () => {
  const selected = selectModelRoute({
    mode: 'free-only',
    candidates: [paidOpenRouter, freeWorkers],
  });
  assert.deepEqual(selected, {
    provider: 'workers-ai',
    model: 'llama-3.3-70b',
    costClass: 'free',
    priority: 20,
    decision: 'eligible',
  });
});

test('free-only mode stops when free quota is exhausted instead of falling back to paid inference', () => {
  const selected = selectModelRoute({
    mode: 'free-only',
    candidates: [
      { ...freeWorkers, quotaState: 'exhausted' },
      paidOpenRouter,
    ],
  });
  assert.equal(selected, null);
});

test('paid inference requires both allow-paid mode and explicit provider approval', () => {
  assert.equal(selectModelRoute({
    mode: 'free-only',
    candidates: [paidOpenRouter],
  }), null);
  assert.equal(selectModelRoute({
    mode: 'allow-paid',
    candidates: [{ ...paidOpenRouter, paidFallbackApproved: false }],
  }), null);
  assert.equal(selectModelRoute({
    mode: 'allow-paid',
    candidates: [paidOpenRouter],
  }).provider, 'openrouter');
});

test('unhealthy, disabled, unknown-cost and unknown-quota candidates are never selected', () => {
  const candidates = [
    { ...freeWorkers, provider: 'unhealthy', healthy: false, priority: 1 },
    { ...freeWorkers, provider: 'disabled', enabled: false, priority: 2 },
    { ...freeWorkers, provider: 'unknown-cost', costClass: 'unknown', priority: 3 },
    { ...freeWorkers, provider: 'unknown-quota', quotaState: 'unknown', priority: 4 },
  ];
  assert.equal(selectModelRoute({ mode: 'free-only', candidates }), null);
});

test('required capabilities filter otherwise eligible providers', () => {
  const selected = selectModelRoute({
    mode: 'free-only',
    candidates: [freeWorkers, { ...freeWorkers, provider: 'free-tools', model: 'tool-model', capabilities: ['chat', 'streaming', 'tools'], priority: 30 }],
    requiredCapabilities: ['tools'],
  });
  assert.equal(selected.provider, 'free-tools');
});

test('selection is deterministic: priority first, then free before paid, then provider name', () => {
  const candidates = [
    { ...paidOpenRouter, provider: 'z-paid', priority: 5 },
    { ...freeWorkers, provider: 'z-free', priority: 5 },
    { ...freeWorkers, provider: 'a-free', priority: 5 },
  ];
  const input = { mode: 'allow-paid', candidates };
  assert.equal(selectModelRoute(input).provider, 'a-free');
  assert.equal(selectModelRoute(input).provider, 'a-free');
});

test('invalid policy modes, malformed candidates and duplicate provider/model pairs are rejected', () => {
  assert.throws(() => selectModelRoute({ mode: 'automatic', candidates: [freeWorkers] }), /mode/i);
  assert.throws(() => selectModelRoute({ mode: 'free-only', candidates: [{ ...freeWorkers, secret: 'must-not-be-accepted' }] }), /candidate/i);
  assert.throws(() => selectModelRoute({ mode: 'free-only', candidates: [freeWorkers, freeWorkers] }), /duplicate/i);
});

test('empty or unavailable candidate sets return no route without inventing a fallback', () => {
  assert.equal(selectModelRoute({ mode: 'free-only', candidates: [] }), null);
  assert.equal(selectModelRoute({ mode: 'free-only', candidates: [freeWorkers], requiredCapabilities: ['vision'] }), null);
});
