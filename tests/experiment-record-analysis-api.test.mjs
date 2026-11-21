import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken } from '../functions/lib/auth.mjs';
import { onRequestGet as analyseHistory } from '../functions/api/experiment-records/analysis.js';
import { onRequestGet as getProposals } from '../functions/api/experiment-records/proposals.js';
import { evaluateAgentExperiment } from '../workers/runtime/agent-evaluation.mjs';
import { createAgentExperimentRecord } from '../workers/runtime/agent-experiment-record.mjs';
import { handleRuntimeFetch } from '../workers/runtime/index.mjs';

const token = 'experiment-analysis-runtime-token-with-at-least-32-characters';
const sessionSecret = 'experiment-analysis-pages-session-secret';
const sessionToken = await createSessionToken(sessionSecret);

function runtimeRequest(path, { principal = 'owner', authorization = 'Bearer ' + token } = {}) {
  const headers = {};
  if (authorization) headers.Authorization = authorization;
  if (principal !== null) headers['X-Aegis-Principal'] = principal;
  return new Request('https://runtime.example' + path, { headers });
}

function ownerRequest(path) {
  return new Request('https://aegis.example' + path, {
    headers: { Cookie: '__Host-aegis_session=' + sessionToken },
  });
}

async function makeRecord({ id, contextId, createdAt, cost }) {
  const context = {
    schemaVersion: 'aegis.measurement-context.v1',
    id: contextId,
    benchmarkId: 'analysis-benchmark',
    benchmarkVersion: '1.0',
    workloadDigest: 'sha256:' + 'a'.repeat(64),
    workloadEvidenceRef: 'benchmark:' + contextId,
    runtime: 'node',
    runtimeVersion: '22',
    region: 'local',
    concurrency: 1,
    warmupRuns: 1,
    measuredRuns: 5,
    timeoutMs: 30000,
  };
  const evaluation = evaluateAgentExperiment({
    priority: 'lowest_cost',
    criteria: [{ id: 'correctness', description: 'Produces a correct result' }],
    candidates: ['candidate-a', 'candidate-b'].map((candidateId, index) => ({
      id: candidateId,
      currency: 'GBP',
      costMinorUnits: String(candidateId === 'candidate-a' ? cost : 250 + index),
      elapsedMs: candidateId === 'candidate-a' ? cost * 10 : 1500,
      safetyChecksPassed: true,
      safetyEvidenceRef: 'safety:' + contextId + ':' + candidateId,
      measurementContextId: contextId,
      criterionResults: [{ criterionId: 'correctness', outcome: 'pass', evidenceRef: 'criterion:' + contextId + ':' + candidateId }],
    })),
  });
  for (const candidate of evaluation.candidates) {
    candidate.costEvidenceRef = 'cost:' + contextId + ':' + candidate.id;
    candidate.elapsedEvidenceRef = 'runtime:' + contextId + ':' + candidate.id;
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
    capturedAt: createdAt,
  }));
  return createAgentExperimentRecord({
    id,
    ownerId: 'owner',
    benchmarkId: context.benchmarkId,
    createdAt,
    measurementContext: context,
    evaluation,
    evidence,
  });
}

function historyDb(records) {
  const rows = records.map((record) => ({
    principal_id: 'owner',
    record_id: record.id,
    record_digest: record.recordDigest,
    record_json: JSON.stringify(record),
    created_at: record.createdAt,
  })).sort((a, b) => b.created_at.localeCompare(a.created_at) || b.record_id.localeCompare(a.record_id));
  return {
    prepare(sql) {
      assert.match(sql, /FROM experiment_records/);
      return {
        bind() {
          return {
            async all() { return { results: rows }; },
          };
        },
      };
    },
  };
}

