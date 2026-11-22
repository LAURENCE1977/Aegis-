import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken } from '../functions/lib/auth.mjs';
import { onRequestGet } from '../functions/api/resource-pool.js';

const secret = 'resource-pool-api-test-session-secret-with-enough-entropy';
const envBase = {
  AEGIS_PASSWORD: 'test-password-long-enough',
  AEGIS_SESSION_SECRET: secret,
};

async function authenticatedRequest() {
  const token = await createSessionToken(secret);
  return new Request('https://aegis.example/api/resource-pool', {
    headers: { Cookie: '__Host-aegis_session=' + token },
  });
}

test('resource pool rejects unauthenticated reads before accessing D1', async () => {
  const response = await onRequestGet({
    request: new Request('https://aegis.example/api/resource-pool'),
    env: {
      ...envBase,
      AEGIS_DB: { prepare() { throw new Error('must not access D1'); } },
    },
  });
  assert.equal(response.status, 401);
});

test('resource pool fails closed when the shared D1 binding is missing', async () => {
  const response = await onRequestGet({
    request: await authenticatedRequest(),
    env: envBase,
  });
  assert.equal(response.status, 503);
});

test('owner receives a no-store snapshot and an empty ledger is not treated as free capacity', async () => {
  let sql = '';
  const db = {
    prepare(statement) {
      sql = statement;
      return {
        bind() {
          return {
            async all() { return { results: [] }; },
          };
        },
      };
    },
  };
  const response = await onRequestGet({
    request: await authenticatedRequest(),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('Cache-Control'), /no-store/);
  assert.match(sql, /model_usage_quota_windows/);
  const body = await response.json();
  assert.equal(body.schemaVersion, 'aegis.resource-pool.v1');
  assert.deepEqual(body.budgets, []);
});
