import { createAgentWorkflowRun } from './agent-workflow-run.mjs';
import { createAgentWorkflowCheckpoint } from './agent-workflow-checkpoint.mjs';
import { canonicalizeInput, digestCanonicalInput } from '../../functions/lib/canonical-input.mjs';

const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,79}$/;
const TARGET_PATTERN = /^(workspace|artifact|test):[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/;
const ACTIONS = Object.freeze({
  workspace_write: Object.freeze({ capability: 'workspace_write', targetPrefix: 'workspace:' }),
  artifact_write: Object.freeze({ capability: 'artifact_write', targetPrefix: 'artifact:' }),
  test_run: Object.freeze({ capability: 'test_run', targetPrefix: 'test:' }),
});

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

function identifier(value, label) {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    throw new TypeError(label + ' is invalid.');
  }
  return value;
}

function timestamp(value, label) {
  if (typeof value !== 'string') throw new TypeError(label + ' must be a canonical UTC timestamp.');
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) {
    throw new TypeError(label + ' must be a canonical UTC timestamp.');
  }
  return value;
}

function freezeDeep(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freezeDeep(child);
  return Object.freeze(value);
}

/**
 * Create a review-only inbox item bound to a pinned workflow, evidence checkpoint,
 * exact action and evidence digest. This is never an execution or approval token.
 */
export async function createAgentOperationInboxItem(input) {
  exactRecord(input, [
    'run', 'definition', 'checkpoint', 'itemId', 'createdAt', 'observedAt', 'action', 'evidence',
  ], 'Agent operations inbox input');
  exactRecord(input.action, ['actionId', 'kind', 'capability', 'targetRef'], 'Proposed action');

  const itemId = identifier(input.itemId, 'Inbox item identifier');
  const createdAt = timestamp(input.createdAt, 'Inbox item creation time');
  const observedAt = timestamp(input.observedAt ?? createdAt, 'Inbox item observation time');
  if (Date.parse(createdAt) > Date.parse(observedAt)) {
    throw new RangeError('Inbox item creation time cannot be newer than its observation time.');
  }

  const run = await createAgentWorkflowRun({
    definition: input.definition,
    runId: input.run?.runId,
    createdAt: input.run?.createdAt,
    observedAt,
  });
  if (canonicalizeInput(input.run) !== canonicalizeInput(run)) {
    throw new TypeError('Inbox item run does not match its pinned workflow definition.');
  }

  const suppliedCheckpoint = input.checkpoint;
  const checkpoint = await createAgentWorkflowCheckpoint({
    run,
    definition: input.definition,
    checkpointId: suppliedCheckpoint?.checkpointId,
    sequence: suppliedCheckpoint?.sequence,
    observedAt: suppliedCheckpoint?.observedAt,
    eventType: suppliedCheckpoint?.eventType,
    stepId: suppliedCheckpoint?.stepId,
    evidence: suppliedCheckpoint?.evidence,
  });
  if (canonicalizeInput(suppliedCheckpoint) !== canonicalizeInput(checkpoint)) {
    throw new TypeError('Inbox item checkpoint failed contract or digest verification.');
  }
  if (checkpoint.eventType !== 'evidence_reference_observed' || !checkpoint.stepId) {
    throw new TypeError('Inbox items require a step-bound evidence observation checkpoint.');
  }
  if (Date.parse(createdAt) < Date.parse(checkpoint.observedAt)) {
    throw new RangeError('Inbox item cannot predate its evidence checkpoint.');
  }

  const actionId = identifier(input.action.actionId, 'Action identifier');
  const kind = input.action.kind;
  const rule = ACTIONS[kind];
  if (!rule) throw new TypeError('Proposed action kind is unsupported.');
  if (input.action.capability !== rule.capability) {
    throw new TypeError('Proposed action kind and capability do not match.');
  }
  if (typeof input.action.targetRef !== 'string' ||
      !TARGET_PATTERN.test(input.action.targetRef) ||
      !input.action.targetRef.startsWith(rule.targetPrefix)) {
    throw new TypeError('Proposed action target reference is invalid for its action kind.');
  }

  const step = input.definition.steps.find(item => item.stepId === checkpoint.stepId);
  if (!step || step.kind !== 'propose' || step.approval !== 'human_required' ||
      !step.capabilities.includes(rule.capability)) {
    throw new TypeError('Pinned workflow step does not request this human-gated capability.');
  }

  if (!Array.isArray(input.evidence) || input.evidence.length < 1 || input.evidence.length > 10 ||
      canonicalizeInput(input.evidence) !== canonicalizeInput(checkpoint.evidence)) {
    throw new TypeError('Inbox evidence must exactly match the checkpoint evidence references.');
  }

  const action = Object.freeze({
    actionId,
    kind,
    capability: rule.capability,
    targetRef: input.action.targetRef,
  });
  const evidence = Object.freeze(checkpoint.evidence.map(item => Object.freeze({
    evidenceId: item.evidenceId,
    digest: item.digest,
  })));
  const actionDigest = await digestCanonicalInput(action);
  const evidenceDigest = await digestCanonicalInput(evidence);

  const record = {
    schemaVersion: 'aegis.agent-operation-inbox-item.v1',
    itemId,
    createdAt,
    runId: run.runId,
    workflowId: run.workflowId,
    definitionDigest: run.definitionDigest,
    checkpointId: checkpoint.checkpointId,
    checkpointDigest: checkpoint.checkpointDigest,
    stepId: checkpoint.stepId,
    action,
    actionDigest,
    evidence,
    evidenceDigest,
    reviewStatus: 'awaiting_human_review',
    authority: {
      approvalGranted: false,
      execution: 'not_authorised',
      capabilitiesGranted: false,
      sentinelApprovalRequired: true,
      selfApproval: false,
    },
  };
  const itemDigest = await digestCanonicalInput(record);
  return freezeDeep({ ...record, itemDigest });
}
