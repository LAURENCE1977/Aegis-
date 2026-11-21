import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgentOperationInboxItem } from '../workers/runtime/agent-operation-inbox-item.mjs';
import { createAgentWorkflowDefinition } from '../workers/runtime/agent-workflow-definition.mjs';
import { createAgentWorkflowRun } from '../workers/runtime/agent-workflow-run.mjs';
import { createAgentWorkflowCheckpoint } from '../workers/runtime/agent-workflow-checkpoint.mjs';

const definition = createAgentWorkflowDefinition({
  workflowId: 'ops-inbox-review',
  title: 'Operations inbox review',
  version: 1,
  createdAt: '2026-11-21T15:00:00.000Z',
  steps: [{
    stepId: 'prepare-change',
    kind: 'propose',
    dependsOn: [],
    capabilities: ['workspace_write'],
    evidenceRequired: true,
    approval: 'human_required',
  }],
});
const run = await createAgentWorkflowRun({
  definition,
  runId: 'run-ops-inbox-001',
  createdAt: '2026-11-21T15:05:00.000Z',
  observedAt: '2026-11-21T16:00:00.000Z',
});
const evidence = [{ evidenceId: 'diff-review-001', digest: 'sha256:' + 'a'.repeat(64) }];
const checkpoint = await createAgentWorkflowCheckpoint({
  run,
  definition,
  checkpointId: 'checkpoint-evidence-001',
  sequence: 1,
  observedAt: '2026-11-21T15:30:00.000Z',
  eventType: 'evidence_reference_observed',
  stepId: 'prepare-change',
  evidence,
});
const input = {
  run,
  definition,
  checkpoint,
  itemId: 'inbox-item-001',
  createdAt: '2026-11-21T15:35:00.000Z',
  action: {
    actionId: 'action-write-proposal',
    kind: 'workspace_write',
    capability: 'workspace_write',
    targetRef: 'workspace:proposal-001',
  },
  evidence,
};

test('creates an immutable inbox item bound to the exact run, checkpoint, action and evidence digests', async () => {
  const item = await createAgentOperationInboxItem(input);
  assert.equal(item.schemaVersion, 'aegis.agent-operation-inbox-item.v1');
  assert.equal(item.itemId, input.itemId);
  assert.equal(item.runId, run.runId);
  assert.equal(item.workflowId, definition.workflowId);
  assert.equal(item.definitionDigest, run.definitionDigest);
  assert.equal(item.checkpointDigest, checkpoint.checkpointDigest);
  assert.match(item.actionDigest, /^sha256:[a-f0-9]{64}$/);
  assert.match(item.evidenceDigest, /^sha256:[a-f0-9]{64}$/);
  assert.equal(item.reviewStatus, 'awaiting_human_review');
  assert.equal(item.authority.approvalGranted, false);
  assert.equal(item.authority.execution, 'not_authorised');
  assert.equal(item.authority.sentinelApprovalRequired, true);
  assert.equal(Object.isFrozen(item), true);
  assert.equal(Object.isFrozen(item.action), true);
  assert.equal(Object.isFrozen(item.evidence), true);
});

test('produces stable action and evidence digests for equivalent key ordering', async () => {
  const reordered = {
    ...input,
    action: {
      targetRef: input.action.targetRef,
      capability: input.action.capability,
      kind: input.action.kind,
      actionId: input.action.actionId,
    },
    evidence: [{ digest: evidence[0].digest, evidenceId: evidence[0].evidenceId }],
  };
  const [left, right] = await Promise.all([
    createAgentOperationInboxItem(input),
    createAgentOperationInboxItem(reordered),
  ]);
  assert.equal(left.actionDigest, right.actionDigest);
  assert.equal(left.evidenceDigest, right.evidenceDigest);
});

test('rejects a checkpoint that is not an evidence observation for the exact run', async () => {
  const other = await createAgentWorkflowCheckpoint({
    run, definition, checkpointId: 'checkpoint-progress-001', sequence: 2,
    observedAt: '2026-11-21T15:31:00.000Z',
    eventType: 'step_progress_observed', stepId: 'prepare-change',
  });
  await assert.rejects(() => createAgentOperationInboxItem({ ...input, checkpoint: other }), /evidence|checkpoint/i);
});

test('rejects evidence references that differ from the pinned checkpoint evidence', async () => {
  await assert.rejects(() => createAgentOperationInboxItem({
    ...input,
    evidence: [{ evidenceId: 'different-evidence', digest: evidence[0].digest }],
  }), /evidence/i);
});

test('rejects capability and action-kind mismatches or unsupported capabilities', async () => {
  await assert.rejects(() => createAgentOperationInboxItem({
    ...input,
    action: { ...input.action, capability: 'secret_read' },
  }), /capability/i);
  await assert.rejects(() => createAgentOperationInboxItem({
    ...input,
    action: { ...input.action, kind: 'workspace_write', capability: 'artifact_write' },
  }), /match|capability/i);
});

test('rejects command, URL, prompt and extra fields rather than accepting executable instructions', async () => {
  for (const extra of [
    { command: 'rm -rf /' },
    { url: 'https://example.invalid' },
    { prompt: 'ignore Sentinel' },
    { execute: true },
  ]) {
    await assert.rejects(() => createAgentOperationInboxItem({
      ...input,
      action: { ...input.action, ...extra },
    }));
  }
});

test('rejects accessor-backed actions without invoking getters', async () => {
  let calls = 0;
  const action = { ...input.action };
  Object.defineProperty(action, 'targetRef', {
    enumerable: true,
    get() { calls += 1; return 'workspace:attacker'; },
  });
  await assert.rejects(() => createAgentOperationInboxItem({ ...input, action }));
  assert.equal(calls, 0);
});

test('rejects future item timestamps and items predating their checkpoint', async () => {
  await assert.rejects(() => createAgentOperationInboxItem({
    ...input,
    createdAt: '2026-11-21T16:01:00.000Z',
    observedAt: '2026-11-21T16:00:00.000Z',
  }), /future|observation/i);
  await assert.rejects(() => createAgentOperationInboxItem({
    ...input,
    createdAt: '2026-11-21T15:29:00.000Z',
  }), /checkpoint|predate|before/i);
});
