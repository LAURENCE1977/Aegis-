import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAgentPlan,
  validateAgentRunSubmission,
} from '../workers/runtime/agents.mjs';

test('accepts a bounded objective and defaults to the coordinator workflow', () => {
  assert.deepEqual(validateAgentRunSubmission({ objective: 'Review the AEGIS runtime' }), {
    objective: 'Review the AEGIS runtime',
    specialists: ['researcher', 'engineer', 'reviewer'],
  });
});

test('rejects empty, oversized and non-text objectives', () => {
  for (const input of [
    { objective: '' },
    { objective: ' '.repeat(5) },
    { objective: 'x'.repeat(2001) },
    { objective: 42 },
    null,
    [],
  ]) assert.throws(() => validateAgentRunSubmission(input));
});

test('accepts only known specialist roles and rejects duplicates', () => {
  assert.deepEqual(
    validateAgentRunSubmission({ objective: 'Assess security', specialists: ['security', 'reviewer'] }).specialists,
    ['security', 'reviewer'],
  );
  assert.throws(() => validateAgentRunSubmission({ objective: 'Assess security', specialists: ['shell'] }));
  assert.throws(() => validateAgentRunSubmission({ objective: 'Assess security', specialists: ['reviewer', 'reviewer'] }));
});

test('rejects unexpected fields so callers cannot smuggle tools or permissions', () => {
  assert.throws(() => validateAgentRunSubmission({
    objective: 'Review code',
    tools: ['shell.exec'],
    permissions: ['admin'],
  }));
});

test('creates a deterministic plan with explicit human approval gates', () => {
  const input = validateAgentRunSubmission({
    objective: 'Improve durable orchestration',
    specialists: ['researcher', 'engineer', 'reviewer'],
  });
  const plan = createAgentPlan(input, { runId: 'run-123', createdAt: '2026-11-15T20:00:00.000Z' });
  assert.equal(plan.runId, 'run-123');
  assert.deepEqual(plan.steps.map((step) => step.specialist), ['researcher', 'engineer', 'reviewer']);
  assert.ok(plan.steps.every((step) => step.status === 'planned'));
  assert.ok(plan.steps.every((step) => step.tools.length === 0));
  assert.equal(plan.execution, 'plan-only');
  assert.equal(plan.requiresHumanApprovalBeforeExecution, true);
});

test('rejects invalid plan metadata', () => {
  const input = validateAgentRunSubmission({ objective: 'Review code' });
  assert.throws(() => createAgentPlan(input, { runId: '', createdAt: 'not-a-date' }));
});

test('plan creation revalidates stored specialist data instead of trusting D1 rows', () => {
  const metadata = { runId: 'run-unsafe', createdAt: '2026-11-16T00:00:00.000Z' };
  assert.throws(() => createAgentPlan({ objective: 'Review', specialists: ['shell'] }, metadata));
  assert.throws(() => createAgentPlan({ objective: 'Review', specialists: ['reviewer', 'reviewer'] }, metadata));
  assert.throws(() => createAgentPlan({ objective: 'Review', specialists: ['reviewer'], tools: ['shell.exec'] }, metadata));
});
