import { createAgentWorkflowRun } from './agent-workflow-run.mjs';
import { createAgentWorkflowCheckpoint } from './agent-workflow-checkpoint.mjs';
import { canonicalizeInput, digestCanonicalInput } from '../../functions/lib/canonical-input.mjs';

const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,79}$/;
const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;
const ACTION_CAPABILITIES = Object.freeze({
  workspace_write: 'workspace_write',
  artifact_write: 'artifact_write',
  test_run: 'test_run',
});
const ACTION_TYPES = new Set(Object.keys(ACTION_CAPABILITIES));
const ACTION_FIELDS = ['actionId', 'actionType', 'summary', 'target', 'parametersDigest'];

function exactRecord(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    throw new TypeError(label + ' must be a plain object.');
  }
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== 'string' || !descriptor?.enumerable ||
        !Object.hasOwn(descriptor, 'value') || !allowed.includes(key)) {
      throw new TypeError(label + ' contains an unsupported field or accessor.');
    }
  }
}

function timestamp(value, label) {
  if (typeof value !== 'string') throw new TypeError(label + ' must be a canonical UTC timestamp.');
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) {
    throw new TypeError(label + ' must be a canonical UTC timestamp.');
  }
  return value;
}

function identifier(value, label) {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    throw new TypeError(label + ' is invalid.');
  }
  return value;
}

function safeText(value, label, maxLength) {
  if (typeof value !== 'string' || value.length < 1 || value.length > maxLength ||
      value.trim() !== value || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new TypeError(label + ' is invalid.');
  }
  return value;
}

function freezeDeep(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freezeDeep(child);
  return Object.freeze(value);
}

/**
 * Create an immutable, evidence-bound request for human review.
 * This is an inbox item only: it does not approve, grant or execute anything.
 */
export async function createAgentOperationRequest(input) {
  exactRecord(input, [
    'requestId', 'definition', 'run', 'checkpoint', 'action', 'createdAt', 'observedAt',
  ], 'Agent operation request input');

  const requestId = identifier(input.requestId, 'Operation request identifier');
  const createdAt = timestamp(input.createdAt, 'Operation request creation time');
  const observedAt = input.observedAt === undefined
    ? createdAt
    : timestamp(input.observedAt, 'Operation request observation time');
  if (Date.parse(createdAt) > Date.parse(observedAt)) {
    throw new RangeError('Operation request creation time cannot be in the future of its observation.');
  }

  exactRecord(input.run, [
    'schemaVersion', 'runId', 'workflowId', 'definitionDigest', 'createdAt',
    'status', 'execution', 'steps', 'authority',
  ], 'Workflow run envelope');
  const rebuiltRun = await createAgentWorkflowRun({
    definition: input.definition,
    runId: input.run.runId,
    createdAt: input.run.createdAt,
    observedAt,
  });
  if (canonicalizeInput(input.run) !== canonicalizeInput(rebuiltRun)) {
    throw new TypeError('Workflow run envelope does not match its validated definition.');
  }

  exactRecord(input.checkpoint, [
    'schemaVersion', 'checkpointId', 'runId', 'workflowId', 'definitionDigest',
    'sequence', 'observedAt', 'eventType', 'stepId', 'evidence', 'authority',
    'checkpointDigest',
  ], 'Workflow evidence checkpoint');
  const rebuiltCheckpoint = await createAgentWorkflowCheckpoint({
    run: input.run,
    definition: input.definition,
    checkpointId: input.checkpoint.checkpointId,
    sequence: input.checkpoint.sequence,
    observedAt: input.checkpoint.observedAt,
    eventType: input.checkpoint.eventType,
    stepId: input.checkpoint.stepId,
    evidence: input.checkpoint.evidence,
  });
  if (canonicalizeInput(input.checkpoint) !== canonicalizeInput(rebuiltCheckpoint)) {
    throw new TypeError('Workflow evidence checkpoint failed contract or digest verification.');
  }
  if (rebuiltCheckpoint.eventType !== 'evidence_reference_observed' ||
      rebuiltCheckpoint.evidence.length < 1) {
    throw new TypeError('Agent operation requests require a verified evidence-reference checkpoint.');
  }
  if (Date.parse(createdAt) < Date.parse(rebuiltCheckpoint.observedAt)) {
    throw new RangeError('Operation request cannot predate its evidence checkpoint.');
  }

  exactRecord(input.action, ACTION_FIELDS, 'Proposed action');
  const actionId = identifier(input.action.actionId, 'Proposed action identifier');
  if (!ACTION_TYPES.has(input.action.actionType)) {
    throw new TypeError('Proposed action type is not supported by the review contract.');
  }
  const summary = safeText(input.action.summary, 'Proposed action summary', 1000);
  const target = safeText(input.action.target, 'Proposed action target', 512);
  if (typeof input.action.parametersDigest !== 'string' ||
      !DIGEST_PATTERN.test(input.action.parametersDigest)) {
    throw new TypeError('Proposed action parameter digest is invalid.');
  }

  const step = input.definition.steps.find(item => item.stepId === rebuiltCheckpoint.stepId);
  const requiredCapability = ACTION_CAPABILITIES[input.action.actionType];
  if (!step || step.approval !== 'human_required' ||
      !step.capabilities.includes(requiredCapability)) {
    throw new TypeError('Proposed action is not declared for human review by the checkpoint workflow step.');
  }

  const action = {
    actionId,
    actionType: input.action.actionType,
    summary,
    target,
    parametersDigest: input.action.parametersDigest,
  };
  const actionDigest = await digestCanonicalInput(action);
  const evidence = rebuiltCheckpoint.evidence.map(item => ({
    evidenceId: item.evidenceId,
    digest: item.digest,
  }));
  const evidenceDigest = await digestCanonicalInput(evidence);

  const unsigned = {
    schemaVersion: 'aegis.agent-operation-request.v1',
    requestId,
    workflowId: rebuiltRun.workflowId,
    runId: rebuiltRun.runId,
    definitionDigest: rebuiltRun.definitionDigest,
    checkpointId: rebuiltCheckpoint.checkpointId,
    checkpointDigest: rebuiltCheckpoint.checkpointDigest,
    checkpointSequence: rebuiltCheckpoint.sequence,
    action,
    actionDigest,
    evidence,
    evidenceDigest,
    createdAt,
    status: 'awaiting_human_review',
    authority: {
      sentinelApprovalRequired: true,
      approvalGranted: false,
      execution: 'not_authorised',
      capabilitiesGranted: false,
      selfApproval: false,
    },
  };
  const requestDigest = await digestCanonicalInput(unsigned);
  return freezeDeep({ ...unsigned, requestDigest });
}
