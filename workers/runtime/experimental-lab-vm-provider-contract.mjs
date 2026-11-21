const PROVIDER_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const VERSION_PATTERN = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;
const REQUIRED_OPERATIONS = Object.freeze([
  'create',
  'inspect',
  'cancel',
  'destroy',
  'verify_destroyed',
]);
const REQUIRED_CAPABILITIES = Object.freeze([
  'disposableInstances',
  'pinnedImages',
  'networkIsolation',
  'cpuQuota',
  'memoryQuota',
  'pidQuota',
  'diskQuota',
  'outputQuota',
  'wallTimeQuota',
  'readOnlySourceMount',
  'quarantinedOutput',
  'credentialIsolation',
  'nonRootGuest',
  'verifiedTeardown',
]);
const RESOURCE_LIMITS = Object.freeze({
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

function freezeDeep(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freezeDeep(child);
  return Object.freeze(value);
}

/**
 * Record the minimum interface and isolation claims required of a future VM
 * provider. This is a declaration only: it does not load a driver, create a VM,
 * prove that a provider enforces its claims, or authorise execution.
 */
export function createExperimentalLabVmProviderContract(input) {
  exactRecord(input, [
    'providerId',
    'providerVersion',
    'runtime',
    'operations',
    'capabilities',
    'resourceCeilings',
  ], 'Experimental lab VM provider contract');

  if (typeof input.providerId !== 'string' || !PROVIDER_ID_PATTERN.test(input.providerId)) {
    throw new TypeError('VM provider identifier is invalid.');
  }
  if (typeof input.providerVersion !== 'string' || !VERSION_PATTERN.test(input.providerVersion)) {
    throw new TypeError('VM provider version must be canonical semantic version text.');
  }
  if (input.runtime !== 'aegis-disposable-vm.v1') {
    throw new TypeError('VM provider runtime is unsupported.');
  }

  if (!Array.isArray(input.operations) || input.operations.length !== REQUIRED_OPERATIONS.length) {
    throw new TypeError('VM provider must declare the complete lifecycle operation surface.');
  }
  const operations = [...input.operations];
  if (operations.some(operation => typeof operation !== 'string') ||
      new Set(operations).size !== REQUIRED_OPERATIONS.length ||
      REQUIRED_OPERATIONS.some(operation => !operations.includes(operation))) {
    throw new TypeError('VM provider lifecycle operations are incomplete or unsupported.');
  }
  operations.sort();

  exactRecord(input.capabilities, REQUIRED_CAPABILITIES, 'VM provider capabilities');
  const capabilities = {};
  for (const capability of REQUIRED_CAPABILITIES) {
    if (input.capabilities[capability] !== true) {
      throw new TypeError('VM provider is missing required isolation capability: ' + capability + '.');
    }
    capabilities[capability] = true;
  }

  exactRecord(input.resourceCeilings, Object.keys(RESOURCE_LIMITS), 'VM provider resource ceilings');
  const resourceCeilings = {};
  for (const [name, range] of Object.entries(RESOURCE_LIMITS)) {
    const value = input.resourceCeilings[name];
    if (!Number.isSafeInteger(value) || value < range.min || value > range.max) {
      throw new RangeError('VM provider ' + name + ' ceiling is outside the experimental lab hard limits.');
    }
    resourceCeilings[name] = value;
  }

  return freezeDeep({
    schemaVersion: 'aegis.experimental-lab-vm-provider-contract.v1',
    providerId: input.providerId,
    providerVersion: input.providerVersion,
    runtime: input.runtime,
    operations,
    capabilities,
    resourceCeilings,
    qualification: 'declared_unverified',
    humanApprovalRequired: true,
    sentinelApprovalRequired: true,
    execution: 'not_authorised',
  });
}
