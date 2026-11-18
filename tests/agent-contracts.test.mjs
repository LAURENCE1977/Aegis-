import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgentPlan } from '../workers/runtime/agents.mjs';
import {
  AGENT_PLAN_SCHEMA_VERSION,
  validateAgentPlanContract,
  listAgentSpecialists,
  getAgentSpecialist,
} from '../functions/lib/agent-contracts.mjs';

const RUN_ID = '00000000-0000-4000-8000-000000000123';

function validPlan() {
  return createAgentPlan(
    { objective: 'Review a proposed change safely.', specialists: ['researcher', 'reviewer'] },
    { runId: RUN_ID, createdAt: '2026-11-18T08:00:00.000Z' },
  );
}

test('canonical agent plan contract accepts a valid generated plan', () => {
  const plan = validPlan();
  assert.equal(plan.schemaVersion, AGENT_PLAN_SCHEMA_VERSION);
  assert.equal(validateAgentPlanContract(plan), true);
});

test('canonical agent plan contract rejects unknown top-level fields', () => {
  const plan = validPlan();
  plan.unreviewedPermission = true;
  assert.throws(() => validateAgentPlanContract(plan), /unexpected or missing fields/i);
});

test('canonical agent plan contract rejects unregistered specialists', () => {
  const plan = validPlan();
  plan.steps[0].specialist = 'self-authorising-agent';
  assert.throws(() => validateAgentPlanContract(plan), /specialist/i);
});

test('canonical agent plan contract rejects step identity substitution', () => {
  const plan = validPlan();
  plan.steps[0].id = '00000000-0000-4000-8000-000000000999:1';
  assert.throws(() => validateAgentPlanContract(plan), /identifier/i);
});

test('canonical agent plan contract rejects tool injection into plan-only steps', () => {
  const plan = validPlan();
  plan.steps[0].tools = ['shell'];
  assert.throws(() => validateAgentPlanContract(plan), /planned and contain no tools/i);
});

test('canonical agent plan contract rejects pre-populated outputs', () => {
  const plan = validPlan();
  plan.steps[0].output = { claimed: 'completed' };
  assert.throws(() => validateAgentPlanContract(plan), /pre-populated output/i);
});

test('canonical agent plan contract rejects plans that weaken Sentinel or approval requirements', () => {
  const plan = validPlan();
  plan.safety.sentinelRequiredForExecution = false;
  assert.throws(() => validateAgentPlanContract(plan), /safety guarantees/i);
});

test('canonical agent plan contract rejects unsupported schema versions', () => {
  const plan = validPlan();
  plan.schemaVersion = '99.0';
  assert.throws(() => validateAgentPlanContract(plan), /unsupported agent plan schema version/i);
});


test('canonical specialist registry exposes ordered, descriptive plan-only roles', () => {
  const specialists = listAgentSpecialists();
  assert.deepEqual(specialists.map((item) => item.id), [
    'researcher', 'planner', 'engineer', 'security', 'reviewer',
  ]);
  assert.ok(specialists.every((item) =>
    item.executionMode === 'plan-only' &&
    Array.isArray(item.capabilityRequests) &&
    item.capabilityRequests.length === 0 &&
    typeof item.description === 'string' && item.description.length > 10
  ));
});

test('specialist registry returns defensive copies and rejects unknown roles', () => {
  const first = listAgentSpecialists();
  first[0].description = 'tampered';
  first[0].capabilityRequests.push('shell.execute');
  assert.notEqual(listAgentSpecialists()[0].description, 'tampered');
  assert.deepEqual(listAgentSpecialists()[0].capabilityRequests, []);
  assert.equal(getAgentSpecialist('researcher').id, 'researcher');
  assert.equal(getAgentSpecialist('self-authorising-agent'), null);
});

test('default specialists are derived from canonical specialist registry defaults', () => {
  assert.deepEqual(
    listAgentSpecialists().filter((item) => item.default).map((item) => item.id),
    ['researcher', 'engineer', 'reviewer'],
  );
});
