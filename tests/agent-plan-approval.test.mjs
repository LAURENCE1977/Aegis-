import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAgentPlanApprovalBinding } from '../workers/runtime/agent-plan-approval.mjs';
import { getCapabilityManifest } from '../functions/lib/capability-registry.mjs';

const plan = {
  runId: '00000000-0000-4000-8000-000000000001',
  objective: 'Review the AEGIS runtime',
  execution: 'plan-only',
  requiresHumanApprovalBeforeExecution: true,
  steps: [{ id: 'step-1', specialist: 'reviewer', status: 'planned', tools: [], output: null }],
  safety: { toolsInvoked: false, externalEffects: false, sentinelRequiredForExecution: true, approvalRequiredForProtectedActions: true },
};

test('builds an approval binding for the exact immutable plan digest', async () => {
  const binding = await buildAgentPlanApprovalBinding(plan, 'owner');
  assert.equal(binding.principalId, 'owner');
  assert.equal(binding.capabilityId, 'aegis-agent-run');
  assert.equal(binding.capabilityVersion, '0.1.0');
  assert.equal(binding.actionId, 'approve-execution');
  assert.equal(binding.resourceId, 'agent-run:' + plan.runId);
  assert.match(binding.inputDigest, /^sha256:[a-f0-9]{64}$/);
  assert.match(binding.operationSummary, /00000000-0000-4000-8000-000000000001/);
  assert.equal(binding.connectionId, null);
  assert.equal(binding.requestedBy, 'owner');
});

test('plan changes produce a different approval digest', async () => {
  const first = await buildAgentPlanApprovalBinding(plan, 'owner');
  const changed = await buildAgentPlanApprovalBinding({
    ...plan,
    steps: [{ ...plan.steps[0], specialist: 'security' }],
  }, 'owner');
  assert.notEqual(first.inputDigest, changed.inputDigest);
});

test('rejects plans that are not strictly plan-only or contain proposed tools', async () => {
  await assert.rejects(() => buildAgentPlanApprovalBinding({ ...plan, execution: 'execute' }, 'owner'), /plan-only/i);
  await assert.rejects(() => buildAgentPlanApprovalBinding({
    ...plan,
    steps: [{ ...plan.steps[0], tools: ['shell.exec'] }],
  }, 'owner'), /tools/i);
  await assert.rejects(() => buildAgentPlanApprovalBinding({
    ...plan,
    safety: { ...plan.safety, externalEffects: true },
  }, 'owner'), /safety/i);
});

test('rejects invalid plan identifiers and owner principals', async () => {
  await assert.rejects(() => buildAgentPlanApprovalBinding({ ...plan, runId: '../other' }, 'owner'), /run/i);
  await assert.rejects(() => buildAgentPlanApprovalBinding(plan, ''), /principal/i);
});


test('agent plan approval binding exactly matches the registered critical capability contract', async () => {
  const manifest = getCapabilityManifest('aegis-agent-run');
  assert.ok(manifest);
  const binding = await buildAgentPlanApprovalBinding(plan, 'owner');
  assert.equal(binding.capabilityId, manifest.id);
  assert.equal(binding.capabilityVersion, manifest.version);
  const action = manifest.actions.find((entry) => entry.id === binding.actionId);
  assert.ok(action);
  assert.equal(action.effect, 'execute');
  assert.equal(action.risk, 'critical');
  assert.equal(action.approval, 'human-always');
  assert.deepEqual(action.requiredScopes, ['aegis:agent-run:execute']);
});
