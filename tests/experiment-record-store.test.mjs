import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAgentExperiment } from '../workers/runtime/agent-evaluation.mjs';
import { createAgentExperimentRecord } from '../workers/runtime/agent-experiment-record.mjs';
import {
  appendExperimentRecord,
  getExperimentRecord,
  listExperimentRecords,
  tombstoneExperimentRecord,
} from '../workers/runtime/experiment-record-store.mjs';

class FakeD1 {
  constructor() {
    this.records = new Map();
    this.events = new Map();
  }

  prepare(sql) {
    const db = this;
    let values = [];
    return {
      bind(...args) {
        values = args;
        return {
          async run() {
            if (sql.startsWith('INSERT INTO experiment_records')) {
              const [principalId, recordId, schemaVersion, recordDigest, recordJson, createdAt] = values;
              const key = principalId + ':' + recordId;
              if (db.records.has(key)) return { meta: { changes: 0 } };
              db.records.set(key, {
                principal_id: principalId,
                record_id: recordId,
                schema_version: schemaVersion,
                record_digest: recordDigest,
                record_json: recordJson,
                created_at: createdAt,
              });
              return { meta: { changes: 1 } };
            }
            if (sql.includes('INSERT INTO experiment_record_events')) {
              const [eventId, principalId, recordId, actorPrincipalId, recordDigest, createdAt] = values;
              if (!db.events.has(eventId)) {
                db.events.set(eventId, {
                  event_id: eventId,
                  principal_id: principalId,
                  record_id: recordId,
                  actor_principal_id: actorPrincipalId,
                  event_type: sql.includes("'tombstoned'") ? 'tombstoned' : 'created',
                  record_digest: recordDigest,
                  created_at: createdAt,
                });
                return { meta: { changes: 1 } };
              }
              return { meta: { changes: 0 } };
            }
            throw new Error('Unexpected fake D1 run SQL: ' + sql);
          },
          async first() {
            const [principalId, recordId] = values;
            const row = db.records.get(principalId + ':' + recordId) || null;
            if (row && sql.includes('NOT EXISTS') && [...db.events.values()].some((event) =>
              event.principal_id === principalId &&
              event.record_id === recordId &&
              event.event_type === 'tombstoned'
            )) return null;
            return row;
          },
          async all() {
            const [principalId, limit] = values;
            const rows = [...db.records.values()]
              .filter((row) => row.principal_id === principalId)
              .filter((row) => ![...db.events.values()].some((event) =>
                event.principal_id === principalId &&
                event.record_id === row.record_id &&
                event.event_type === 'tombstoned'
              ))
              .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.record_id.localeCompare(a.record_id))
              .slice(0, limit);
            return { results: rows };
          },
        };
      },
    };
  }
}

const criteria = [{ id: 'correctness', description: 'The result is correct' }];
const context = {
  schemaVersion: 'aegis.measurement-context.v1',
  id: 'context-1',
  benchmarkId: 'benchmark-1',
  benchmarkVersion: '1.0',
  workloadDigest: 'sha256:' + 'a'.repeat(64),
  workloadEvidenceRef: 'benchmark:workload',
  runtime: 'node',
  runtimeVersion: '22',
  region: 'local',
  concurrency: 1,
  warmupRuns: 0,
  measuredRuns: 2,
  timeoutMs: 1000,
};

async function makeRecord(id = 'record-1', ownerId = 'principal-a') {
  const evaluation = evaluateAgentExperiment({
    priority: 'lowest_cost',
    criteria,
    candidates: ['candidate-a', 'candidate-b'].map((candidateId, index) => ({
      id: candidateId,
      currency: 'GBP',
      costMinorUnits: String(100 + index * 100),
      elapsedMs: 1000 + index * 100,
      safetyChecksPassed: true,
      safetyEvidenceRef: 'safety:' + candidateId,
      measurementContextId: context.id,
      criterionResults: [{ criterionId: 'correctness', outcome: 'pass', evidenceRef: 'criterion:' + candidateId }],
    })),
  });
  for (const candidate of evaluation.candidates) {
    candidate.costEvidenceRef = 'cost:' + candidate.id;
    candidate.elapsedEvidenceRef = 'runtime:' + candidate.id;
  }
  const refs = [
    { ref: context.workloadEvidenceRef, kind: 'benchmark', sha256: context.workloadDigest },
    ...evaluation.candidates.flatMap((candidate) => [
      { ref: candidate.safetyEvidenceRef, kind: 'safety' },
      { ref: candidate.costEvidenceRef, kind: 'cost' },
      { ref: candidate.elapsedEvidenceRef, kind: 'runtime' },
      ...candidate.criterionResults.map((item) => ({ ref: item.evidenceRef, kind: 'criterion' })),
    ]),
  ];
  return createAgentExperimentRecord({
    id,
    ownerId,
    sourceRunId: 'run-1',
    benchmarkId: context.benchmarkId,
    createdAt: '2026-11-20T20:05:00.000Z',
    measurementContext: { ...context },
    evaluation,
    evidence: refs.map(({ ref, kind, sha256 }) => ({
      ref,
      kind,
      sha256: sha256 || 'sha256:' + 'b'.repeat(64),
      capturedAt: '2026-11-20T20:00:00.000Z',
    })),
  });
}

