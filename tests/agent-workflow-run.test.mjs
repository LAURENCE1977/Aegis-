import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgentWorkflowRun } from '../workers/runtime/agent-workflow-run.mjs';
import { createAgentWorkflowDefinition } from '../workers/runtime/agent-workflow-definition.mjs';

const definition = createAgentWorkflowDefinition({
  workflowId: 'software-review',
  title: 'Defensive software review',
  version: 1,
  createdAt: '2026-11-21T14:00:00.000Z',
  steps: [
    {
      stepId: 'inspect-source',
      kind: 'inspect',
      dependsOn: [],
      capabilities: ['source_read'],
      evidenceRequired: true,
      approval: 'none',
    },
    {
      stepId: 'analyse-findings',
      kind: 'analyse',
      dependsOn: ['inspect-source'],
      capabilities: ['workspace_read'],
      evidenceRequired: true,
      approval: 'none',
    },
    {
      stepId: 'prepare-proposal',
      kind: 'propose',
      dependsOn: ['analyse-findings'],
      capabilities: ['workspace_write'],
      evidenceRequired: true,
      approval: 'human_required',
    },
  ],
});

const metadata = {
  runId: 'run-software-review-001',
  createdAt: '2026-11-21T15:30:00.000Z',
};

test('creates an immutable plan-only run envelope pinned to the workflow definition digest', async () => {
  const run = await createAgentWorkflowRun({ definition, ...metadata });
  assert.equal(run.schemaVersion, 'aegis.agent-workflow-run.v1');
  assert.equal(run.workflowId, definition.workflowId);
  assert.equal(run.runId, metadata.runId);
  assert.match(run.definitionDigest, /^sha256:[a-f0-9]{64}$/);
  assert.equal(run.execution, 'plan-only');
  assert.equal(run.status, 'planned');
  assert.deepEqual(run.steps.map(step => step.stepId), definition.steps.map(step => step.stepId));
  assert.ok(run.steps.every(step => step.status === 'planned' && step.evidence.length === 0));
  assert.equal(run.authority.sentinelApprovalRequired, true);
  assert.equal(run.authority.execution, 'not_authorised');
  assert.equal(run.authority.capabilitiesGranted, false);
  assert.equal(run.authority.agentSpawning, false);
  assert.equal(Object.isFrozen(run), true);
  assert.equal(Object.isFrozen(run.steps[0].evidence), true);
});

test('produces the same definition digest for equivalent key ordering', async () => {
  const reordered = JSON.parse(JSON.stringify(definition));
  reordered.steps = reordered.steps.map(step => ({
    approval: step.approval,
    evidenceRequired: step.evidenceRequired,
    capabilities: [...step.capabilities],
    dependsOn: [...step.dependsOn],
    kind: step.kind,
    stepId: step.stepId,
  }));
  const [left, right] = await Promise.all([
    createAgentWorkflowRun({ definition, ...metadata }),
    createAgentWorkflowRun({ definition: reordered, ...metadata }),
  ]);
  assert.equal(left.definitionDigest, right.definitionDigest);
});

test('pins changes to the workflow definition with a different digest', async () => {
  const changed = createAgentWorkflowDefinition({
    workflowId: definition.workflowId,
    title: 'Updated defensive software review',
    version: definition.version,
    createdAt: definition.createdAt,
    steps: JSON.parse(JSON.stringify(definition.steps)),
  });
  const [left, right] = await Promise.all([
    createAgentWorkflowRun({ definition, ...metadata }),
    createAgentWorkflowRun({ definition: changed, ...metadata }),
  ]);
  assert.notEqual(left.definitionDigest, right.definitionDigest);
});

test('rejects altered or extended definition records instead of trusting their schema label', async () => {
  const altered = JSON.parse(JSON.stringify(definition));
  altered.steps[0].capabilities = ['shell_unrestricted'];
  await assert.rejects(() => createAgentWorkflowRun({ definition: altered, ...metadata }));
  await assert.rejects(() => createAgentWorkflowRun({
    definition: { ...JSON.parse(JSON.stringify(definition)), execute: true },
    ...metadata,
  }));
});

test('rejects invalid run identifiers and non-canonical timestamps', async () => {
  await assert.rejects(() => createAgentWorkflowRun({
    definition, runId: '../production', createdAt: metadata.createdAt,
  }));
  await assert.rejects(() => createAgentWorkflowRun({
    definition, runId: metadata.runId, createdAt: 'yesterday',
  }));
});

test('rejects a future run timestamp relative to an explicit observation time', async () => {
  await assert.rejects(() => createAgentWorkflowRun({
    definition,
    ...metadata,
    observedAt: '2026-11-21T15:00:00.000Z',
  }), /future|observation/i);
});

test('rejects non-object and missing definition inputs', async () => {
  await assert.rejects(() => createAgentWorkflowRun(null));
  await assert.rejects(() => createAgentWorkflowRun({ ...metadata }));
});
