const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SCOPE_PATTERN = /^[a-z][a-z0-9-]{0,40}:[a-z][a-z0-9-]{0,50}(?::[a-z0-9._-]{1,80})?$/;
const RESOURCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const EVENT_PATTERN = /^aegis\.[a-z0-9]+(?:\.[a-z0-9_-]+){1,3}$/;
const TIME_PATTERN = /^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/;
const CONDITION_PATH_PATTERN = /^(?:trigger\.payload|steps\.[a-z0-9]+(?:-[a-z0-9]+)*\.output)(?:\.[A-Za-z0-9_-]{1,64}){0,5}$/;
const SPECIALISTS = new Set(['researcher', 'planner', 'engineer', 'security', 'reviewer']);
const STEP_TYPES = new Set(['agent.plan', 'capability.invoke', 'notify.owner']);
const STATUSES = new Set(['draft', 'active', 'paused', 'archived']);

export const AUTOMATION_DEFINITION_SCHEMA_VERSION = 1;
export const AUTOMATION_DEFAULT_RETRY = Object.freeze({
  maxAttempts: 1,
  backoffSeconds: 30,
});
export const AUTOMATION_DEFAULT_LIMITS = Object.freeze({
  timeoutSeconds: 300,
  maxRunsPerDay: 20,
  maxConcurrentRuns: 1,
});

const STATUS_TRANSITIONS = Object.freeze({
  draft: new Set(['active', 'archived']),
  active: new Set(['paused', 'archived']),
  paused: new Set(['active', 'archived']),
  archived: new Set(),
});

function isRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertExactKeys(value, allowed, label) {
  if (!isRecord(value)) throw new TypeError(label + ' must be an object.');
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !allowed.includes(key)) {
      throw new TypeError(label + ' contains an unknown field.');
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) {
      throw new TypeError(label + ' contains an unsupported property.');
    }
  }
}

function assertText(value, label, maxLength) {
  if (typeof value !== 'string') throw new TypeError(label + ' must be text.');
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength ||
      /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new TypeError(label + ' must contain 1–' + maxLength + ' safe characters.');
  }
  return normalized;
}

function assertSlug(value, label) {
  if (typeof value !== 'string' || value.length > 64 || !ID_PATTERN.test(value)) {
    throw new TypeError(label + ' must be a lowercase AEGIS identifier.');
  }
  return value;
}

function assertInteger(value, label, minimum, maximum) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new TypeError(label + ' is outside its allowed range.');
  }
  return value;
}

function validateTimezone(value) {
  const timezone = assertText(value, 'Timezone', 80);
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: timezone }).format(new Date(0));
  } catch {
    throw new TypeError('Timezone must be a supported IANA timezone.');
  }
  return timezone;
}

function validateTime(value) {
  if (typeof value !== 'string' || !TIME_PATTERN.test(value)) {
    throw new TypeError('Schedule time must use 24-hour HH:mm format.');
  }
  return value;
}

function validateTrigger(input) {
  if (!isRecord(input) || typeof input.type !== 'string') {
    throw new TypeError('Automation trigger must be a typed object.');
  }

  if (input.type === 'manual') {
    assertExactKeys(input, ['type'], 'Manual trigger');
    return { type: 'manual' };
  }

  if (input.type === 'event') {
    assertExactKeys(input, ['type', 'eventType'], 'Event trigger');
    if (typeof input.eventType !== 'string' || !EVENT_PATTERN.test(input.eventType)) {
      throw new TypeError('Event trigger must name one exact AEGIS event type.');
    }
    return { type: 'event', eventType: input.eventType };
  }

  if (input.type !== 'schedule') throw new TypeError('Unknown automation trigger type.');
  if (input.mode === 'interval') {
    assertExactKeys(input, ['type', 'mode', 'intervalMinutes'], 'Interval schedule');
    return {
      type: 'schedule',
      mode: 'interval',
      intervalMinutes: assertInteger(input.intervalMinutes, 'Interval minutes', 5, 10080),
    };
  }

  if (input.mode === 'daily') {
    assertExactKeys(input, ['type', 'mode', 'time', 'timezone'], 'Daily schedule');
    return {
      type: 'schedule',
      mode: 'daily',
      time: validateTime(input.time),
      timezone: validateTimezone(input.timezone),
    };
  }

  if (input.mode === 'weekly') {
    assertExactKeys(input, ['type', 'mode', 'days', 'time', 'timezone'], 'Weekly schedule');
    if (!Array.isArray(input.days) || input.days.length < 1 || input.days.length > 7 ||
        input.days.some((day) => !Number.isInteger(day) || day < 1 || day > 7) ||
        new Set(input.days).size !== input.days.length) {
      throw new TypeError('Weekly schedule days must be unique ISO weekdays from 1 to 7.');
    }
    return {
      type: 'schedule',
      mode: 'weekly',
      days: [...input.days].sort((a, b) => a - b),
      time: validateTime(input.time),
      timezone: validateTimezone(input.timezone),
    };
  }

  throw new TypeError('Unknown schedule mode.');
}

