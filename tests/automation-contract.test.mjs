import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTOMATION_DEFAULT_LIMITS,
  AUTOMATION_DEFAULT_RETRY,
  canTransitionAutomationStatus,
  validateAutomationDefinition,
} from '../workers/runtime/automation-contract.mjs';

function definition(overrides = {}) {
  return {
    schemaVersion: 1,
    id: 'morning-brief',
    version: 1,
    name: 'Morning brief',
    description: 'Prepare a short daily briefing.',
    trigger: { type: 'schedule', mode: 'daily', time: '08:00', timezone: 'Europe/London' },
    steps: [
      { id: 'prepare', type: 'agent.plan', role: 'researcher', objective: 'Prepare a concise daily brief' },
      {
        id: 'notify',
        type: 'notify.owner',
        message: 'Your daily brief is ready.',
        when: { path: 'steps.prepare.output.status', operator: 'equals', value: 'complete' },
      },
    ],
    retry: { maxAttempts: 2, backoffSeconds: 30 },
    limits: { timeoutSeconds: 300, maxRunsPerDay: 1, maxConcurrentRuns: 1 },
    ...overrides,
  };
}

test('accepts a versioned scheduled definition and normalizes safe defaults', () => {
  const result = validateAutomationDefinition({
    ...definition(),
    retry: undefined,
    limits: undefined,
  });
  assert.equal(result.schemaVersion, 1);
  assert.equal(result.id, 'morning-brief');
  assert.deepEqual(result.retry, AUTOMATION_DEFAULT_RETRY);
  assert.deepEqual(result.limits, AUTOMATION_DEFAULT_LIMITS);
  assert.equal(result.trigger.timezone, 'Europe/London');
  assert.equal(result.steps.length, 2);
});

test('accepts manual, interval, weekly and exact internal event triggers', () => {
  const base = definition();
  assert.equal(validateAutomationDefinition({
    ...base,
    trigger: { type: 'manual' },
  }).trigger.type, 'manual');
  assert.equal(validateAutomationDefinition({
    ...base,
    trigger: { type: 'schedule', mode: 'interval', intervalMinutes: 30 },
  }).trigger.intervalMinutes, 30);
  assert.deepEqual(validateAutomationDefinition({
    ...base,
    trigger: { type: 'schedule', mode: 'weekly', days: [1, 3, 5], time: '09:15', timezone: 'Europe/London' },
  }).trigger.days, [1, 3, 5]);
  assert.equal(validateAutomationDefinition({
    ...base,
    trigger: { type: 'event', eventType: 'aegis.project.updated' },
  }).trigger.eventType, 'aegis.project.updated');
});

test('rejects invalid, wildcard or unknown trigger definitions', () => {
  const base = definition();
  for (const trigger of [
    { type: 'schedule', mode: 'interval', intervalMinutes: 1 },
    { type: 'schedule', mode: 'daily', time: '25:99', timezone: 'Europe/London' },
    { type: 'schedule', mode: 'daily', time: '08:00', timezone: 'Mars/Olympus' },
    { type: 'schedule', mode: 'weekly', days: [1, 1], time: '08:00', timezone: 'UTC' },
    { type: 'event', eventType: 'aegis.*' },
    { type: 'shell', command: 'echo unsafe' },
    { type: 'manual', unexpected: true },
  ]) assert.throws(() => validateAutomationDefinition({ ...base, trigger }));
});

test('requires bounded unique step identifiers and known AEGIS step types', () => {
  const base = definition();
  assert.throws(() => validateAutomationDefinition({
    ...base,
    steps: [{ id: 'same', type: 'notify.owner', message: 'One' }, { id: 'same', type: 'notify.owner', message: 'Two' }],
  }));
  assert.throws(() => validateAutomationDefinition({
    ...base,
    steps: [{ id: 'unsafe', type: 'shell.exec', command: 'echo unsafe' }],
  }));
  assert.throws(() => validateAutomationDefinition({ ...base, steps: [] }));
  assert.throws(() => validateAutomationDefinition({
    ...base,
    steps: Array.from({ length: 21 }, (_, index) => ({ id: 'notice-' + index, type: 'notify.owner', message: 'Notice' })),
  }));
});

test('capability invocation requires an exact resource, non-wildcard scopes and mandatory approval', () => {
  const base = definition();
  const step = {
    id: 'read-modules',
    type: 'capability.invoke',
    capabilityId: 'aegis-module-catalogue',
    actionId: 'list',
    resourceId: 'aegis:modules',
    scopes: ['modules:read:aegis.modules'],
    input: {},
    approval: 'required',
  };
  const result = validateAutomationDefinition({ ...base, steps: [step] });
  assert.equal(result.steps[0].approval, 'required');
  assert.deepEqual(result.steps[0].scopes, ['modules:read:aegis.modules']);
  assert.throws(() => validateAutomationDefinition({
    ...base,
    steps: [{ ...step, approval: 'none' }],
  }));
  assert.throws(() => validateAutomationDefinition({
    ...base,
    steps: [{ ...step, scopes: ['modules:read:*'] }],
  }));
  assert.throws(() => validateAutomationDefinition({
    ...base,
    steps: [{ ...step, resourceId: 'aegis:modules:*' }],
  }));
  assert.throws(() => validateAutomationDefinition({
    ...base,
    steps: [{ ...step, scopes: [] }],
  }));
});

