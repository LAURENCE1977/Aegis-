import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgentWorkflowCheckpoint } from '../workers/runtime/agent-workflow-checkpoint.mjs';
import { createAgentWorkflowDefinition } from '../workers/runtime/agent-workflow-definition.mjs';
import { createAgentWorkflowRun } from '../workers/runtime/agent-workflow-run.mjs';

const definition = createAgentWorkflowDefinition({
  workflowId: 'defensive-review',
  title: 'Defensive review',
  version: 1,
  createdAt: '2026-11-21T14:00:00.000Z',
  steps: [
    { stepId: 'inspect', kind: 'inspect', dependsOn: [], capabilities: ['source_read'], evidenceRequired: true, approval: 'none' },
    { stepId: 'propose', kind: 'propose', dependsOn: ['inspect'], capabilities: ['workspace_write'], evidenceRequired: true, approval: 'human_required' },
  ],
});
const run = await createAgentWorkflowRun({
  definition,
  runId: 'run-defensive-review-001',
  createdAt: '2026-11-21T14:05:00.000Z',
  observedAt: '2026-11-21T15:00:00.000Z',
});
const common = {
  run,
  definition,
  checkpointId: 'checkpoint-001',
  sequence: 1,
  observedAt: '2026-11-21T14:10:00.000Z',
  eventType: 'step_progress_observed',
  stepId: 'inspect',
};

test('creates a frozen observation-only checkpoint bound to the exact run and definition', async () => {
  const checkpoint = await createAgentWorkflowCheckpoint(common);
  assert.equal(checkpoint.schemaVersion, 'aegis.agent-workflow-checkpoint.v1');
  assert.equal(checkpoint.runId, run.runId);
  assert.equal(checkpoint.workflowId, run.workflowId);
  assert.equal(checkpoint.definitionDigest, run.definitionDigest);
  assert.equal(checkpoint.sequence, 1);
  assert.equal(checkpoint.eventType, 'step_progress_observed');
  assert.equal(checkpoint.stepId, 'inspect');
  assert.equal(checkpoint.authority.execution, 'not_authorised');
  assert.equal(checkpoint.authority.sentinelApprovalRequired, true);
  assert.equal(checkpoint.authority.capabilitiesGranted, false);
  assert.equal(checkpoint.authority.executionOccurred, false);
  assert.match(checkpoint.checkpointDigest, /^sha256:[a-f0-9]{64}$/);
  assert.equal(Object.isFrozen(checkpoint), true);
});

test('produces a stable digest for equivalent evidence ordering and rejects mutable extra fields', async () => {
  const left = await createAgentWorkflowCheckpoint({
    ...common,
    eventType: 'evidence_reference_observed',
    evidence: [
      { evidenceId: 'source-file-01', digest: 'sha256:' + 'a'.repeat(64) },
      { evidenceId: 'test-log-01', digest: 'sha256:' + 'b'.repeat(64) },
    ],
  });
  const right = await createAgentWorkflowCheckpoint({
    ...common,
    eventType: 'evidence_reference_observed',
    evidence: [
      { digest: 'sha256:' + 'a'.repeat(64), evidenceId: 'source-file-01' },
      { digest: 'sha256:' + 'b'.repeat(64), evidenceId: 'test-log-01' },
    ],
  });
  assert.equal(left.checkpointDigest, right.checkpointDigest);
  await assert.rejects(() => createAgentWorkflowCheckpoint({
    ...common,
    unexpected: 'execute',
  }));
});

test('rejects a run envelope that does not match the supplied definition', async () => {
  const altered = createAgentWorkflowDefinition({
    workflowId: definition.workflowId,
    title: 'Different definition',
    version: 1,
    createdAt: definition.createdAt,
    steps: JSON.parse(JSON.stringify(definition.steps)),
  });
  await assert.rejects(() => createAgentWorkflowCheckpoint({ ...common, definition: altered }));
});

test('rejects sequence values outside the positive safe integer range', async () => {
  await assert.rejects(() => createAgentWorkflowCheckpoint({ ...common, sequence: 0 }));
  await assert.rejects(() => createAgentWorkflowCheckpoint({ ...common, sequence: 1.5 }));
  await assert.rejects(() => createAgentWorkflowCheckpoint({ ...common, sequence: Number.MAX_SAFE_INTEGER + 1 }));
});

test('rejects unknown steps and run-level events carrying step identifiers', async () => {
  await assert.rejects(() => createAgentWorkflowCheckpoint({ ...common, stepId: 'not-a-step' }));
  await assert.rejects(() => createAgentWorkflowCheckpoint({
    ...common, eventType: 'run_pause_observed', stepId: 'inspect',
  }));
});

test('requires bounded digest-only evidence references for evidence observations', async () => {
  await assert.rejects(() => createAgentWorkflowCheckpoint({
    ...common, eventType: 'evidence_reference_observed',
  }));
  await assert.rejects(() => createAgentWorkflowCheckpoint({
    ...common,
    eventType: 'evidence_reference_observed',
    evidence: [{ evidenceId: 'source-file-01', digest: 'not-a-digest' }],
  }));
  await assert.rejects(() => createAgentWorkflowCheckpoint({
    ...common,
    eventType: 'evidence_reference_observed',
    evidence: [{ evidenceId: 'source-file-01', digest: 'sha256:' + 'a'.repeat(64), rawContent: 'secret' }],
  }));
});

test('rejects invalid identifiers and non-canonical or pre-definition timestamps', async () => {
  await assert.rejects(() => createAgentWorkflowCheckpoint({ ...common, checkpointId: '../bad' }));
  await assert.rejects(() => createAgentWorkflowCheckpoint({ ...common, observedAt: 'tomorrow' }));
  await assert.rejects(() => createAgentWorkflowCheckpoint({
    ...common, observedAt: '2026-11-21T13:59:59.000Z',
  }));
});

test('accepts run-level pause and resume observations without implying execution authority', async () => {
  for (const eventType of ['run_pause_observed', 'run_resume_observed']) {
    const checkpoint = await createAgentWorkflowCheckpoint({
      ...common, eventType, stepId: null,
    });
    assert.equal(checkpoint.eventType, eventType);
    assert.equal(checkpoint.stepId, null);
    assert.equal(checkpoint.authority.executionOccurred, false);
  }
});
