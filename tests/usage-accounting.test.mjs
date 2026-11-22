import test from 'node:test';
import assert from 'node:assert/strict';
import {
  estimateTokenReservation,
  providerUsageUnits,
  findActiveTokenQuotaWindow,
} from '../functions/lib/usage-accounting.mjs';

const now = '2026-11-22T12:00:00.000Z';

test('estimates a conservative token reservation from the exact bounded prompt payload', () => {
  const estimate = estimateTokenReservation({
    messages: [
      { role: 'system', content: 'You are AEGIS.' },
      { role: 'user', content: 'Hello 🌍' },
    ],
    maxOutputTokens: 1024,
    overheadTokens: 128,
  });
  const bytes = new TextEncoder().encode(JSON.stringify([
    { role: 'system', content: 'You are AEGIS.' },
    { role: 'user', content: 'Hello 🌍' },
  ])).byteLength;
  assert.equal(estimate, bytes + 1024 + 128);
});

test('rejects invalid or excessive token reservation inputs', () => {
  assert.throws(() => estimateTokenReservation({ messages: [], maxOutputTokens: 1024 }), /messages/i);
  assert.throws(() => estimateTokenReservation({
    messages: [{ role: 'user', content: 'x' }],
    maxOutputTokens: 0,
  }), /output/i);
  assert.throws(() => estimateTokenReservation({
    messages: [{ role: 'user', content: 'x' }],
    maxOutputTokens: 1024,
    overheadTokens: -1,
  }), /overhead/i);
});

test('settlement accepts only complete actual usage from the matching provider family', () => {
  const anthropic = {
    inputTokens: 100,
    outputTokens: 25,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 10,
    totalTokens: 135,
    source: 'anthropic',
  };
  assert.equal(providerUsageUnits({ providerId: 'anthropic', usage: anthropic }), 135);
  const qwen = {
    inputTokens: 200,
    outputTokens: 50,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
    totalTokens: 250,
    source: 'openai-compatible',
  };
  assert.equal(providerUsageUnits({ providerId: 'alibaba-qwen', usage: qwen }), 250);
  assert.throws(() => providerUsageUnits({
    providerId: 'anthropic',
    usage: { ...anthropic, outputTokens: null, totalTokens: null },
  }), /complete/i);
  assert.throws(() => providerUsageUnits({ providerId: 'alibaba-qwen', usage: anthropic }), /provider/i);
  assert.throws(() => providerUsageUnits({ providerId: 'workers-ai', usage: qwen }), /provider/i);
});

test('finds exactly one active, fresh token quota window for the requested provider and model', async () => {
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
              return { results: [{ id: 'quota-qwen-001' }] };
            },
          };
        },
      };
    },
  };
  const quota = await findActiveTokenQuotaWindow({
    db, providerId: 'alibaba-qwen', modelId: 'qwen3.8-flash', now,
  });
  assert.deepEqual(quota, { id: 'quota-qwen-001' });
  assert.match(sql, /unit_kind = 'tokens'/);
  assert.match(sql, /verified_at >=/);
  assert.deepEqual(bound, [
    'alibaba-qwen', 'qwen3.8-flash', now, now, now,
    '2026-11-21T12:00:00.000Z',
  ]);
});

test('fails closed when no active verified token quota window exists', async () => {
  const db = {
    prepare() {
      return { bind() { return { async all() { return { results: [] }; } }; } };
    },
  };
  await assert.rejects(findActiveTokenQuotaWindow({
    db, providerId: 'alibaba-qwen', modelId: 'qwen3.8-flash', now,
  }), /verified token quota/i);
});

test('fails closed on duplicate active token quota windows', async () => {
  const db = {
    prepare() {
      return { bind() { return { async all() { return { results: [{ id: 'q1' }, { id: 'q2' }] }; } }; } };
    },
  };
  await assert.rejects(findActiveTokenQuotaWindow({
    db, providerId: 'alibaba-qwen', modelId: 'qwen3.8-flash', now,
  }), /duplicate/i);
});
