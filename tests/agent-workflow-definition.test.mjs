import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgentWorkflowDefinition } from '../workers/runtime/agent-workflow-definition.mjs';

const valid = {
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
};

test('creates a frozen, versioned workflow definition with explicit ordered dependencies', () => {
  const result = createAgentWorkflowDefinition(valid);
  assert.equal(result.schemaVersion, 'aegis.agent-workflow-definition.v1');
  assert.equal(result.workflowId, valid.workflowId);
  assert.equal(result.steps.length, 3);
  assert.equal(result.steps[2].dependsOn[0], 'analyse-findings');
  assert.equal(result.authority.sentinelApprovalRequired, true);
  assert.equal(result.authority.execution, 'not_authorised');
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.steps[0].capabilities), true);
});

test('rejects duplicate step identifiers', () => {
  const input = structuredClone(valid);
  input.steps[1].stepId = input.steps[0].stepId;
  assert.throws(() => createAgentWorkflowDefinition(input), /duplicate|step/i);
});

test('rejects dependencies that point forward or to unknown steps', () => {
  const input = structuredClone(valid);
  input.steps[0].dependsOn = ['analyse-findings'];
  assert.throws(() => createAgentWorkflowDefinition(input), /dependenc|precede|unknown/i);
});

test('requires human review for workspace writes and test execution capabilities', () => {
  for (const capability of ['workspace_write', 'test_run']) {
    const input = structuredClone(valid);
    input.steps[0].capabilities = [capability];
    input.steps[0].approval = 'none';
    assert.throws(() => createAgentWorkflowDefinition(input), /human|approval/i);
  }
});

test('rejects capabilities that could bypass Sentinel or reach production', () => {
  for (const capability of ['network_access', 'secret_read', 'production_deploy', 'sentinel_override', 'shell_unrestricted']) {
    const input = structuredClone(valid);
    input.steps[0].capabilities = [capability];
    assert.throws(() => createAgentWorkflowDefinition(input), /capability|allowlist/i);
  }
});

test('rejects automatic and model-delegated approval modes', () => {
  for (const approval of ['automatic', 'model_approved', 'assisted', 'approved']) {
    const input = structuredClone(valid);
    input.steps[0].approval = approval;
    assert.throws(() => createAgentWorkflowDefinition(input), /approval/i);
  }
});

test('requires evidence for inspect, analyse, propose and verify steps', () => {
  for (const kind of ['inspect', 'analyse', 'propose', 'verify']) {
    const input = structuredClone(valid);
    input.steps[0].kind = kind;
    input.steps[0].evidenceRequired = false;
    assert.throws(() => createAgentWorkflowDefinition(input), /evidence/i);
  }
});

test('rejects unknown fields and unbounded or malformed workflow input', () => {
  assert.throws(() => createAgentWorkflowDefinition({ ...valid, execute: true }), /field/i);
  assert.throws(() => createAgentWorkflowDefinition({ ...valid, steps: [] }), /step/i);
  assert.throws(() => createAgentWorkflowDefinition({ ...valid, steps: Array(21).fill(valid.steps[0]) }), /step|limit/i);
  assert.throws(() => createAgentWorkflowDefinition({ ...valid, createdAt: 'yesterday' }), /timestamp/i);
});
