import test from 'node:test';
import assert from 'node:assert/strict';
import { appendAgentWorkflowCheckpoint, listAgentWorkflowCheckpoints } from '../workers/runtime/agent-workflow-checkpoint-store.mjs';
import { createAgentWorkflowCheckpoint } from '../workers/runtime/agent-workflow-checkpoint.mjs';
import { createAgentWorkflowDefinition } from '../workers/runtime/agent-workflow-definition.mjs';
import { createAgentWorkflowRun } from '../workers/runtime/agent-workflow-run.mjs';

const definition = createAgentWorkflowDefinition({
  workflowId: 'store-review',
  title: 'Checkpoint store review',
  version: 1,
  createdAt: '2026-11-21T14:00:00.000Z',
  steps: [
    { stepId: 'inspect', kind: 'inspect', dependsOn: [], capabilities: ['source_read'], evidenceRequired: true, approval: 'none' },
  ],
});
const run = await createAgentWorkflowRun({
  definition, runId: 'run-store-review-001',
  createdAt: '2026-11-21T14:05:00.000Z',
  observedAt: '2026-11-21T15:00:00.000Z',
});
const now = '2026-11-21T15:00:00.000Z';

async function checkpoint(sequence, checkpointId = 'checkpoint-' + sequence) {
  return createAgentWorkflowCheckpoint({
    run, definition, checkpointId, sequence,
    observedAt: '2026-11-21T14:' + String(10 + sequence).padStart(2, '0') + ':00.000Z',
    eventType: 'step_progress_observed',
    stepId: 'inspect',
  });
}

class FakeD1 {
  constructor() { this.rows = new Map(); }
  prepare(sql) {
    const db = this;
    return {
      bind(...values) {
        return {
          async run() {
            const [owner, runId, sequence, checkpointId, workflowId, definitionDigest, checkpointDigest, json, observedAt, expected, expectedOwner, expectedRun] = values;
            assert.equal(owner, expectedOwner);
            assert.equal(runId, expectedRun);
            const rows = [...db.rows.values()].filter(row => row.principal_id === owner && row.run_id === runId);
            const next = rows.reduce((max, row) => Math.max(max, row.sequence), 0) + 1;
            if (sequence !== expected || sequence !== next) return { success: true, meta: { changes: 0 } };
            const key = JSON.stringify([owner, runId, sequence]);
            if (db.rows.has(key) || rows.some(row => row.checkpoint_id === checkpointId)) {
              return { success: true, meta: { changes: 0 } };
            }
            db.rows.set(key, { principal_id: owner, run_id: runId, sequence, checkpoint_id: checkpointId, workflow_id: workflowId, definition_digest: definitionDigest, checkpoint_digest: checkpointDigest, checkpoint_json: json, observed_at: observedAt });
            return { success: true, meta: { changes: 1 } };
          },
          async first() {
            if (/checkpoint_id\s*=\s*\?/i.test(sql)) {
              const [owner, runId, checkpointId] = values;
              return [...db.rows.values()].find(row => row.principal_id === owner && row.run_id === runId && row.checkpoint_id === checkpointId) || null;
            }
            if (/MAX\(sequence\)/i.test(sql)) {
              const [owner, runId] = values;
              const rows = [...db.rows.values()].filter(row => row.principal_id === owner && row.run_id === runId);
              return { next_sequence: rows.reduce((max, row) => Math.max(max, row.sequence), 0) + 1 };
            }
            return null;
          },
          async all() {
            const [owner, runId, afterSequence, limit] = values;
            return { results: [...db.rows.values()]
              .filter(row => row.principal_id === owner && row.run_id === runId && row.sequence > afterSequence)
              .sort((a, b) => a.sequence - b.sequence)
              .slice(0, limit) };
          },
        };
      },
    };
  }
}

test('appends owner-scoped checkpoints in strict sequence and lists verified history', async () => {
  const db = new FakeD1();
  const first = await appendAgentWorkflowCheckpoint({ db, principalId: 'owner-a', run, definition, checkpoint: await checkpoint(1), now });
  const second = await appendAgentWorkflowCheckpoint({ db, principalId: 'owner-a', run, definition, checkpoint: await checkpoint(2), now });
  assert.equal(first.status, 'appended');
  assert.equal(second.status, 'appended');
  const history = await listAgentWorkflowCheckpoints({ db, principalId: 'owner-a', runId: run.runId });
  assert.deepEqual(history.checkpoints.map(item => item.sequence), [1, 2]);
  assert.equal(history.nextAfterSequence, 2);
});

