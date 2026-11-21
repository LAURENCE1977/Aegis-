const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,79}$/;
const CAPABILITIES = new Set([
  'source_read',
  'workspace_read',
  'workspace_write',
  'artifact_read',
  'artifact_write',
  'test_run',
]);
const KINDS = new Set(['discover', 'inspect', 'analyse', 'propose', 'verify']);
const APPROVALS = new Set(['none', 'human_required']);
const MAX_STEPS = 20;

function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function exactFields(value, allowed, label) {
  if (!record(value) || Object.keys(value).some(key => !allowed.includes(key))) {
    throw new TypeError(label + ' contains an unknown field or is not a plain object.');
  }
}

function text(value, label, max, pattern = null) {
  if (typeof value !== 'string' || value.length < 1 || value.length > max ||
      value.trim() !== value || /[\\u0000-\\u001f\\u007f]/.test(value) ||
      (pattern && !pattern.test(value))) {
    throw new TypeError(label + ' is invalid.');
  }
  return value;
}

function timestamp(value) {
  if (typeof value !== 'string') throw new TypeError('Workflow creation timestamp is invalid.');
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) {
    throw new TypeError('Workflow creation timestamp must be canonical UTC.');
  }
  return value;
}

function freezeStep(step) {
  Object.freeze(step.dependsOn);
  Object.freeze(step.capabilities);
  return Object.freeze(step);
}

/**
 * Normalize a declarative workflow. This is a definition/validation boundary,
 * not an executor, scheduler, permission grant, or approval mechanism.
 */
export function createAgentWorkflowDefinition(input) {
  exactFields(input, ['workflowId', 'title', 'version', 'createdAt', 'steps'], 'Agent workflow');
  const workflowId = text(input.workflowId, 'Workflow identifier', 80, ID_PATTERN);
  const title = text(input.title, 'Workflow title', 120);
  if (!Number.isSafeInteger(input.version) || input.version !== 1) {
    throw new TypeError('Workflow version must be the supported integer version 1.');
  }
  const createdAt = timestamp(input.createdAt);
  if (!Array.isArray(input.steps) || input.steps.length < 1 || input.steps.length > MAX_STEPS) {
    throw new RangeError('Workflow must contain between 1 and 20 steps.');
  }

  const seen = new Set();
  const steps = input.steps.map((raw, index) => {
    exactFields(raw,
      ['stepId', 'kind', 'dependsOn', 'capabilities', 'evidenceRequired', 'approval'],
      'Workflow step');
    const stepId = text(raw.stepId, 'Workflow step identifier', 80, ID_PATTERN);
    if (seen.has(stepId)) throw new TypeError('Workflow contains a duplicate step identifier.');
    if (!KINDS.has(raw.kind)) throw new TypeError('Workflow step kind is unsupported.');
    if (!Array.isArray(raw.dependsOn) || raw.dependsOn.length > index) {
      throw new TypeError('Workflow step dependencies must reference preceding steps only.');
    }
    const dependsOn = raw.dependsOn.map(value =>
      text(value, 'Workflow dependency identifier', 80, ID_PATTERN));
    if (new Set(dependsOn).size !== dependsOn.length ||
        dependsOn.some(value => !seen.has(value))) {
      throw new TypeError('Workflow dependency is duplicate, unknown, or does not precede its step.');
    }
    if (!Array.isArray(raw.capabilities) || raw.capabilities.length > CAPABILITIES.size) {
      throw new TypeError('Workflow capabilities must be a bounded allowlist.');
    }
    const capabilities = raw.capabilities.map(value => {
      if (typeof value !== 'string' || !CAPABILITIES.has(value)) {
        throw new TypeError('Workflow capability is not on the allowlist.');
      }
      return value;
    });
    if (new Set(capabilities).size !== capabilities.length) {
      throw new TypeError('Workflow capabilities must not contain duplicates.');
    }
    if (raw.evidenceRequired !== true) {
      throw new TypeError('Every workflow step must require evidence.');
    }
    if (!APPROVALS.has(raw.approval)) {
      throw new TypeError('Workflow approval must be none or human_required; automatic approval is forbidden.');
    }
    if (capabilities.some(value =>
      ['workspace_write', 'artifact_write', 'test_run'].includes(value)) &&
      raw.approval !== 'human_required') {
      throw new TypeError('Workspace writes, artifact writes, and test execution require human review.');
    }
    seen.add(stepId);
    return freezeStep({ stepId, kind: raw.kind, dependsOn, capabilities,
      evidenceRequired: true, approval: raw.approval });
  });

  const result = {
    schemaVersion: 'aegis.agent-workflow-definition.v1',
    workflowId,
    title,
    version: 1,
    createdAt,
    steps: Object.freeze(steps),
    authority: Object.freeze({
      sentinelApprovalRequired: true,
      execution: 'not_authorised',
      agentSpawning: false,
      networkAccess: false,
      secretAccess: false,
      productionDeployment: false,
      selfApproval: false,
    }),
  };
  return Object.freeze(result);
}