test('agent planning is limited to registered specialist roles and cannot carry tools', () => {
  const base = definition();
  assert.equal(validateAutomationDefinition({
    ...base,
    steps: [{ id: 'plan', type: 'agent.plan', role: 'security', objective: 'Review access controls' }],
  }).steps[0].role, 'security');
  assert.throws(() => validateAutomationDefinition({
    ...base,
    steps: [{ id: 'plan', type: 'agent.plan', role: 'shell', objective: 'Run commands' }],
  }));
  assert.throws(() => validateAutomationDefinition({
    ...base,
    steps: [{ id: 'plan', type: 'agent.plan', role: 'researcher', objective: 'Research', tools: ['shell.exec'] }],
  }));
});

test('owner notifications have no external recipient or delivery-channel control', () => {
  const base = definition();
  assert.equal(validateAutomationDefinition({
    ...base,
    steps: [{ id: 'notice', type: 'notify.owner', message: 'A run needs your attention.' }],
  }).steps[0].type, 'notify.owner');
  assert.throws(() => validateAutomationDefinition({
    ...base,
    steps: [{ id: 'notice', type: 'notify.owner', message: 'Send this', recipient: 'someone@example.com' }],
  }));
  assert.throws(() => validateAutomationDefinition({
    ...base,
    steps: [{ id: 'notice', type: 'notify.owner', message: 'Send this', channel: 'email' }],
  }));
});

test('conditions use a bounded declarative language and may reference only earlier steps', () => {
  const base = definition();
  const valid = validateAutomationDefinition(base);
  assert.equal(valid.steps[1].when.operator, 'equals');
  assert.throws(() => validateAutomationDefinition({
    ...base,
    steps: [
      { id: 'notify', type: 'notify.owner', message: 'Ready', when: { path: 'steps.prepare.output.status', operator: 'exists' } },
      { id: 'prepare', type: 'agent.plan', role: 'researcher', objective: 'Prepare' },
    ],
  }));
  assert.throws(() => validateAutomationDefinition({
    ...base,
    steps: [
      { id: 'notify', type: 'notify.owner', message: 'Ready', when: { path: 'trigger.payload.x', operator: 'eval', value: 'true' } },
    ],
  }));
  assert.throws(() => validateAutomationDefinition({
    ...base,
    steps: [
      { id: 'notify', type: 'notify.owner', message: 'Ready', when: { path: 'process.env.SECRET', operator: 'exists' } },
    ],
  }));
});

test('retry policy and execution limits are bounded and reject unknown fields', () => {
  const base = definition();
  for (const retry of [
    { maxAttempts: 4, backoffSeconds: 30 },
    { maxAttempts: 2, backoffSeconds: 1 },
    { maxAttempts: 2, backoffSeconds: 30, unlimited: true },
  ]) assert.throws(() => validateAutomationDefinition({ ...base, retry }));
  for (const limits of [
    { timeoutSeconds: 901, maxRunsPerDay: 1, maxConcurrentRuns: 1 },
    { timeoutSeconds: 300, maxRunsPerDay: 101, maxConcurrentRuns: 1 },
    { timeoutSeconds: 300, maxRunsPerDay: 1, maxConcurrentRuns: 6 },
    { timeoutSeconds: 300, maxRunsPerDay: 1, maxConcurrentRuns: 1, unlimited: true },
  ]) assert.throws(() => validateAutomationDefinition({ ...base, limits }));
});

test('rejects unsafe JSON input, oversized payloads and prototype-pollution keys', () => {
  const base = definition();
  const step = {
    id: 'read-modules',
    type: 'capability.invoke',
    capabilityId: 'aegis-module-catalogue',
    actionId: 'list',
    resourceId: 'aegis:modules',
    scopes: ['modules:read:aegis.modules'],
    input: { query: 'safe' },
    approval: 'required',
  };
  assert.throws(() => validateAutomationDefinition({
    ...base,
    steps: [{ ...step, input: JSON.parse('{"__proto__":{"admin":true}}') }],
  }));
  assert.throws(() => validateAutomationDefinition({
    ...base,
    steps: [{ ...step, input: { nested: { a: { b: { c: { d: { e: 'too deep' } } } } } }],
  }));
  assert.throws(() => validateAutomationDefinition({
    ...base,
    steps: [{ ...step, input: { text: 'x'.repeat(9000) } }],
  }));
});

test('rejects unknown definition fields and invalid schema or version values', () => {
  const base = definition();
  assert.throws(() => validateAutomationDefinition({ ...base, permissions: ['admin'] }));
  assert.throws(() => validateAutomationDefinition({ ...base, code: 'return fetch(url)' }));
  assert.throws(() => validateAutomationDefinition({ ...base, schemaVersion: 2 }));
  assert.throws(() => validateAutomationDefinition({ ...base, version: 0 }));
  assert.throws(() => validateAutomationDefinition({ ...base, id: '../unsafe' }));
});

test('automation lifecycle transitions support pause and resume but make archived definitions terminal', () => {
  assert.equal(canTransitionAutomationStatus('draft', 'active'), true);
  assert.equal(canTransitionAutomationStatus('active', 'paused'), true);
  assert.equal(canTransitionAutomationStatus('paused', 'active'), true);
  assert.equal(canTransitionAutomationStatus('active', 'archived'), true);
  assert.equal(canTransitionAutomationStatus('archived', 'active'), false);
  assert.equal(canTransitionAutomationStatus('draft', 'paused'), false);
  assert.equal(canTransitionAutomationStatus('active', 'active'), false);
  assert.equal(canTransitionAutomationStatus('unknown', 'active'), false);
});
