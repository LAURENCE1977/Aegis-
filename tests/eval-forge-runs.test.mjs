import test from 'node:test';
import assert from 'node:assert/strict';
import {
  registerEvaluationSuite,
} from '../functions/lib/eval-forge-store.mjs';
import {
  persistEvaluationRun,
  listEvaluationRuns,
} from '../functions/lib/eval-forge-runs.mjs';

async function digest(bytes) {
  const value = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(value)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

class EvalRunD1 {
  constructor() { this.suites = new Map(); this.runs = new Map(); this.events = []; }
  prepare(sql) {
    const db = this;
    return {
      values: [],
      bind(...values) { this.values = values; return this; },
      async run() {
        const v = this.values;
        if (sql.includes('INSERT INTO eval_suites')) {
          const [id, owner, suiteId, version, suiteDigest, suiteJson, createdAt] = v;
          db.suites.set(owner + '|' + suiteId + '|' + version, {
            id, owner_id: owner, suite_id: suiteId, version,
            suite_digest: suiteDigest, suite_json: suiteJson, created_at: createdAt,
          });
          return { meta: { changes: 1 } };
        }
        if (sql.includes('INSERT INTO eval_runs')) {
          const [id, owner, runId, suiteId, suiteVersion, suiteDigest, candidateId,
            candidateVersion, candidateDigest, status, scorePercent, resultDigest,
            resultJson, completedAt, recordedAt] = v;
          const key = owner + '|' + runId;
          if (db.runs.has(key)) return { meta: { changes: 0 } };
          db.runs.set(key, {
            id, owner_id: owner, run_id: runId, suite_id: suiteId, suite_version: suiteVersion,
            suite_digest: suiteDigest, candidate_id: candidateId, candidate_version: candidateVersion,
            candidate_digest: candidateDigest, status, score_percent: scorePercent,
            evidence_verified: 1, result_digest: resultDigest, result_json: resultJson, completed_at: completedAt,
            recorded_at: recordedAt,
          });
          db.events.push({ owner_id: owner, run_id: runId, event_type: 'recorded' });
          return { meta: { changes: 1 } };
        }
        return { meta: { changes: 0 } };
      },
      async first() {
        const v = this.values;
        if (sql.includes('FROM eval_suites')) return db.suites.get(v[0] + '|' + v[1] + '|' + v[2]) ?? null;
        if (sql.includes('FROM eval_runs')) return db.runs.get(v[0] + '|' + v[1]) ?? null;
        return null;
      },
      async all() {
        const [owner, limit] = this.values;
        return { results: [...db.runs.values()].filter(row => row.owner_id === owner)
          .sort((a,b) => b.recorded_at.localeCompare(a.recorded_at) || a.run_id.localeCompare(b.run_id))
          .slice(0, limit) };
      },
    };
  }
}

const suite = {
  id: 'guardian-regression', version: '1.0.0', title: 'Guardian regression suite',
  taskType: 'reasoning', minimumScore: 100,
  cases: [
    { id: 'scope-check', weight: 1, required: true },
    { id: 'evidence-check', weight: 1, required: true },
  ],
};

async function fixture() {
  const db = new EvalRunD1();
  await registerEvaluationSuite(db, 'owner', suite, Date.parse('2026-11-17T12:00:00.000Z'));
  const candidateBytes = new TextEncoder().encode('candidate artifact v1');
  const scopeBytes = new TextEncoder().encode('scope assertion passed');
  const evidenceBytes = new TextEncoder().encode('evidence assertion passed');
  const run = {
    id: 'run-001', candidateId: 'agent-aegis', candidateVersion: '0.4.0',
    candidateDigest: await digest(candidateBytes), completedAt: '2026-11-17T12:10:00.000Z',
    results: [
      { caseId: 'scope-check', status: 'passed', evidenceDigest: await digest(scopeBytes), durationMs: 10 },
      { caseId: 'evidence-check', status: 'passed', evidenceDigest: await digest(evidenceBytes), durationMs: 20 },
    ],
  };
  return { db, candidateBytes, scopeBytes, evidenceBytes, run };
}

test('persists an immutable evaluation result only after candidate and case evidence bytes verify', async () => {
  const f = await fixture();
  const result = await persistEvaluationRun(f.db, 'owner', suite, f.run, {
    candidateBytes: f.candidateBytes,
    evidenceByCase: { 'scope-check': f.scopeBytes, 'evidence-check': f.evidenceBytes },
  }, Date.parse('2026-11-17T12:11:00.000Z'));
  assert.equal(result.created, true);
  assert.equal(result.run.status, 'passed');
  assert.equal(result.run.scorePercent, 100);
  assert.equal(result.run.evidenceVerified, true);
  assert.match(result.resultDigest, /^[a-f0-9]{64}$/);
  assert.equal(f.db.events.length, 1);
});

test('rejects unregistered suite versions and mismatched candidate/evidence bytes', async () => {
  const f = await fixture();
  await assert.rejects(persistEvaluationRun(f.db, 'owner', { ...suite, version: '2.0.0' }, f.run, {
    candidateBytes: f.candidateBytes,
    evidenceByCase: { 'scope-check': f.scopeBytes, 'evidence-check': f.evidenceBytes },
  }), /registered suite version/i);
  await assert.rejects(persistEvaluationRun(f.db, 'owner', suite, f.run, {
    candidateBytes: new TextEncoder().encode('wrong artifact'),
    evidenceByCase: { 'scope-check': f.scopeBytes, 'evidence-check': f.evidenceBytes },
  }), /candidate artifact digest/i);
  await assert.rejects(persistEvaluationRun(f.db, 'owner', suite, f.run, {
    candidateBytes: f.candidateBytes,
    evidenceByCase: { 'scope-check': f.scopeBytes, 'evidence-check': new TextEncoder().encode('fabricated') },
  }), /evidence digest/i);
  assert.equal(f.db.runs.size, 0);
});

test('run persistence is idempotent for identical result and rejects conflicting run identifiers', async () => {
  const f = await fixture();
  const evidence = { candidateBytes: f.candidateBytes, evidenceByCase: { 'scope-check': f.scopeBytes, 'evidence-check': f.evidenceBytes } };
  const first = await persistEvaluationRun(f.db, 'owner', suite, f.run, evidence, Date.parse('2026-11-17T12:11:00.000Z'));
  const second = await persistEvaluationRun(f.db, 'owner', suite, f.run, evidence, Date.parse('2026-11-17T12:12:00.000Z'));
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(first.resultDigest, second.resultDigest);
  const changed = { ...f.run, candidateVersion: '0.5.0' };
  await assert.rejects(persistEvaluationRun(f.db, 'owner', suite, changed, evidence), /already exists with different result/i);
  assert.equal(f.db.runs.size, 1);
  assert.equal(f.db.events.length, 1);
});

test('lists only owner runs with a bounded page size', async () => {
  const f = await fixture();
  const evidence = { candidateBytes: f.candidateBytes, evidenceByCase: { 'scope-check': f.scopeBytes, 'evidence-check': f.evidenceBytes } };
  await persistEvaluationRun(f.db, 'owner', suite, f.run, evidence);
  const listed = await listEvaluationRuns(f.db, 'owner', 10);
  assert.equal(listed.length, 1);
  assert.equal(listed[0].ownerId, 'owner');
  await assert.rejects(listEvaluationRuns(f.db, 'owner', 101), /limit/i);
});