test('appends idempotently and reads only inside the authenticated principal namespace', async () => {
  const db = new FakeD1();
  const record = await makeRecord();

  assert.equal((await appendExperimentRecord(db, 'principal-a', record)).created, true);
  assert.equal((await appendExperimentRecord(db, 'principal-a', record)).created, false);
  assert.equal((await getExperimentRecord(db, 'principal-a', record.id)).recordDigest, record.recordDigest);
  assert.equal(await getExperimentRecord(db, 'principal-b', record.id), null);
  assert.equal((await listExperimentRecords(db, 'principal-a')).length, 1);
  assert.equal((await listExperimentRecords(db, 'principal-b')).length, 0);
});

test('rejects caller-selected ownership that differs from the authenticated principal', async () => {
  const db = new FakeD1();
  const record = await makeRecord();

  await assert.rejects(
    () => appendExperimentRecord(db, 'principal-b', record),
    /owner must match the authenticated principal/i,
  );
  assert.equal(db.records.size, 0);
});

test('tombstones hide a record without mutating its immutable payload', async () => {
  const db = new FakeD1();
  const record = await makeRecord();
  await appendExperimentRecord(db, 'principal-a', record);

  assert.equal(await tombstoneExperimentRecord(db, 'principal-a', record.id), true);
  assert.equal(await getExperimentRecord(db, 'principal-a', record.id), null);
  assert.equal((await listExperimentRecords(db, 'principal-a')).length, 0);
  assert.equal(db.records.size, 1);
  assert.equal([...db.events.values()].filter((event) => event.event_type === 'tombstoned').length, 1);
});

test('detects tampering in a stored record before returning it', async () => {
  const db = new FakeD1();
  const record = await makeRecord();
  await appendExperimentRecord(db, 'principal-a', record);

  const row = db.records.get('principal-a:' + record.id);
  const altered = JSON.parse(row.record_json);
  altered.evaluation.candidates[0].costMinorUnits = '999999';
  row.record_json = JSON.stringify(altered);

  await assert.rejects(
    () => getExperimentRecord(db, 'principal-a', record.id),
    /integrity verification/i,
  );
});

test('bounds principal identifiers and list page sizes', async () => {
  const db = new FakeD1();
  await assert.rejects(() => listExperimentRecords(db, '../other-user'), /principal identifier/i);
  await assert.rejects(() => listExperimentRecords(db, 'principal-a', 101), /page size/i);
});


test('rejects a different immutable payload reusing an existing principal record ID', async () => {
  const db = new FakeD1();
  const original = await makeRecord('record-collision');
  const changed = await makeRecord('record-collision');
  const different = { ...changed, sourceRunId: 'different-source-run' };
  // Recompute a valid digest for the altered record through the public builder
  // by changing an input field rather than forging the digest.
  const rebuilt = await makeRecord('record-collision');
  assert.equal(original.recordDigest, rebuilt.recordDigest);
  await appendExperimentRecord(db, 'principal-a', original);

  const altered = await makeRecord('record-collision', 'principal-a');
  const alteredWithDifferentTimestamp = await createAgentExperimentRecord({
    id: altered.id,
    ownerId: altered.ownerId,
    sourceRunId: 'different-source-run',
    benchmarkId: context.benchmarkId,
    createdAt: '2026-11-20T20:06:00.000Z',
    measurementContext: { ...context },
    evaluation: (() => {
      const result = evaluateAgentExperiment({
        priority: 'lowest_cost',
        criteria,
        candidates: ['candidate-a', 'candidate-b'].map((candidateId, index) => ({
          id: candidateId,
          currency: 'GBP',
          costMinorUnits: String(100 + index * 100),
          elapsedMs: 1000 + index * 100,
          safetyChecksPassed: true,
          safetyEvidenceRef: 'safety:' + candidateId,
          measurementContextId: context.id,
          criterionResults: [{ criterionId: 'correctness', outcome: 'pass', evidenceRef: 'criterion:' + candidateId }],
        })),
      });
      for (const candidate of result.candidates) {
        candidate.costEvidenceRef = 'cost:' + candidate.id;
        candidate.elapsedEvidenceRef = 'runtime:' + candidate.id;
      }
      return result;
    })(),
    evidence: [
      { ref: context.workloadEvidenceRef, kind: 'benchmark', sha256: context.workloadDigest },
      ...['candidate-a', 'candidate-b'].flatMap((candidateId) => [
        { ref: 'safety:' + candidateId, kind: 'safety' },
        { ref: 'cost:' + candidateId, kind: 'cost' },
        { ref: 'runtime:' + candidateId, kind: 'runtime' },
        { ref: 'criterion:' + candidateId, kind: 'criterion' },
      ]),
    ].map((item) => ({
      ...item,
      sha256: item.sha256 || 'sha256:' + 'b'.repeat(64),
      capturedAt: '2026-11-20T20:00:00.000Z',
    })),
  });

  assert.notEqual(original.recordDigest, alteredWithDifferentTimestamp.recordDigest);
  await assert.rejects(
    () => appendExperimentRecord(db, 'principal-a', alteredWithDifferentTimestamp),
    /different immutable content/i,
  );
});
