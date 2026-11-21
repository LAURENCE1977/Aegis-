import { canonicalizeInput, digestCanonicalInput } from '../../functions/lib/canonical-input.mjs';
import { createExperimentalLabProfile } from './experimental-lab-profile.mjs';

const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,79}$/;
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/;
const VERSION_PATTERN = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;
const MAX_ENVELOPE_LIFETIME_MS = 24 * 60 * 60 * 1000;
const STEP_KINDS = new Set([
  'source_inspection',
  'dependency_inventory',
  'build',
  'test',
  'benchmark',
]);
const TOOLCHAINS = new Set(['static-analysis', 'node22', 'python311', 'rust193']);
const STATIC_ONLY_KINDS = new Set(['source_inspection', 'dependency_inventory']);

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

function canonicalTimestamp(value, label) {
  if (typeof value !== 'string') throw new TypeError(label + ' must be a canonical UTC timestamp.');
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
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

function validateProfile(value) {
  // Canonicalisation rejects accessors, exotic prototypes, cycles and oversized values
  // before any nested field is read.
  const supplied = canonicalizeInput(value);
  exactRecord(value, [
    'schemaVersion', 'profileId', 'createdAt', 'observedAt', 'workload', 'trust', 'limits',
    'network', 'filesystem', 'credentials', 'hostAccess', 'containerSocket', 'privileged',
    'interExperimentCommunication', 'approval', 'sentinelApprovalRequired', 'execution', 'lifecycle',
  ], 'Experimental lab profile');
  const normalized = createExperimentalLabProfile({
    profileId: value.profileId,
    createdAt: value.createdAt,
    observedAt: value.observedAt,
    workload: value.workload,
    limits: value.limits,
  });
  if (supplied !== canonicalizeInput(normalized)) {
    throw new TypeError('Execution envelope profile is not the exact deny-by-default profile contract.');
  }
  return normalized;
}

function validateSource(value) {
  exactRecord(value, ['repositoryUrl', 'commitSha', 'treeDigest'], 'Pinned source');
  if (typeof value.repositoryUrl !== 'string' ||
      !/^https:\/\/github\.com\/[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9_.-]+$/.test(value.repositoryUrl)) {
    throw new TypeError('Pinned source must use a canonical public GitHub repository URL.');
  }
  if (typeof value.commitSha !== 'string' || !COMMIT_PATTERN.test(value.commitSha)) {
    throw new TypeError('Pinned source requires a full immutable commit SHA.');
  }
  if (typeof value.treeDigest !== 'string' || !SHA256_PATTERN.test(value.treeDigest)) {
    throw new TypeError('Pinned source requires a SHA-256 tree digest.');
  }
  return Object.freeze({
    repositoryUrl: value.repositoryUrl,
    commitSha: value.commitSha,
    treeDigest: value.treeDigest,
  });
}

function validateRunner(value) {
  exactRecord(value, ['runtime', 'imageDigest', 'runnerVersion'], 'Runner image');
  if (value.runtime !== 'aegis-disposable-vm.v1') {
    throw new TypeError('Runner runtime is unsupported.');
  }
  if (typeof value.imageDigest !== 'string' || !SHA256_PATTERN.test(value.imageDigest)) {
    throw new TypeError('Runner image must be pinned by a SHA-256 digest.');
  }
  if (typeof value.runnerVersion !== 'string' || !VERSION_PATTERN.test(value.runnerVersion)) {
    throw new TypeError('Runner version must be a canonical semantic version.');
  }
  return Object.freeze({
    runtime: value.runtime,
    imageDigest: value.imageDigest,
    runnerVersion: value.runnerVersion,
  });
}

function validateSteps(value, wallTimeSeconds) {
  canonicalizeInput(value);
  if (!Array.isArray(value) || value.length < 1 || value.length > 10) {
    throw new RangeError('Execution plan must contain between one and ten steps.');
  }
  const seen = new Set();
  let totalTimeout = 0;
  const steps = value.map((step, index) => {
    exactRecord(step, ['stepId', 'kind', 'toolchain', 'timeoutSeconds'], 'Execution step ' + index);
    const stepId = identifier(step.stepId, 'Execution step identifier');
    if (seen.has(stepId)) throw new TypeError('Execution step identifiers must be unique.');
    seen.add(stepId);
    if (!STEP_KINDS.has(step.kind)) throw new TypeError('Execution step kind is unsupported.');
    if (!TOOLCHAINS.has(step.toolchain)) throw new TypeError('Execution step toolchain is unsupported.');
    if (STATIC_ONLY_KINDS.has(step.kind) && step.toolchain !== 'static-analysis') {
      throw new TypeError('Read-only inspection steps require the static-analysis toolchain.');
    }
    if (!Number.isSafeInteger(step.timeoutSeconds) || step.timeoutSeconds < 1 ||
        step.timeoutSeconds > wallTimeSeconds) {
      throw new RangeError('Execution step timeout exceeds the profile wall-time budget.');
    }
    totalTimeout += step.timeoutSeconds;
    return Object.freeze({
      stepId,
      kind: step.kind,
      toolchain: step.toolchain,
      timeoutSeconds: step.timeoutSeconds,
    });
  });
  if (totalTimeout > wallTimeSeconds) {
    throw new RangeError('Aggregate execution step timeouts exceed the profile wall-time budget.');
  }
  return Object.freeze(steps);
}

/**
 * Create an immutable, review-only execution envelope.
 * This binds an exact source, profile, runner image and bounded plan; it does not
 * authorise execution, provision a VM or grant capabilities.
 */
export async function createExperimentalLabExecutionEnvelope(input) {
  exactRecord(input, [
    'envelopeId', 'createdAt', 'expiresAt', 'profile', 'source', 'runner', 'steps',
  ], 'Experimental lab execution envelope');

  const envelopeId = identifier(input.envelopeId, 'Execution envelope identifier');
  const createdAt = canonicalTimestamp(input.createdAt, 'Envelope creation time');
  const expiresAt = canonicalTimestamp(input.expiresAt, 'Envelope expiry time');
  const lifetime = Date.parse(expiresAt) - Date.parse(createdAt);
  if (lifetime < 1 || lifetime > MAX_ENVELOPE_LIFETIME_MS) {
    throw new RangeError('Execution envelope expiry must be within 24 hours after creation.');
  }

  const profile = validateProfile(input.profile);
  if (Date.parse(createdAt) < Date.parse(profile.observedAt)) {
    throw new RangeError('Execution envelope cannot predate its profile observation.');
  }
  const source = validateSource(input.source);
  const runner = validateRunner(input.runner);
  const steps = validateSteps(input.steps, profile.limits.wallTimeSeconds);

  const profileDigest = await digestCanonicalInput(profile);
  const sourceDigest = await digestCanonicalInput(source);
  const planDigest = await digestCanonicalInput(steps);
  const record = {
    schemaVersion: 'aegis.experimental-lab-execution-envelope.v1',
    envelopeId,
    createdAt,
    expiresAt,
    profile,
    profileDigest,
    source,
    sourceDigest,
    runner,
    steps,
    planDigest,
    authority: {
      humanApprovalRequired: true,
      sentinelApprovalRequired: true,
      approvalGranted: false,
      capabilitiesGranted: false,
      execution: 'not_authorised',
      selfApproval: false,
    },
  };
  const envelopeDigest = await digestCanonicalInput(record);
  return freezeDeep({ ...record, envelopeDigest });
}
