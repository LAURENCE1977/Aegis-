import { createAgentWorkflowRun } from './agent-workflow-run.mjs';
import { canonicalizeInput, digestCanonicalInput } from '../../functions/lib/canonical-input.mjs';

const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,79}$/;
const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;
const EVENT_TYPES = new Set([
  'step_progress_observed',
  'evidence_reference_observed',
  'blocker_observed',
  'run_pause_observed',
  'run_resume_observed',
]);

function exactRecord(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    throw new TypeError(label + ' must be a plain object.');
  }
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== 'string' || !descriptor?.enumerable || !Object.hasOwn(descriptor, 'value') ||
        !allowed.includes(key)) {
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

function freezeDeep(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freezeDeep(child);
  return Object.freeze(value);
}

/**
 * Build a digest-bound checkpoint describing an observation only.
 * The caller must separately enforce identity and Sentinel policy.
 */
export async function createAgentWorkflowCheckpoint(input) {
  exactRecord(input, [
    'run', 'definition', 'checkpointId', 'sequence', 'observedAt',
    'eventType', 'stepId', 'evidence',
  ], 'Workflow checkpoint input');
  exactRecord(input.run, [
    'schemaVersion', 'runId', 'workflowId', 'definitionDigest', 'createdAt',
    'status', 'execution', 'steps', 'authority',
  ], 'Workflow run envelope');

  const runCanonical = canonicalizeInput(input.run);
  const definitionCanonical = canonicalizeInput(input.definition);
  const rebuiltRun = await createAgentWorkflowRun({
    definition: input.definition,
    runId: input.run.runId,
    createdAt: input.run.createdAt,
    observedAt: input.observedAt,
  });
  if (runCanonical !== canonicalizeInput(rebuiltRun)) {
    throw new TypeError('Workflow run envelope does not match the supplied validated definition.');
  }

  const checkpointId = identifier(input.checkpointId, 'Checkpoint identifier');
  if (!Number.isSafeInteger(input.sequence) || input.sequence < 1) {
    throw new TypeError('Checkpoint sequence must be a positive safe integer.');
  }
  const observedAt = timestamp(input.observedAt, 'Checkpoint observation time');
  if (Date.parse(observedAt) < Date.parse(rebuiltRun.createdAt)) {
    throw new RangeError('Checkpoint observation cannot predate its workflow run.');
  }
  if (!EVENT_TYPES.has(input.eventType)) {
    throw new TypeError('Workflow checkpoint event type is unsupported.');
  }

  const runLevel = input.eventType === 'run_pause_observed' || input.eventType === 'run_resume_observed';
  const stepId = runLevel ? null : identifier(input.stepId, 'Workflow step identifier');
  if (runLevel) {
    if (input.stepId !== null) throw new TypeError('Run-level observations cannot include a step identifier.');
  } else if (!rebuiltRun.steps.some(step => step.stepId === stepId)) {
    throw new TypeError('Workflow checkpoint references a step outside the pinned run.');
  }

  const evidence = input.evidence === undefined ? [] : input.evidence;
  if (!Array.isArray(evidence) || evidence.length > 10) {
    throw new RangeError('Workflow checkpoint evidence references must contain at most 10 items.');
  }
  const normalizedEvidence = evidence.map((item) => {
    exactRecord(item, ['evidenceId', 'digest'], 'Evidence reference');
    const evidenceId = identifier(item.evidenceId, 'Evidence identifier');
    if (typeof item.digest !== 'string' || !DIGEST_PATTERN.test(item.digest)) {
      throw new TypeError('Evidence reference digest is invalid.');
    }
    return { evidenceId, digest: item.digest };
  });
  if (new Set(normalizedEvidence.map(item => item.evidenceId)).size !== normalizedEvidence.length) {
    throw new TypeError('Workflow checkpoint evidence identifiers must be unique.');
  }
  if (input.eventType === 'evidence_reference_observed' && normalizedEvidence.length === 0) {
    throw new TypeError('Evidence observations require at least one digest-only evidence reference.');
  }
  if (input.eventType !== 'evidence_reference_observed' && normalizedEvidence.length > 0) {
    throw new TypeError('Evidence references are only accepted for evidence observations.');
  }

  const record = {
    schemaVersion: 'aegis.agent-workflow-checkpoint.v1',
    checkpointId,
    runId: rebuiltRun.runId,
    workflowId: rebuiltRun.workflowId,
    definitionDigest: rebuiltRun.definitionDigest,
    sequence: input.sequence,
    observedAt,
    eventType: input.eventType,
    stepId,
    evidence: normalizedEvidence,
    authority: {
      observationOnly: true,
      executionOccurred: false,
      execution: 'not_authorised',
      capabilitiesGranted: false,
      sentinelApprovalRequired: true,
      selfApproval: false,
    },
  };
  const checkpointDigest = await digestCanonicalInput(record);
  return freezeDeep({ ...record, checkpointDigest });
}
