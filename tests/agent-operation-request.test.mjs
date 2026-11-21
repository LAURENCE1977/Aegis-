import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgentOperationRequest } from '../workers/runtime/agent-operation-request.mjs';
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
  runId: 'run-ops-inbox-0001',
  createdAt: '2026-11-21T15:05:00.000Z',
  observedAt: '2026-11-21T15:30:00.000Z',
});

const checkpoint = await createAgentWorkflowCheckpoint({
  run,
  definition,
  checkpointId: 'checkpoint-ops-0001',
  sequence: 1,
  observedAt: '2026-11-21T15:10:00.000Z',
  eventType: 'evidence_reference_observed',
  stepId: 'prepare-change',
  evidence: [{
    evidenceId: 'artifact-diff-0001',
    digest: 'sha256:' + 'a'.repeat(64),
  }],
});

const action = {
  actionId: 'action-workspace-write-0001',
  actionType: 'workspace_write',
  summary: 'Write the reviewed configuration draft into the project workspace.',
  target: 'workspace:/drafts/service-config.json',
  parametersDigest: 'sha256:' + 'b'.repeat(64),
};

const input = {
  requestId: 'operation-request-0001',
  definition,
  run,
  checkpoint,
  action,
  createdAt: '2026-11-21T15:15:00.000Z',
};

test('creates an immutable request bound to exact workflow, checkpoint, action and evidence digests', async () => {
  const request = await createAgentOperationRequest(input);
  assert.equal(request.schemaVersion, 'aegis.agent-operation-request.v1');
  assert.equal(request.requestId, input.requestId);
  assert.equal(request.runId, run.runId);
  assert.equal(request.workflowId, definition.workflowId);
  assert.equal(request.checkpointId, checkpoint.checkpointId);
  assert.equal(request.checkpointDigest, checkpoint.checkpointDigest);
  assert.match(request.actionDigest, /^sha256:[a-f0-9]{64}$/);
  assert.match(request.evidenceDigest, /^sha256:[a-f0-9]{64}$/);
  assert.equal(request.status, 'awaiting_human_review');
  assert.equal(request.authority.sentinelApprovalRequired, true);
  assert.equal(request.authority.approvalGranted, false);
  assert.equal(request.authority.execution, 'not_authorised');
  assert.equal(request.authority.capabilitiesGranted, false);
  assert.equal(request.authority.selfApproval, false);
  assert.ok(Object.isFrozen(request));
  assert.ok(Object.isFrozen(request.action));
  assert.ok(Object.isFrozen(request.evidence));
});

test('rejects a checkpoint that is not an evidence-reference observation', async () => {
  const progress = await createAgentWorkflowCheckpoint({
    run, definition, checkpointId: 'checkpoint-progress-0001', sequence: 2,
    observedAt: '2026-11-21T15:11:00.000Z', eventType: 'step_progress_observed',
    stepId: 'prepare-change',
  });
  await assert.rejects(
    () => createAgentOperationRequest({ ...input, checkpoint: progress }),
    /evidence/i,
  );
});

test('rejects a checkpoint with no evidence references', async () => {
  const empty = await createAgentWorkflowCheckpoint({
    run, definition, checkpointId: 'checkpoint-empty-0001', sequence: 2,
    observedAt: '2026-11-21T15:11:00.000Z', eventType: 'step_progress_observed',
    stepId: 'prepare-change',
  });
  await assert.rejects(
    () => createAgentOperationRequest({ ...input, checkpoint: empty }),
    /evidence/i,
  );
});

test('rejects unsupported action types and malformed parameter digests', async () => {
  await assert.rejects(
    () => createAgentOperationRequest({ ...input, action: { ...action, actionType: 'shell_unrestricted' } }),
    /action type/i,
  );
  await assert.rejects(
    () => createAgentOperationRequest({ ...input, action: { ...action, parametersDigest: 'plain text' } }),
    /digest/i,
  );
});

test('rejects unbounded, unsafe or incomplete action descriptions', async () => {
  await assert.rejects(
    () => createAgentOperationRequest({ ...input, action: { ...action, summary: ' ' } }),
    /summary/i,
  );
  await assert.rejects(
    () => createAgentOperationRequest({ ...input, action: { ...action, target: 'target\nforged' } }),
    /target/i,
  );
  await assert.rejects(
    () => createAgentOperationRequest({ ...input, action: { ...action, summary: 'x'.repeat(1001) } }),
    /summary/i,
  );
});

test('rejects request timestamps before the evidence checkpoint or after server observation', async () => {
  await assert.rejects(
    () => createAgentOperationRequest({ ...input, createdAt: '2026-11-21T15:09:00.000Z' }),
    /checkpoint/i,
  );
  await assert.rejects(
    () => createAgentOperationRequest({ ...input, createdAt: '2026-11-21T15:31:00.000Z', observedAt: '2026-11-21T15:30:00.000Z' }),
    /future/i,
  );
});

test('rejects modified workflow and checkpoint envelopes', async () => {
  await assert.rejects(
    () => createAgentOperationRequest({ ...input, run: { ...run, execution: 'authorised' } }),
    /workflow run/i,
  );
  await assert.rejects(
    () => createAgentOperationRequest({ ...input, checkpoint: { ...checkpoint, checkpointDigest: 'sha256:' + 'f'.repeat(64) } }),
    /checkpoint/i,
  );
});

test('rejects accessors and unknown fields without invoking untrusted getters', async () => {
  let invoked = false;
  const unsafeAction = { ...action };
  Object.defineProperty(unsafeAction, 'target', {
    enumerable: true,
    get() { invoked = true; return 'workspace:/safe'; },
  });
  await assert.rejects(
    () => createAgentOperationRequest({ ...input, action: unsafeAction }),
    /accessor|unsupported/i,
  );
  assert.equal(invoked, false);
  await assert.rejects(
    () => createAgentOperationRequest({ ...input, callerApproved: true }),
    /unsupported/i,
  );
});
