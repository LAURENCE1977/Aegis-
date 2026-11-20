import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken } from '../functions/lib/auth.mjs';
import { evaluateAgentExperiment } from '../workers/runtime/agent-evaluation.mjs';
import { onRequestGet as listRecords, onRequestPost as createRecord } from '../functions/api/experiment-records.js';
import {
  onRequestGet as getRecord,
  onRequestDelete as deleteRecord,
} from '../functions/api/experiment-records/[id].js';

const secret = 'experiment-record-api-test-session-secret';
const token = await createSessionToken(secret);
const env = {
  AEGIS_PASSWORD: 'test-password-with-enough-length',
  AEGIS_SESSION_SECRET: secret,
  AEGIS_RUNTIME_URL: 'https://runtime.example/',
  AEGIS_JOB_TOKEN: 'test-runtime-service-token-with-at-least-32-characters',
};

function ownerRequest(path, { method = 'GET', body, origin = 'https://aegis.example' } = {}) {
  const headers = {
    Cookie: '__Host-aegis_session=' + token,
  };
  if (origin) headers.Origin = origin;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return new Request('https://aegis.example' + path, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function validInput() {
  const criteria = [{ id: 'correctness', description: 'The result is correct' }];
  const context = {
    schemaVersion: 'aegis.measurement-context.v1',
    id: 'context-api',
    benchmarkId: 'benchmark-api',
    benchmarkVersion: '1.0',
    workloadDigest: 'sha256:' + 'a'.repeat(64),
    workloadEvidenceRef: 'benchmark:workload-api',
    runtime: 'node',
    runtimeVersion: '22',
    region: 'local',
    concurrency: 1,
    warmupRuns: 0,
    measuredRuns: 2,
    timeoutMs: 1000,
  };
  const evaluation = evaluateAgentExperiment({
    priority: 'lowest_cost',
    criteria,
    candidates: ['candidate-a', 'candidate-b'].map((id, index) => ({
      id,
      currency: 'GBP',
      costMinorUnits: String(100 + index * 100),
      elapsedMs: 1000 + index * 100,
      safetyChecksPassed: true,
      safetyEvidenceRef: 'safety:' + id,
      measurementContextId: context.id,
      criterionResults: [{ criterionId: 'correctness', outcome: 'pass', evidenceRef: 'criterion:' + id }],
    })),
  });
  for (const candidate of evaluation.candidates) {
    candidate.costEvidenceRef = 'cost:' + candidate.id;
    candidate.elapsedEvidenceRef = 'runtime:' + candidate.id;
  }
  const evidence = [
    { ref: context.workloadEvidenceRef, kind: 'benchmark', sha256: context.workloadDigest },
    ...evaluation.candidates.flatMap((candidate) => [
      { ref: candidate.safetyEvidenceRef, kind: 'safety' },
      { ref: candidate.costEvidenceRef, kind: 'cost' },
      { ref: candidate.elapsedEvidenceRef, kind: 'runtime' },
      ...candidate.criterionResults.map((result) => ({ ref: result.evidenceRef, kind: 'criterion' })),
    ]),
  ].map((item) => ({
    ...item,
    sha256: item.sha256 || 'sha256:' + 'b'.repeat(64),
    capturedAt: '2026-11-20T20:00:00.000Z',
  }));
  return {
    id: 'record-api-1',
    benchmarkId: context.benchmarkId,
    measurementContext: context,
    evaluation,
    evidence,
  };
}

test('rejects unauthenticated record reads before contacting the runtime', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; throw new Error('must not fetch'); };
  try {
    const response = await listRecords({
      request: new Request('https://aegis.example/api/experiment-records'),
      env,
    });
    assert.equal(response.status, 401);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('rejects cross-origin writes before contacting the runtime', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; throw new Error('must not fetch'); };
  try {
    const response = await createRecord({
      request: ownerRequest('/api/experiment-records', {
        method: 'POST',
        body: validInput(),
        origin: 'https://attacker.example',
      }),
      env,
    });
    assert.equal(response.status, 403);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('builds the record with the server-owned principal and proxies only the trusted principal', async () => {
  const originalFetch = globalThis.fetch;
  let observed;
  globalThis.fetch = async (url, init) => {
    observed = { url: String(url), init, payload: JSON.parse(init.body) };
    return new Response(JSON.stringify({ record: observed.payload.record, created: true }), { status: 201 });
  };
  try {
    const response = await createRecord({
      request: ownerRequest('/api/experiment-records', { method: 'POST', body: validInput() }),
      env,
    });
    const body = await response.json();
    assert.equal(response.status, 201);
    assert.equal(body.record.ownerId, 'owner');
    assert.equal(observed.url, 'https://runtime.example/v1/experiment-records');
    assert.equal(observed.init.headers.Authorization, 'Bearer ' + env.AEGIS_JOB_TOKEN);
    assert.equal(observed.init.headers['X-Aegis-Principal'], 'owner');
    assert.equal(observed.payload.record.ownerId, 'owner');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('rejects a caller-supplied owner ID instead of treating it as authority', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; throw new Error('must not fetch'); };
  try {
    const response = await createRecord({
      request: ownerRequest('/api/experiment-records', {
        method: 'POST',
        body: { ...validInput(), ownerId: 'attacker' },
      }),
      env,
    });
    assert.equal(response.status, 400);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('lists records with a bounded limit and opaque stable cursor', async () => {
  const originalFetch = globalThis.fetch;
  let observedUrl = '';
  globalThis.fetch = async (url, init) => {
    observedUrl = String(url);
    assert.equal(init.headers['X-Aegis-Principal'], 'owner');
    return new Response(JSON.stringify({ records: [{ id: 'record-1' }], nextCursor: null }));
  };
  try {
    const cursor = { createdAt: '2026-11-20T20:00:00.000Z', recordId: 'record-1' };
    const response = await listRecords({
      request: ownerRequest('/api/experiment-records?limit=10&cursor=' + encodeURIComponent(JSON.stringify(cursor))),
      env,
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.records.length, 1);
    const url = new URL(observedUrl);
    assert.equal(url.searchParams.get('limit'), '10');
    assert.deepEqual(JSON.parse(url.searchParams.get('cursor')), cursor);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('requires the configured HTTPS runtime endpoint and service credential', async () => {
  const response = await listRecords({
    request: ownerRequest('/api/experiment-records'),
    env: { ...env, AEGIS_RUNTIME_URL: 'http://runtime.example/' },
  });
  assert.equal(response.status, 503);
});

test('reads and logically deletes only the validated record identifier', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), method: init.method });
    return init.method === 'DELETE'
      ? new Response(JSON.stringify({ deleted: true }))
      : new Response(JSON.stringify({ record: { id: 'record-api-1' } }));
  };
  try {
    const read = await getRecord({
      request: ownerRequest('/api/experiment-records/record-api-1'),
      env,
      params: { id: 'record-api-1' },
    });
    const deleted = await deleteRecord({
      request: ownerRequest('/api/experiment-records/record-api-1', { method: 'DELETE' }),
      env,
      params: { id: 'record-api-1' },
    });
    assert.equal(read.status, 200);
    assert.equal(deleted.status, 200);
    assert.deepEqual(calls.map((call) => call.method), ['GET', 'DELETE']);
    assert.ok(calls.every((call) => call.url.endsWith('/v1/experiment-records/record-api-1')));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
