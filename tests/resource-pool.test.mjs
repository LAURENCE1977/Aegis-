import test from 'node:test';
import assert from 'node:assert/strict';
import { buildResourcePoolSnapshot, readResourcePoolSnapshot } from '../functions/lib/resource-pool.mjs';

const now = '2026-11-22T04:00:00.000Z';
const tokenWindow = {
  quotaWindowId: 'quota-openrouter-model-a',
  providerId: 'openrouter',
  modelId: 'model-a',
  unitKind: 'tokens',
  windowStart: '2026-11-22T00:00:00.000Z',
  windowEnd: '2026-11-23T00:00:00.000Z',
  limitUnits: 10000,
  usedUnits: 2500,
  sourceUrl: 'https://provider.example/limits',
  verifiedAt: '2026-11-22T03:00:00.000Z',
  status: 'enabled',
};

test('builds one view while preserving tokens and neurons as separate resource units', () => {
  const snapshot = buildResourcePoolSnapshot({
    rows: [
      tokenWindow,
      { ...tokenWindow, quotaWindowId: 'quota-workers-neurons', providerId: 'cloudflare', modelId: 'workers-ai', unitKind: 'neurons', limitUnits: 900000, usedUnits: 300000 },
    ],
    now,
  });

  assert.equal(snapshot.schemaVersion, 'aegis.resource-pool.v1');
  assert.equal(snapshot.budgets.length, 2);
  assert.deepEqual(snapshot.budgets.map(item => item.unitKind), ['neurons', 'tokens']);
  assert.equal(snapshot.budgets.find(item => item.unitKind === 'tokens').remainingUnits, 7500);
  assert.equal(snapshot.budgets.find(item => item.unitKind === 'neurons').remainingUnits, 600000);
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.budgets), true);
});

test('excludes disabled, expired, future and stale quota observations', () => {
  const snapshot = buildResourcePoolSnapshot({
    rows: [
      tokenWindow,
      { ...tokenWindow, quotaWindowId: 'expired', windowEnd: '2026-11-22T03:59:59.999Z' },
      { ...tokenWindow, quotaWindowId: 'future', windowStart: '2026-11-22T04:00:00.001Z' },
      { ...tokenWindow, quotaWindowId: 'stale', verifiedAt: '2026-11-20T00:00:00.000Z' },
      { ...tokenWindow, quotaWindowId: 'future-verified', verifiedAt: '2026-11-22T04:00:00.001Z' },
      { ...tokenWindow, quotaWindowId: 'disabled', status: 'disabled' },
    ],
    now,
    maxAgeMs: 86400000,
  });

  assert.deepEqual(snapshot.budgets.map(item => item.quotaWindowId), [tokenWindow.quotaWindowId]);
});

test('does not treat a missing provider quota as unlimited or free', () => {
  const snapshot = buildResourcePoolSnapshot({ rows: [], now });
  assert.deepEqual(snapshot.budgets, []);
});

test('fails closed on malformed or over-consumed quota records', () => {
  assert.throws(() => buildResourcePoolSnapshot({
    rows: [{ ...tokenWindow, usedUnits: 10001 }],
    now,
  }), /quota|usage|limit/i);
  assert.throws(() => buildResourcePoolSnapshot({
    rows: [{ ...tokenWindow, sourceUrl: 'http://provider.example/limits' }],
    now,
  }), /source|https/i);
  assert.throws(() => buildResourcePoolSnapshot({
    rows: [{ ...tokenWindow, unitKind: 'credits' }],
    now,
  }), /unit/i);
});

test('rejects duplicate active windows for the same provider, model and unit', () => {
  assert.throws(() => buildResourcePoolSnapshot({
    rows: [tokenWindow, { ...tokenWindow, quotaWindowId: 'duplicate-window' }],
    now,
  }), /duplicate/i);
});

test('reads only active enabled windows and returns a redacted snapshot from D1', async () => {
  let sql = '';
  let bound = [];
  const db = {
    prepare(statement) {
      sql = statement;
      return {
        bind(...values) {
          bound = values;
          return {
            async all() {
              return {
                results: [{
                  quota_window_id: tokenWindow.quotaWindowId,
                  provider_id: tokenWindow.providerId,
                  model_id: tokenWindow.modelId,
                  unit_kind: tokenWindow.unitKind,
                  window_start: tokenWindow.windowStart,
                  window_end: tokenWindow.windowEnd,
                  limit_units: tokenWindow.limitUnits,
                  used_units: tokenWindow.usedUnits,
                  source_url: tokenWindow.sourceUrl,
                  verified_at: tokenWindow.verifiedAt,
                  status: tokenWindow.status,
                }],
              };
            },
          };
        },
      };
    },
  };

  const snapshot = await readResourcePoolSnapshot({ db, now });

  assert.match(sql, /model_usage_quota_windows/);
  assert.match(sql, /model_usage_reservations/);
  assert.deepEqual(bound, [now, now, now]);
  assert.equal(snapshot.budgets[0].remainingUnits, 7500);
  assert.equal(JSON.stringify(snapshot).includes('apiKey'), false);
  assert.equal(JSON.stringify(snapshot).includes('secret'), false);
});


test('maps token quota windows onto existing server-approved provider state by model', async () => {
  const { mergeResourcePoolProviderState } = await import('../functions/lib/resource-pool.mjs');
  const snapshot = buildResourcePoolSnapshot({
    rows: [
      tokenWindow,
      { ...tokenWindow, quotaWindowId: 'neurons', providerId: 'cloudflare', modelId: 'workers-ai', unitKind: 'neurons', limitUnits: 900000, usedUnits: 300000 },
    ],
    now,
  });
  const original = {
    openrouter: { enabled: true, remainingTokens: 999999, paidFallbackApproved: false },
    cloudflare: { enabled: true, remainingTokens: 999999 },
  };
  const mapped = mergeResourcePoolProviderState(snapshot, original);
  assert.equal(mapped.openrouter.models['model-a'].remainingTokens, 7500);
  assert.equal(mapped.openrouter.models['model-a'].quotaWindowId, tokenWindow.quotaWindowId);
  assert.deepEqual(mapped.cloudflare.models, {});
  assert.equal(mapped.openrouter.paidFallbackApproved, false);
  assert.equal(original.openrouter.models, undefined);
});

test('does not enable providers or infer token capacity from neuron quotas', async () => {
  const { mergeResourcePoolProviderState } = await import('../functions/lib/resource-pool.mjs');
  const snapshot = buildResourcePoolSnapshot({
    rows: [
      { ...tokenWindow, providerId: 'disabled-provider' },
      { ...tokenWindow, quotaWindowId: 'neurons-only', providerId: 'cloudflare', unitKind: 'neurons' },
    ],
    now,
  });
  const mapped = mergeResourcePoolProviderState(snapshot, {
    'disabled-provider': { enabled: false },
  });
  assert.equal(mapped['disabled-provider'].models, undefined);
  assert.equal(mapped.cloudflare, undefined);
});
