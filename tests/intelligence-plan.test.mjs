import test from 'node:test';
import assert from 'node:assert/strict';
import { planIntelligenceTask } from '../functions/lib/intelligence-engine.mjs';

const request = (overrides = {}) => ({
  objective: 'Calculate the sum of 18 and 24',
  messages: [{ role: 'user', content: 'Please calculate 18 + 24.' }],
  requestedOutputTokens: 32,
  ...overrides,
});

test('composes task translation and full-message workload accounting into one deterministic-first plan', () => {
  const result = planIntelligenceTask(request());
  assert.equal(result.task.task, 'simple');
  assert.equal(result.task.routeStrategy, 'deterministic_first');
  assert.equal(result.workload.messageCount, 1);
  assert.ok(result.workload.estimatedInputTokens > 0);
  assert.equal(result.planStatus, 'plan_ready');
  assert.equal(result.providerSelection, 'not_attempted');
  assert.equal(result.execution, 'not_authorised');
  assert.equal(result.toolsInvoked, false);
});

test('marks non-simple work as a model candidate without selecting or requiring a provider', () => {
  const result = planIntelligenceTask(request({
    objective: 'Research recent approaches to local inference',
  }));
  assert.equal(result.task.task, 'research');
  assert.equal(result.task.modelCandidate, true);
  assert.equal(result.task.modelRequired, null);
  assert.equal(result.providerSelection, 'not_attempted');
  assert.equal(result.planStatus, 'plan_ready');
});

test('keeps ambiguous requests in clarification rather than guessing a route', () => {
  const result = planIntelligenceTask(request({ objective: 'Help me with this' }));
  assert.equal(result.task.task, 'unknown');
  assert.equal(result.planStatus, 'clarification_required');
  assert.equal(result.providerSelection, 'not_attempted');
});

test('flags an exceeded input budget without silently switching routes or truncating messages', () => {
  const messages = [{ role: 'user', content: 'Explain the architecture in enough detail.' }];
  const result = planIntelligenceTask(request({
    objective: 'Explain the architecture',
    messages,
    maxInputTokens: 1,
  }));
  assert.equal(result.planStatus, 'input_budget_exceeded');
  assert.equal(result.workload.withinInputBudget, false);
  assert.equal(result.workload.messageCount, 1);
  assert.equal(result.providerSelection, 'not_attempted');
});

test('keeps objective classification sizing separate from complete conversation workload sizing', () => {
  const result = planIntelligenceTask(request({
    objective: 'Calculate a total',
    messages: [
      { role: 'system', content: 'Follow the approved rules.' },
      { role: 'user', content: 'Calculate 18 + 24 and show the arithmetic.' },
    ],
  }));
  assert.equal(result.task.objectiveInputBytes, Buffer.byteLength('Calculate a total', 'utf8'));
  assert.equal(result.workload.inputBytes,
    Buffer.byteLength('Follow the approved rules.', 'utf8') +
    Buffer.byteLength('Calculate 18 + 24 and show the arithmetic.', 'utf8'));
});

test('rejects unknown outer fields and accessor-backed planning input without invoking getters', () => {
  assert.throws(() => planIntelligenceTask(request({ execute: true })));
  let invoked = false;
  const input = request();
  Object.defineProperty(input, 'objective', {
    enumerable: true,
    get() { invoked = true; return 'Calculate a total'; },
  });
  assert.throws(() => planIntelligenceTask(input));
  assert.equal(invoked, false);
});

test('returns an immutable planning-only composition', () => {
  const result = planIntelligenceTask(request());
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.task), true);
  assert.equal(Object.isFrozen(result.workload), true);
  assert.equal(result.execution, 'not_authorised');
  assert.equal(result.toolsInvoked, false);
});
