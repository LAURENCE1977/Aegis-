import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken } from '../functions/lib/auth.mjs';
import { onRequestGet } from '../functions/api/usage.js';

const secret = 'usage-api-test-session-secret-with-sufficient-entropy';
const envBase = {
  AEGIS_PASSWORD: 'test-password-long-enough',
  AEGIS_SESSION_SECRET: secret,
};

class UsageDashboardD1 {
  constructor() { this.sql = []; }
  prepare(sql) {
    this.sql.push(sql);
    return {
      bind(...values) {
        this.values = values;
        return this;
      },
      async all() {
        if (sql.includes('FROM model_usage_quota_windows')) {
          return { results: [{
            id: 'quota-1',
            provider_id: 'alibaba-qwen',
            model_id: 'qwen3.8-flash',
            unit_kind: 'tokens',
            window_start: '2026-11-22T00:00:00.000Z',
            window_end: '2026-11-23T00:00:00.000Z',
            limit_units: 100000,
            source_url: 'https://provider.example/quota',
            verified_at: '2026-11-22T18:30:00.000Z',
            status: 'enabled',
            settled_units: 1000,
            reserved_units: 2000,
            outstanding_reservations: 1,
          }] };
        }
        return { results: [] };
      },
    };
  }
}

async function request() {
  const token = await createSessionToken(secret);
  return new Request('https://aegis.example/api/usage', {
    headers: { Cookie: '__Host-aegis_session=' + token },
  });
}

test('usage dashboard rejects unauthenticated reads before querying the ledger', async () => {
  const db = new UsageDashboardD1();
  const response = await onRequestGet({
    request: new Request('https://aegis.example/api/usage'),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(response.status, 401);
  assert.equal(db.sql.length, 0);
});

test('usage dashboard returns safe verified quota and paid-run gate metadata', async () => {
  const db = new UsageDashboardD1();
  const response = await onRequestGet({
    request: await request(),
    env: {
      ...envBase,
      AEGIS_DB: db,
      AEGIS_PAID_INFERENCE_APPROVED: 'true',
      AEGIS_PAID_INFERENCE_MAX_TOKENS_PER_RUN: '5000',
      AEGIS_MODEL_PROVIDER: 'alibaba-qwen',
      AEGIS_QWEN_API_KEY: 'must-never-be-returned',
    },
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.windows[0].remainingUnits, 97000);
  assert.equal(body.windows[0].outstandingReservations, 1);
  assert.equal(body.paidInference.canAuthorisePaidRun, true);
  assert.equal(JSON.stringify(body).includes('must-never-be-returned'), false);
  assert.equal('id' in body.windows[0], false);
});

test('usage dashboard fails closed when D1 ledger queries are unavailable', async () => {
  const response = await onRequestGet({
    request: await request(),
    env: {
      ...envBase,
      AEGIS_DB: { prepare() { throw new Error('database unavailable'); } },
    },
  });
  assert.equal(response.status, 503);
});
