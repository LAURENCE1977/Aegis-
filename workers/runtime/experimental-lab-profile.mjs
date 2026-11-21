const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,79}$/;
const WORKLOADS = new Set([
  'untrusted_repository',
  'generated_client',
  'document_parser',
  'browser_capture_fixture',
  'model_evaluation',
]);
const LIMITS = Object.freeze({
  cpuMillis: Object.freeze({ min: 100, max: 4000 }),
  memoryMiB: Object.freeze({ min: 128, max: 4096 }),
  wallTimeSeconds: Object.freeze({ min: 1, max: 3600 }),
  outputBytes: Object.freeze({ min: 1024, max: 10485760 }),
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

function canonicalTimestamp(value, label) {
  if (typeof value !== 'string') throw new TypeError(label + ' must be a canonical UTC timestamp.');
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
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
 * Build a policy description for a future isolated experiment.
 * This is a contract only: it does not create a sandbox or execute workloads.
 */
export function createExperimentalLabProfile(input) {
  exactRecord(input, ['profileId', 'createdAt', 'observedAt', 'workload', 'limits'], 'Experimental lab profile');
  if (typeof input.profileId !== 'string' || !ID_PATTERN.test(input.profileId)) {
    throw new TypeError('Experimental lab profile identifier is invalid.');
  }
  const createdAt = canonicalTimestamp(input.createdAt, 'Profile creation time');
  const observedAt = canonicalTimestamp(input.observedAt, 'Profile observation time');
  if (Date.parse(createdAt) > Date.parse(observedAt)) {
    throw new RangeError('Profile creation time cannot be newer than its observation time.');
  }
  if (!WORKLOADS.has(input.workload)) throw new TypeError('Experimental lab workload is unsupported.');

  exactRecord(input.limits, Object.keys(LIMITS), 'Experimental lab resource limits');
  const limits = {};
  for (const [name, range] of Object.entries(LIMITS)) {
    const value = input.limits[name];
    if (!Number.isSafeInteger(value) || value < range.min || value > range.max) {
      throw new RangeError('Experimental lab ' + name + ' is outside its permitted limits.');
    }
    limits[name] = value;
  }

  return freezeDeep({
    schemaVersion: 'aegis.experimental-lab-profile.v1',
    profileId: input.profileId,
    createdAt,
    observedAt,
    workload: input.workload,
    trust: 'untrusted',
    limits,
    network: { mode: 'disabled', egressAllowlist: [] },
    filesystem: {
      root: 'ephemeral',
      sourceMount: 'read_only',
      output: 'quarantine',
      hostPaths: 'denied',
    },
    credentials: { mode: 'none', secretMounts: 'denied' },
    hostAccess: 'denied',
    containerSocket: 'denied',
    privileged: false,
    interExperimentCommunication: 'denied',
    approval: 'human_required',
    sentinelApprovalRequired: true,
    execution: 'not_authorised',
    lifecycle: 'profile_only_no_runtime_created',
  });
}
