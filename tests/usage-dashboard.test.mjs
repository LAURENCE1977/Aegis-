import test from 'node:test';
import assert from 'node:assert/strict';
import { buildUsageDashboard } from '../functions/lib/usage-dashboard.mjs';

const now = '2026-11-22T19:00:00.000Z';

const windowRow = (overrides = {}) => ({
  id: 'quota-qwen-001',
  provider_id: 'alibaba-qwen',
  model_id: 'qwen3.8-flash',
  unit_kind: 'tokens',
  window_start: '2026-11-22T00:00:00.000Z',
  window_end: '2026-11-23T00:00:00.000Z',
  limit_units: 100000,
  verified_at: '2026-11-22T18:30:00.000Z',
  status: 'enabled',
  settled_units: 12000,
  reserved_units: 8000,
  ...overrides,
});

test('reports remaining quota after settled usage and open reservations', () => {
  const result = buildUsageDashboard({
    windows: [windowRow()],
    reservations: [{ provider_id: 'alibaba-qwen', model_id: 'qwen3.8-flash', reserved_units: 8000, status: 'reserved' }],
    now,
    paidInferenceApproved: 'true',
    maxTokensPerRun: '5000',
  });
  assert.equal(result.windows[0].remainingUnits, 80000);
  assert.equal(result.windows[0].settledUnits, 12000);
  assert.equal(result.windows[0].reservedUnits, 8000);
  assert.equal(result.windows[0].status, 'verified');
  assert.equal(result.paidInference.enabledByDeploymentGate, true);
  assert.equal(result.paidInference.maxTokensPerRun, 5000);
  assert.equal(result.paidInference.canAuthorisePaidRun, true);
});

test('does not report remaining quota from a stale verification', () => {
  const result = buildUsageDashboard({
    windows: [windowRow({ verified_at: '2026-11-21T18:00:00.000Z' })],
    reservations: [],
    now,
    paidInferenceApproved: 'true',
    maxTokensPerRun: '5000',
  });
  assert.equal(result.windows[0].status, 'stale');
  assert.equal(result.windows[0].remainingUnits, null);
  assert.equal(result.paidInference.canAuthorisePaidRun, false);
});

test('does not treat a future verification timestamp as verified', () => {
  const result = buildUsageDashboard({
    windows: [windowRow({ verified_at: '2026-11-22T19:01:00.000Z' })],
    reservations: [],
    now,
    paidInferenceApproved: 'true',
    maxTokensPerRun: '5000',
  });
  assert.equal(result.windows[0].status, 'unverified');
  assert.equal(result.windows[0].remainingUnits, null);
  assert.equal(result.paidInference.canAuthorisePaidRun, false);
});

test('fails closed when no current provider quota exists or the finite ceiling is missing', () => {
  const result = buildUsageDashboard({
    windows: [],
    reservations: [],
    now,
    paidInferenceApproved: 'true',
    maxTokensPerRun: '',
  });
  assert.equal(result.windows.length, 0);
  assert.equal(result.paidInference.canAuthorisePaidRun, false);
  assert.equal(result.paidInference.maxTokensPerRun, null);
});

test('counts reservations against the limit and never exposes reservation identifiers', () => {
  const result = buildUsageDashboard({
    windows: [windowRow({ settled_units: 30000, reserved_units: 60000 })],
    reservations: [
      { provider_id: 'alibaba-qwen', model_id: 'qwen3.8-flash', reserved_units: 60000, status: 'reserved', id: 'secret-reservation-id' },
    ],
    now,
    paidInferenceApproved: 'true',
    maxTokensPerRun: '5000',
  });
  assert.equal(result.windows[0].remainingUnits, 10000);
  assert.equal(JSON.stringify(result).includes('secret-reservation-id'), false);
  assert.equal(result.windows[0].reservedUnits, 60000);
});

test('does not mix different providers, models, units or inactive windows', () => {
  const result = buildUsageDashboard({
    windows: [
      windowRow(),
      windowRow({ id: 'quota-other', provider_id: 'anthropic', model_id: 'claude-model' }),
      windowRow({ id: 'quota-neurons', unit_kind: 'neurons' }),
      windowRow({ id: 'quota-expired', window_end: '2026-11-22T18:59:59.000Z' }),
    ],
    reservations: [],
    now,
    paidInferenceApproved: 'true',
    maxTokensPerRun: '5000',
  });
  assert.equal(result.windows.length, 1);
  assert.equal(result.windows[0].providerId, 'alibaba-qwen');
});
