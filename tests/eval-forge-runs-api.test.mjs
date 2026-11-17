import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken } from '../functions/lib/auth.mjs';
import { onRequestGet } from '../functions/api/eval/runs.js';

const secret = 'eval-forge-runs-api-test-session-secret-long-enough';
const envBase = { AEGIS_PASSWORD: 'test-password-long-enough', AEGIS_SESSION_SECRET: secret };

class EvalRunListD1 {
  constructor(rows = []) { this.rows = rows; }
  prepare(sql) {
    const db = this;
    return {
      values: [],
      bind(...values) { this.values = values; return this; },
      async all() {
        const [ownerId, limit] = this.values;
        return { results: db.rows.filter(row => row.owner_id === ownerId).slice(0, limit) };
      },
    };
  }
}

async function makeRequest(path, authenticated = true) {
  const headers = { Origin: 'https://aegis.example' };
  if (authenticated) headers.Cookie = '__Host-aegis_session=' + await createSessionToken(secret);
  return new Request('https://aegis.example' + path, { headers });
}

const row = {
  id: 'eval-run-001',
  owner_id: 'owner',
  run_id: 'run-001',
  suite_id: 'guardian-regression',
  suite_version: '1.0.0',
  suite_digest: 'a'.repeat(64),
  candidate_id: 'agent-aegis',
  candidate_version: '0.4.0',
  candidate_digest: 'c'.repeat(64),
  result_digest: 'b'.repeat(64),
  result_json: JSON.stringify({
    id: 'run-001', suiteId: 'guardian-regression', suiteVersion: '1.0.0',
    candidateId: 'agent-aegis', candidateVersion: '0.4.0', candidateDigest: 'c'.repeat(64),
    status: 'passed', scorePercent: 100, evidenceVerified: true,
  }),
  recorded_at: '2026-11-17T12:11:00.000Z',
};

test('Eval Forge run history requires authentication', async () => {
  const response = await onRequestGet({
    request: await makeRequest('/api/eval/runs', false),
    env: { ...envBase, AEGIS_DB: new EvalRunListD1([row]) },
  });
  assert.equal(response.status, 401);
});

test('Eval Forge run history returns owner-scoped bounded read-only results', async () => {
  const db = new EvalRunListD1([row, { ...row, id: 'other', owner_id: 'another-owner', run_id: 'other-run' }]);
  const response = await onRequestGet({
    request: await makeRequest('/api/eval/runs?limit=10'),
    env: { ...envBase, AEGIS_DB: db },
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.total, 1);
  assert.equal(payload.runs[0].run.id, 'run-001');
  assert.equal(payload.runs[0].run.evidenceVerified, true);
});

test('Eval Forge run history rejects invalid and repeated query parameters', async () => {
  const db = new EvalRunListD1([row]);
  for (const query of ['?limit=0', '?limit=101', '?limit=1&limit=2', '?unexpected=yes']) {
    const response = await onRequestGet({
      request: await makeRequest('/api/eval/runs' + query),
      env: { ...envBase, AEGIS_DB: db },
    });
    assert.equal(response.status, 400);
  }
});
