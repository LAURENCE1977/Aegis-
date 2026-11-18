import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgentPlan } from '../workers/runtime/agents.mjs';
import {
  AGENT_PLAN_SCHEMA_VERSION,
  validateAgentPlanContract,
  listAgentSpecialists,
  getAgentSpecialist,
  validateAgentSpecialistManifest,
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
  first[0].limits.maxOutputBytes = 999999;
  assert.notEqual(listAgentSpecialists()[0].description, 'tampered');
  assert.deepEqual(listAgentSpecialists()[0].capabilityRequests, []);
  assert.equal(listAgentSpecialists()[0].limits.maxOutputBytes, 32768);
  assert.equal(getAgentSpecialist('researcher').id, 'researcher');
  assert.equal(getAgentSpecialist('self-authorising-agent'), null);
});

test('default specialists are derived from canonical specialist registry defaults', () => {
  assert.deepEqual(
    listAgentSpecialists().filter((item) => item.default).map((item) => item.id),
    ['researcher', 'engineer', 'reviewer'],
  );
});

test('canonical run-intent validator normalises objective and defaults from the specialist registry', async () => {
  const { validateAgentRunIntent, DEFAULT_AGENT_SPECIALISTS } = await import('../functions/lib/agent-contracts.mjs');
  assert.deepEqual(validateAgentRunIntent({ objective: '  Review the runtime  ' }), {
    objective: 'Review the runtime',
    specialists: [...DEFAULT_AGENT_SPECIALISTS],
  });
});

test('canonical run-intent validator rejects unknown fields, duplicate roles and unregistered roles', async () => {
  const { validateAgentRunIntent } = await import('../functions/lib/agent-contracts.mjs');
  assert.throws(() => validateAgentRunIntent({ objective: 'Review' + String.fromCharCode(1) + 'runtime' }), /safe characters/i);
  assert.throws(() => validateAgentRunIntent({ objective: 'Review', specialists: ['reviewer', 'reviewer'] }), /unique/i);
  assert.throws(() => validateAgentRunIntent({ objective: 'Review', specialists: ['shell'] }), /known/i);
  assert.throws(() => validateAgentRunIntent({ objective: '   ' }), /objective/i);
});

test('canonical run-intent validator rejects control characters', async () => {
  const { validateAgentRunIntent } = await import('../functions/lib/agent-contracts.mjs');
  assert.throws(() => validateAgentRunIntent({ objective: 'Review' + String.fromCharCode(1) + 'runtime' }), /safe characters/i);
});

test('specialist registry exposes versioned, bounded plan-only manifests', () => {
  for (const manifest of listAgentSpecialists()) {
    assert.equal(validateAgentSpecialistManifest(manifest), true);
    assert.equal(manifest.schemaVersion, '1.0');
    assert.match(manifest.manifestVersion, /^\\d+\\.\\d+\\.\\d+$/);
    assert.equal(manifest.executionMode, 'plan-only');
    assert.deepEqual(manifest.capabilityRequests, []);
    assert.deepEqual(manifest.limits, {
      maxInputBytes: 16384,
      maxOutputBytes: 32768,
      maxDurationMs: 60000,
    });
  }
});

test('specialist manifest validator rejects version drift, authority and unbounded limits', () => {
  const manifest = getAgentSpecialist('researcher');
  for (const candidate of [
    { ...manifest, schemaVersion: '2.0' },
    { ...manifest, executionMode: 'read-only' },
    { ...manifest, capabilityRequests: ['shell.execute'] },
    { ...manifest, limits: { ...manifest.limits, maxOutputBytes: 32769 } },
    { ...manifest, unreviewed: true },
  ]) assert.throws(() => validateAgentSpecialistManifest(candidate));
});
