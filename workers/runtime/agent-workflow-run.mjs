import { createAgentWorkflowDefinition } from './agent-workflow-definition.mjs';
import { canonicalizeInput, digestCanonicalInput } from '../../functions/lib/canonical-input.mjs';

const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,79}$/;

function isPlainRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function canonicalTimestamp(value, label) {
  if (typeof value !== 'string') throw new TypeError(label + ' must be a canonical UTC timestamp.');
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new TypeError(label + ' must be a canonical UTC timestamp.');
  }
  return value;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

/**
 * Create an immutable, plan-only run envelope pinned to a validated workflow.
 * This record is descriptive: it does not start work, grant capabilities,
 * create an agent session, or authorise execution.
 */
export async function createAgentWorkflowRun(input) {
  if (!isPlainRecord(input) ||
      Object.keys(input).some(key => !['definition', 'runId', 'createdAt', 'observedAt'].includes(key))) {
    throw new TypeError('Workflow run input must be a plain object with only supported fields.');
  }
  if (!isPlainRecord(input.definition)) {
    throw new TypeError('A validated workflow definition is required.');
  }
  if (typeof input.runId !== 'string' || !ID_PATTERN.test(input.runId)) {
    throw new TypeError('Workflow run identifier is invalid.');
  }

  const createdAt = canonicalTimestamp(input.createdAt, 'Workflow run creation time');
  if (input.observedAt !== undefined) {
    const observedAt = canonicalTimestamp(input.observedAt, 'Workflow run observation time');
    if (Date.parse(createdAt) > Date.parse(observedAt)) {
      throw new RangeError('Workflow run creation time cannot be in the future of its observation time.');
    }
  }

  const source = input.definition;
  const normalized = createAgentWorkflowDefinition({
    workflowId: source.workflowId,
    title: source.title,
    version: source.version,
    createdAt: source.createdAt,
    steps: source.steps,
  });
  if (canonicalizeInput(source) !== canonicalizeInput(normalized)) {
    throw new TypeError('Workflow definition contains fields or values outside its validated contract.');
  }

  const definitionDigest = await digestCanonicalInput(normalized);
  const steps = normalized.steps.map(step => ({
    stepId: step.stepId,
    status: 'planned',
    evidence: [],
  }));

  return deepFreeze({
    schemaVersion: 'aegis.agent-workflow-run.v1',
    runId: input.runId,
    workflowId: normalized.workflowId,
    definitionDigest,
    createdAt,
    status: 'planned',
    execution: 'plan-only',
    steps,
    authority: {
      sentinelApprovalRequired: true,
      execution: 'not_authorised',
      capabilitiesGranted: false,
      agentSpawning: false,
      networkAccess: false,
      secretAccess: false,
      productionDeployment: false,
      selfApproval: false,
    },
  });
}
