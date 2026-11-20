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
    acceptanceCriteria: [],
    priority: 'balanced',
    assumptions: [],
    constraints: [],
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

test('validates explicit outcome acceptance criteria and planning priority', () => {
  const submission = validateAgentRunSubmission({
    objective: 'Build a reliable research workflow',
    acceptanceCriteria: ['Every claim has a source', 'No unapproved tool calls'],
    priority: 'highest_reliability',
  });
  assert.deepEqual(submission.acceptanceCriteria, [
    'Every claim has a source',
    'No unapproved tool calls',
  ]);
  assert.equal(submission.priority, 'highest_reliability');
});

test('rejects malformed, excessive or oversized acceptance criteria and unknown priorities', () => {
  for (const acceptanceCriteria of [
    'one criterion',
    [''],
    ['x'.repeat(241)],
    Array.from({ length: 9 }, (_, i) => 'criterion ' + i),
    ['same', 'same'],
  ]) {
    assert.throws(() => validateAgentRunSubmission({
      objective: 'Plan a task',
      acceptanceCriteria,
    }));
  }
  assert.throws(() => validateAgentRunSubmission({
    objective: 'Plan a task',
    priority: 'ignore-safety',
  }));
});

test('creates comparable plan-only approaches and recommends one against the declared priority', () => {
  const input = validateAgentRunSubmission({
    objective: 'Improve durable orchestration',
    specialists: ['researcher', 'engineer', 'reviewer'],
    acceptanceCriteria: ['All changes have regression tests', 'No production side effects'],
    priority: 'highest_reliability',
  });
  const plan = createAgentPlan(input, { runId: 'run-123', createdAt: '2026-11-15T20:00:00.000Z' });
  assert.equal(plan.runId, 'run-123');
  assert.deepEqual(plan.steps.map((step) => step.specialist), ['researcher', 'engineer', 'reviewer']);
  assert.ok(plan.steps.every((step) => step.status === 'planned'));
  assert.ok(plan.steps.every((step) => step.tools.length === 0));
  assert.equal(plan.execution, 'plan-only');
  assert.equal(plan.requiresHumanApprovalBeforeExecution, true);
  assert.deepEqual(plan.acceptanceCriteria, input.acceptanceCriteria);
  assert.equal(plan.recommendedApproach, 'staged');
  assert.deepEqual(plan.approaches.map((approach) => approach.id), ['lean', 'parallel_discovery', 'staged']);
  assert.ok(plan.approaches.every((approach) => approach.execution === 'plan-only'));
  assert.ok(plan.approaches.every((approach) => approach.tools.length === 0));
  assert.equal(plan.safety.externalEffects, false);
  assert.equal(plan.safety.sentinelRequiredForExecution, true);
});

test('maps explicit planning priorities to the matching approach without removing alternatives', () => {
  const metadata = { runId: 'run-priority', createdAt: '2026-11-16T00:00:00.000Z' };
  const cases = [
    ['lowest_cost', 'lean'],
    ['fastest', 'parallel_discovery'],
    ['highest_reliability', 'staged'],
    ['balanced', 'staged'],
  ];
  for (const [priority, expected] of cases) {
    const plan = createAgentPlan(validateAgentRunSubmission({
      objective: 'Review the runtime',
      priority,
    }), metadata);
    assert.equal(plan.recommendedApproach, expected);
    assert.equal(plan.approaches.length, 3);
  }
});

test('rejects invalid plan metadata', () => {
  const input = validateAgentRunSubmission({ objective: 'Review code' });
  assert.throws(() => createAgentPlan(input, { runId: '', createdAt: 'not-a-date' }));
});

test('plan creation revalidates stored specialist and outcome data instead of trusting D1 rows', () => {
  const metadata = { runId: 'run-unsafe', createdAt: '2026-11-16T00:00:00.000Z' };
  assert.throws(() => createAgentPlan({ objective: 'Review', specialists: ['shell'] }, metadata));
  assert.throws(() => createAgentPlan({ objective: 'Review', specialists: ['reviewer', 'reviewer'] }, metadata));
  assert.throws(() => createAgentPlan({ objective: 'Review', specialists: ['reviewer'], tools: ['shell.exec'] }, metadata));
  assert.throws(() => createAgentPlan({
    objective: 'Review',
    specialists: ['reviewer'],
    acceptanceCriteria: ['x'.repeat(241)],
  }, metadata));
});


test('validates bounded assumptions and constraints and exposes a contrarian review', () => {
  const input = validateAgentRunSubmission({
    objective: 'Choose a robust approach',
    assumptions: ['The existing runtime remains authoritative'],
    constraints: ['No production side effects'],
  });
  const plan = createAgentPlan(input, {
    runId: 'run-first-principles',
    createdAt: '2026-11-20T20:00:00.000Z',
  });
  assert.deepEqual(plan.assumptions, ['The existing runtime remains authoritative']);
  assert.deepEqual(plan.constraints, ['No production side effects']);
  assert.equal(plan.decision.recommendedApproach, 'staged');
  assert.ok(plan.decision.rationale.length > 0);
  assert.equal(plan.decision.alternativesConsidered.length, 2);
  assert.ok(plan.decision.alternativesConsidered.every((item) => item.reasonNotSelected.length > 0));
  assert.ok(plan.criticalReview.challengeQuestions.length >= 3);
  assert.ok(plan.criticalReview.strongestAlternative);
  assert.ok(plan.criticalReview.evidenceNeededToChangeRecommendation.length > 0);
  assert.deepEqual(plan.verification.criteria, []);
  assert.equal(plan.verification.completionRequiresEvidence, true);
  assert.equal(plan.execution, 'plan-only');
  assert.equal(plan.safety.toolsInvoked, false);
});

test('rejects unsafe, duplicate, excessive or oversized assumptions and constraints', () => {
  for (const body of [
    { assumptions: [''] },
    { assumptions: ['duplicate', 'duplicate'] },
    { assumptions: ['x'.repeat(241)] },
    { assumptions: Array.from({ length: 9 }, (_, i) => 'assumption ' + i) },
    { constraints: ['bad\u0000value'] },
    { constraints: ['same', 'same'] },
    { constraints: Array.from({ length: 9 }, (_, i) => 'constraint ' + i) },
  ]) {
    assert.throws(() => validateAgentRunSubmission({
      objective: 'Review the runtime',
      ...body,
    }));
  }
});
