import test from 'node:test';
import assert from 'node:assert/strict';
import {
  estimateTokenReservation,
  providerUsageUnits,
  findActiveTokenQuotaWindow,
  settleTokenUsage,
  deriveUsageReservationIds,
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
  const bytes = new TextEncoder().encode(JSON.stringify({ messages: [
    { role: 'system', content: 'You are AEGIS.' },
    { role: 'user', content: 'Hello 🌍' },
  ], tools: [] })).byteLength;
  assert.equal(estimate, bytes + 1024 + 128);
});

test('reserves for each potential provider request and includes server tool definitions', () => {
  const messages = [{ role: 'user', content: 'run one approved tool' }];
  const tools = [{ type: 'function', function: { name: 'aegis_lookup', parameters: {} } }];
  const one = estimateTokenReservation({ messages, tools, maxOutputTokens: 1024, overheadTokens: 128 });
  const two = estimateTokenReservation({ messages, tools, maxOutputTokens: 1024, overheadTokens: 128, requestCount: 2, extraPromptBytes: 4096 });
  assert.ok(two >= one * 2 + 4096 - 128);
});

test('derives stable, provider-scoped reservation identifiers without exposing run IDs', async () => {
  const input = { threadId: 'thread-1', runId: 'run-1', providerId: 'alibaba-qwen', modelId: 'qwen3.8-flash' };
  const first = await deriveUsageReservationIds(input);
  const second = await deriveUsageReservationIds(input);
  const otherProvider = await deriveUsageReservationIds({ ...input, providerId: 'anthropic' });
  assert.deepEqual(first, second);
  assert.notEqual(first.idempotencyKey, otherProvider.idempotencyKey);
  assert.match(first.idempotencyKey, /^agui-[a-f0-9]{64}$/);
  assert.match(first.reservationId, /^usage-[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(first), /run-1|thread-1/);
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
              return { results: [{ id: 'quota-qwen-001', window_start: '2026-11-22T00:00:00.000Z', window_end: '2026-11-23T00:00:00.000Z' }] };
            },
          };
        },
      };
    },
  };
  const quota = await findActiveTokenQuotaWindow({
    db, providerId: 'alibaba-qwen', modelId: 'qwen3.8-flash', now,
  });
  assert.deepEqual(quota, { id: 'quota-qwen-001', windowStart: '2026-11-22T00:00:00.000Z', windowEnd: '2026-11-23T00:00:00.000Z' });
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


test('settles only provider-reported actual usage against the exact reserved provider and model', async () => {
  const preparedSql = [];
  let batchStatements = [];
  const db = {
    prepare(sql) {
      preparedSql.push(sql);
      return { bind() { return this; }, async first() {
        return {
          reserved_units: 2000,
          status: 'reserved',
          provider_id: 'alibaba-qwen',
          model_id: 'qwen3.8-flash',
          unit_kind: 'tokens',
        };
      } };
    },
    async batch(statements) {
      batchStatements = statements;
      return [{ meta: { changes: 1 } }, { meta: { changes: 1 } }];
    },
  };
  const result = await settleTokenUsage({
    db,
    reservationId: 'usage-run-001',
    providerId: 'alibaba-qwen',
    modelId: 'qwen3.8-flash',
    usage: {
      inputTokens: 300,
      outputTokens: 100,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
      totalTokens: 400,
      source: 'openai-compatible',
    },
    now,
  });
  assert.ok(preparedSql.some(sql => /JOIN model_usage_quota_windows/.test(sql)));
  assert.deepEqual(result, { reservationId: 'usage-run-001', actualUnits: 400, status: 'settled' });
  assert.equal(batchStatements.length, 2);
});

test('does not settle incomplete usage or usage from another provider family', async () => {
  let databaseTouched = false;
  const db = {
    prepare() { databaseTouched = true; throw new Error('must not access ledger'); },
    batch() { databaseTouched = true; throw new Error('must not access ledger'); },
  };
  await assert.rejects(settleTokenUsage({
    db,
    reservationId: 'usage-run-001',
    providerId: 'alibaba-qwen',
    modelId: 'qwen3.8-flash',
    usage: {
      inputTokens: 300,
      outputTokens: null,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
      totalTokens: null,
      source: 'openai-compatible',
    },
    now,
  }), /incomplete/i);
  await assert.rejects(settleTokenUsage({
    db,
    reservationId: 'usage-run-001',
    providerId: 'anthropic',
    modelId: 'claude-model',
    usage: {
      inputTokens: 300,
      outputTokens: 100,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
      totalTokens: 400,
      source: 'openai-compatible',
    },
    now,
  }), /provider/i);
  assert.equal(databaseTouched, false);
});

test('rejects settlement when actual provider usage exceeds the reserved amount', async () => {
  const db = {
    prepare() {
      return { bind() { return this; }, async first() {
        return {
          reserved_units: 200,
          status: 'reserved',
          provider_id: 'alibaba-qwen',
          model_id: 'qwen3.8-flash',
          unit_kind: 'tokens',
        };
      } };
    },
    async batch() { throw new Error('must not update an over-reservation'); },
  };
  await assert.rejects(settleTokenUsage({
    db,
    reservationId: 'usage-run-001',
    providerId: 'alibaba-qwen',
    modelId: 'qwen3.8-flash',
    usage: {
      inputTokens: 300,
      outputTokens: 100,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
      totalTokens: 400,
      source: 'openai-compatible',
    },
    now,
  }), /exceeds the reservation/i);
});