function cloneSafeJson(value, depth = 0) {
  if (depth > 5) throw new TypeError('Capability input is nested too deeply.');
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.length > 2048 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) {
      throw new TypeError('Capability input contains unsafe text.');
    }
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Capability input must contain finite numbers.');
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length > 20) throw new TypeError('Capability input arrays are too large.');
    return value.map((item) => cloneSafeJson(item, depth + 1));
  }
  if (!isRecord(value)) throw new TypeError('Capability input must contain plain JSON values.');

  const keys = Reflect.ownKeys(value);
  if (keys.length > 50) throw new TypeError('Capability input contains too many fields.');
  const output = {};
  for (const key of keys) {
    if (typeof key !== 'string' || key === '__proto__' || key === 'prototype' || key === 'constructor' ||
        !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(key)) {
      throw new TypeError('Capability input contains an unsafe field name.');
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) {
      throw new TypeError('Capability input contains an unsupported property.');
    }
    output[key] = cloneSafeJson(descriptor.value, depth + 1);
  }
  return output;
}

function validateCondition(input) {
  assertExactKeys(input, ['path', 'operator', 'value'], 'Step condition');
  if (typeof input.path !== 'string' || !CONDITION_PATH_PATTERN.test(input.path)) {
    throw new TypeError('Condition path must reference trigger payload or a prior step output.');
  }
  const operators = new Set(['exists', 'not_exists', 'equals', 'not_equals', 'contains']);
  if (!operators.has(input.operator)) throw new TypeError('Unknown condition operator.');
  if (input.operator === 'exists' || input.operator === 'not_exists') {
    if (Object.hasOwn(input, 'value')) throw new TypeError('Existence conditions do not accept a value.');
    return { path: input.path, operator: input.operator };
  }
  const value = input.value;
  if (!(value === null || typeof value === 'string' || typeof value === 'number' ||
        typeof value === 'boolean') || (typeof value === 'number' && !Number.isFinite(value))) {
    throw new TypeError('Condition values must be safe JSON scalars.');
  }
  if (typeof value === 'string' && value.length > 256) {
    throw new TypeError('Condition value is too long.');
  }
  if (input.operator === 'contains' && typeof value !== 'string') {
    throw new TypeError('The contains operator requires a text value.');
  }
  return { path: input.path, operator: input.operator, value };
}

function validateStep(input) {
  if (!isRecord(input) || typeof input.type !== 'string') {
    throw new TypeError('Automation step must be a typed object.');
  }
  const id = assertSlug(input.id, 'Step identifier');
  const when = Object.hasOwn(input, 'when') ? validateCondition(input.when) : null;

  if (input.type === 'agent.plan') {
    assertExactKeys(input, ['id', 'type', 'role', 'objective', 'when'], 'Agent planning step');
    if (!SPECIALISTS.has(input.role)) throw new TypeError('Agent planning step must use a registered specialist role.');
    const step = {
      id,
      type: 'agent.plan',
      role: input.role,
      objective: assertText(input.objective, 'Agent objective', 500),
    };
    if (when) step.when = when;
    return step;
  }

  if (input.type === 'notify.owner') {
    assertExactKeys(input, ['id', 'type', 'message', 'when'], 'Owner notification step');
    const step = {
      id,
      type: 'notify.owner',
      message: assertText(input.message, 'Owner notification', 500),
    };
    if (when) step.when = when;
    return step;
  }

  if (input.type === 'capability.invoke') {
    assertExactKeys(input, [
      'id', 'type', 'capabilityId', 'actionId', 'resourceId', 'scopes', 'input', 'approval', 'when',
    ], 'Capability invocation step');
    const capabilityId = assertSlug(input.capabilityId, 'Capability identifier');
    const actionId = assertSlug(input.actionId, 'Capability action identifier');
    if (typeof input.resourceId !== 'string' || !RESOURCE_PATTERN.test(input.resourceId) ||
        input.resourceId.includes('..') || input.resourceId.includes('*') || input.resourceId.includes('\\')) {
      throw new TypeError('Capability invocation must target one exact resource.');
    }
    if (!Array.isArray(input.scopes) || input.scopes.length < 1 || input.scopes.length > 10 ||
        input.scopes.some((scope) => typeof scope !== 'string' || !SCOPE_PATTERN.test(scope)) ||
        new Set(input.scopes).size !== input.scopes.length) {
      throw new TypeError('Capability invocation requires unique exact scopes.');
    }
    if (input.approval !== 'required') {
      throw new TypeError('Capability invocation always requires human approval.');
    }
    const safeInput = input.input === undefined ? {} : cloneSafeJson(input.input);
    if (!isRecord(safeInput) || JSON.stringify(safeInput).length > 8192) {
      throw new TypeError('Capability invocation input must be an object no larger than 8 KiB.');
    }
    const step = {
      id,
      type: 'capability.invoke',
      capabilityId,
      actionId,
      resourceId: input.resourceId,
      scopes: [...input.scopes],
      input: safeInput,
      approval: 'required',
    };
    if (when) step.when = when;
    return step;
  }

  if (!STEP_TYPES.has(input.type)) throw new TypeError('Unknown automation step type.');
  throw new TypeError('Invalid automation step.');
}