test('makes an exact checkpoint retry idempotent without creating another row', async () => {
  const db = new FakeD1();
  const item = await checkpoint(1);
  const first = await appendAgentWorkflowCheckpoint({ db, principalId: 'owner-a', run, definition, checkpoint: item, now });
  const retry = await appendAgentWorkflowCheckpoint({ db, principalId: 'owner-a', run, definition, checkpoint: item, now });
  assert.equal(first.status, 'appended');
  assert.equal(retry.status, 'already_recorded');
  assert.equal(db.rows.size, 1);
});

test('rejects sequence gaps and conflicting checkpoint identities without overwriting history', async () => {
  const db = new FakeD1();
  const gap = await appendAgentWorkflowCheckpoint({ db, principalId: 'owner-a', run, definition, checkpoint: await checkpoint(2), now });
  assert.equal(gap.status, 'sequence_conflict');
  assert.equal(gap.expectedNextSequence, 1);
  const first = await appendAgentWorkflowCheckpoint({ db, principalId: 'owner-a', run, definition, checkpoint: await checkpoint(1), now });
  assert.equal(first.status, 'appended');
  const conflict = await appendAgentWorkflowCheckpoint({
    db, principalId: 'owner-a', run, definition,
    checkpoint: await checkpoint(1, 'different-checkpoint-id'), now,
  });
  assert.equal(conflict.status, 'sequence_conflict');
  assert.equal(db.rows.size, 1);
});

test('isolates identical run identifiers across authenticated principals', async () => {
  const db = new FakeD1();
  const item = await checkpoint(1);
  const a = await appendAgentWorkflowCheckpoint({ db, principalId: 'owner-a', run, definition, checkpoint: item, now });
  const b = await appendAgentWorkflowCheckpoint({ db, principalId: 'owner-b', run, definition, checkpoint: item, now });
  assert.equal(a.status, 'appended');
  assert.equal(b.status, 'appended');
  assert.equal(db.rows.size, 2);
  const hidden = await listAgentWorkflowCheckpoints({ db, principalId: 'owner-c', runId: run.runId });
  assert.deepEqual(hidden.checkpoints, []);
});

test('concurrent attempts for the same next sequence accept exactly one checkpoint', async () => {
  const db = new FakeD1();
  const attempts = await Promise.all(Array.from({ length: 12 }, (_, index) =>
    checkpoint(1, 'parallel-' + index).then(item =>
      appendAgentWorkflowCheckpoint({ db, principalId: 'owner-a', run, definition, checkpoint: item, now }))));
  assert.equal(attempts.filter(item => item.status === 'appended').length, 1);
  assert.equal(db.rows.size, 1);
});

test('rejects forged run or checkpoint envelopes and invalid authenticated principals', async () => {
  const db = new FakeD1();
  const item = await checkpoint(1);
  await assert.rejects(() => appendAgentWorkflowCheckpoint({ db, principalId: '../owner', run, definition, checkpoint: item, now }));
  await assert.rejects(() => appendAgentWorkflowCheckpoint({
    db, principalId: 'owner-a', run: { ...run, execution: 'authorised' }, definition, checkpoint: item, now,
  }));
  await assert.rejects(() => appendAgentWorkflowCheckpoint({
    db, principalId: 'owner-a', run, definition, checkpoint: { ...item, sequence: 9 }, now,
  }));
});

test('rejects tampered stored checkpoint bytes when reading history', async () => {
  const db = new FakeD1();
  await appendAgentWorkflowCheckpoint({ db, principalId: 'owner-a', run, definition, checkpoint: await checkpoint(1), now });
  const row = [...db.rows.values()][0];
  row.checkpoint_json = row.checkpoint_json.replace('step_progress_observed', 'blocker_observed');
  await assert.rejects(() => listAgentWorkflowCheckpoints({ db, principalId: 'owner-a', runId: run.runId }), /integrity|digest|metadata/i);
});