test('Pages analysis endpoint requires owner authentication before contacting runtime', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; throw new Error('must not fetch'); };
  try {
    const response = await analyseHistory({
      request: new Request('https://aegis.example/api/experiment-records/analysis'),
      env: {
        AEGIS_PASSWORD: 'analysis-test-password',
        AEGIS_SESSION_SECRET: sessionSecret,
        AEGIS_RUNTIME_URL: 'https://runtime.example/',
        AEGIS_JOB_TOKEN: token,
      },
    });
    assert.equal(response.status, 401);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Pages analysis endpoint calls only the fixed owner runtime analysis route', async () => {
  const originalFetch = globalThis.fetch;
  let observed;
  globalThis.fetch = async (url, init) => {
    observed = { url: String(url), init };
    return new Response(JSON.stringify({
      analysis: { schemaVersion: 'aegis.experiment-history-analysis.v1', ownerId: 'owner', recordCount: 2, cohorts: [] },
    }));
  };
  try {
    const response = await analyseHistory({
      request: ownerRequest('/api/experiment-records/analysis'),
      env: {
        AEGIS_PASSWORD: 'analysis-test-password',
        AEGIS_SESSION_SECRET: sessionSecret,
        AEGIS_RUNTIME_URL: 'https://runtime.example/',
        AEGIS_JOB_TOKEN: token,
      },
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.analysis.recordCount, 2);
    assert.equal(observed.url, 'https://runtime.example/v1/experiment-records/analysis');
    assert.equal(observed.init.headers['X-Aegis-Principal'], 'owner');
    assert.equal(observed.init.headers.Authorization, 'Bearer ' + token);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('runtime analysis endpoint compares verified owner records and returns descriptive deltas', async () => {
  const older = await makeRecord({
    id: 'analysis-old',
    contextId: 'analysis-context-old',
    createdAt: '2026-11-20T10:00:00.000Z',
    cost: 200,
  });
  const newer = await makeRecord({
    id: 'analysis-new',
    contextId: 'analysis-context-new',
    createdAt: '2026-11-20T11:00:00.000Z',
    cost: 150,
  });
  const response = await handleRuntimeFetch(
    runtimeRequest('/v1/experiment-records/analysis'),
    { AEGIS_JOB_TOKEN: token, DB: historyDb([older, newer]) },
  );
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.analysis.schemaVersion, 'aegis.experiment-history-analysis.v1');
  assert.equal(body.analysis.ownerId, 'owner');
  assert.equal(body.analysis.recordCount, 2);
  assert.equal(body.analysis.cohorts[0].status, 'comparable');
  const candidate = body.analysis.cohorts[0].candidateComparisons.find((item) => item.candidateId === 'candidate-a');
  assert.equal(candidate.delta.costMinorUnits, '-50');
});

test('runtime analysis endpoint rejects an untrusted principal before reading D1', async () => {
  let databaseCalls = 0;
  const response = await handleRuntimeFetch(
    runtimeRequest('/v1/experiment-records/analysis', { principal: 'someone-else' }),
    {
      AEGIS_JOB_TOKEN: token,
      DB: { prepare() { databaseCalls += 1; throw new Error('must not query'); } },
    },
  );
  assert.equal(response.status, 400);
  assert.equal(databaseCalls, 0);
});

test('runtime analysis endpoint fails closed when stored record integrity cannot be verified', async () => {
  const record = await makeRecord({
    id: 'analysis-tampered',
    contextId: 'analysis-context-tampered',
    createdAt: '2026-11-20T10:00:00.000Z',
    cost: 200,
  });
  const altered = { ...record, evaluation: { ...record.evaluation, priority: 'fastest' } };
  const response = await handleRuntimeFetch(
    runtimeRequest('/v1/experiment-records/analysis'),
    { AEGIS_JOB_TOKEN: token, DB: historyDb([altered]) },
  );
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'Experiment history analysis is unavailable.' });
});


test('Pages proposal endpoint requires owner authentication before contacting runtime', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; throw new Error('must not fetch'); };
  try {
    const response = await getProposals({
      request: new Request('https://aegis.example/api/experiment-records/proposals'),
      env: {
        AEGIS_PASSWORD: 'analysis-test-password',
        AEGIS_SESSION_SECRET: sessionSecret,
        AEGIS_RUNTIME_URL: 'https://runtime.example/',
        AEGIS_JOB_TOKEN: token,
      },
    });
    assert.equal(response.status, 401);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Pages proposal endpoint calls the fixed owner runtime route and validates its owner scope', async () => {
  const originalFetch = globalThis.fetch;
  let observed;
  globalThis.fetch = async (url, init) => {
    observed = { url: String(url), init };
    return new Response(JSON.stringify({
      proposals: {
        schemaVersion: 'aegis.experiment-proposals.v1',
        ownerId: 'owner',
        proposalCount: 0,
        proposals: [],
      },
    }));
  };
  try {
    const response = await getProposals({
      request: ownerRequest('/api/experiment-records/proposals'),
      env: {
        AEGIS_PASSWORD: 'analysis-test-password',
        AEGIS_SESSION_SECRET: sessionSecret,
        AEGIS_RUNTIME_URL: 'https://runtime.example/',
        AEGIS_JOB_TOKEN: token,
      },
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.proposals.proposalCount, 0);
    assert.equal(observed.url, 'https://runtime.example/v1/experiment-records/proposals');
    assert.equal(observed.init.headers['X-Aegis-Principal'], 'owner');
    assert.equal(observed.init.headers.Authorization, 'Bearer ' + token);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('runtime proposal endpoint derives review leads from verified records and keeps execution unauthorised', async () => {
  const older = await makeRecord({
    id: 'proposal-old',
    contextId: 'proposal-context-old',
    createdAt: '2026-11-20T10:00:00.000Z',
    cost: 200,
  });
  const newer = await makeRecord({
    id: 'proposal-new',
    contextId: 'proposal-context-new',
    createdAt: '2026-11-20T11:00:00.000Z',
    cost: 150,
  });
  const response = await handleRuntimeFetch(
    runtimeRequest('/v1/experiment-records/proposals'),
    { AEGIS_JOB_TOKEN: token, DB: historyDb([older, newer]) },
  );
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.proposals.schemaVersion, 'aegis.experiment-proposals.v1');
  assert.equal(body.proposals.ownerId, 'owner');
  const proposal = body.proposals.proposals.find((item) => item.candidateId === 'candidate-a');
  assert.ok(proposal);
  assert.equal(proposal.approval.required, true);
  assert.equal(proposal.approval.authority, 'Sentinel');
  assert.equal(proposal.execution, 'not_authorised');
  assert.equal(proposal.evidence.firstRecordId, 'proposal-old');
  assert.equal(proposal.evidence.lastRecordId, 'proposal-new');
});

test('runtime proposal endpoint rejects an untrusted principal before reading D1', async () => {
  let databaseCalls = 0;
  const response = await handleRuntimeFetch(
    runtimeRequest('/v1/experiment-records/proposals', { principal: 'someone-else' }),
    {
      AEGIS_JOB_TOKEN: token,
      DB: { prepare() { databaseCalls += 1; throw new Error('must not query'); } },
    },
  );
  assert.equal(response.status, 400);
  assert.equal(databaseCalls, 0);
});