function validateRetry(input) {
  if (input === undefined) return { ...AUTOMATION_DEFAULT_RETRY };
  assertExactKeys(input, ['maxAttempts', 'backoffSeconds'], 'Retry policy');
  return {
    maxAttempts: assertInteger(input.maxAttempts, 'Maximum attempts', 1, 3),
    backoffSeconds: assertInteger(input.backoffSeconds, 'Retry backoff seconds', 5, 300),
  };
}

function validateLimits(input) {
  if (input === undefined) return { ...AUTOMATION_DEFAULT_LIMITS };
  assertExactKeys(input, ['timeoutSeconds', 'maxRunsPerDay', 'maxConcurrentRuns'], 'Execution limits');
  return {
    timeoutSeconds: assertInteger(input.timeoutSeconds, 'Timeout seconds', 30, 900),
    maxRunsPerDay: assertInteger(input.maxRunsPerDay, 'Maximum daily runs', 1, 100),
    maxConcurrentRuns: assertInteger(input.maxConcurrentRuns, 'Maximum concurrent runs', 1, 5),
  };
}

export function validateAutomationDefinition(input) {
  assertExactKeys(input, [
    'schemaVersion', 'id', 'version', 'name', 'description', 'trigger', 'steps', 'retry', 'limits',
  ], 'Automation definition');

  if (input.schemaVersion !== AUTOMATION_DEFINITION_SCHEMA_VERSION) {
    throw new TypeError('Unsupported automation definition schema version.');
  }
  const id = assertSlug(input.id, 'Automation identifier');
  const version = assertInteger(input.version, 'Automation version', 1, 1000000);
  const name = assertText(input.name, 'Automation name', 80);
  const description = input.description === undefined ? '' : assertText(input.description, 'Automation description', 300);
  const trigger = validateTrigger(input.trigger);

  if (!Array.isArray(input.steps) || input.steps.length < 1 || input.steps.length > 20) {
    throw new TypeError('An automation must contain between one and twenty steps.');
  }
  const steps = input.steps.map(validateStep);
  const stepIds = new Set();
  for (const step of steps) {
    if (stepIds.has(step.id)) throw new TypeError('Automation step identifiers must be unique.');
    stepIds.add(step.id);
  }
  const priorSteps = new Set();
  for (const step of steps) {
    if (step.when?.path.startsWith('steps.')) {
      const referencedStep = step.when.path.split('.')[1];
      if (!priorSteps.has(referencedStep)) {
        throw new TypeError('A condition may reference only an earlier step output.');
      }
    }
    priorSteps.add(step.id);
  }

  return {
    schemaVersion: AUTOMATION_DEFINITION_SCHEMA_VERSION,
    id,
    version,
    name,
    description,
    trigger,
    steps,
    retry: validateRetry(input.retry),
    limits: validateLimits(input.limits),
  };
}

export function canTransitionAutomationStatus(currentStatus, nextStatus) {
  if (!STATUSES.has(currentStatus) || !STATUSES.has(nextStatus)) return false;
  return STATUS_TRANSITIONS[currentStatus].has(nextStatus);
}
