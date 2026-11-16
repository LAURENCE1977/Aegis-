import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgentPlan } from '../workers/runtime/agents.mjs';
import { buildAgentPlanApprovalBinding } from '../workers/runtime/agent-plan-approval.mjs';

const runId = '00000000-0000-4000-8000-000000000123';

function validPlan() {
  return createAgentPlan(
    { objective: 'Review a proposed change safely.', specialists: ['researcher', 'reviewer'] },
    { runId, createdAt: '2026-11-16T12:00:00.000Z' },
  );
}

test('approval binding rejects a plan containing an unregistered specialist', async () => {
  const plan = validPlan();
  plan.steps[0].specialist = 'unregistered-agent';
  await assert.rejects(
    () => buildAgentPlanApprovalBinding(plan, 'owner'),
    /plan|step|specialist/i,
  );
});

test('approval binding rejects step identifiers that do not match their run and position', async () => {
  const plan = validPlan();
  plan.steps[0].id = '00000000-0000-4000-8000-000000000999:1';
  await assert.rejects(
    () => buildAgentPlanApprovalBinding(plan, 'owner'),
    /plan|step|identifier/i,
  );
});

test('approval binding rejects steps with unexpected fields', async () => {
  const plan = validPlan();
  plan.steps[0].externalAction = { type: 'write-file' };
  await assert.rejects(
    () => buildAgentPlanApprovalBinding(plan, 'owner'),
    /plan|step|field/i,
  );
});

test('approval binding rejects pre-populated step output', async () => {
  const plan = validPlan();
  plan.steps[0].output = 'unverified result';
  await assert.rejects(
    () => buildAgentPlanApprovalBinding(plan, 'owner'),
    /plan|step|output/i,
  );
});

test('approval binding rejects duplicate step identifiers', async () => {
  const plan = validPlan();
  plan.steps[1].id = plan.steps[0].id;
  await assert.rejects(
    () => buildAgentPlanApprovalBinding(plan, 'owner'),
    /plan|step|identifier/i,
  );
});
