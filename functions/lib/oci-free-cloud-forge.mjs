const ALLOWED_PLAN_KEYS = new Set([
  'provider', 'tier', 'billingMode', 'allowPaidFallback', 'compute', 'blockVolumeGB', 'network',
]);
const ALLOWED_COMPUTE_KEYS = new Set(['shape', 'ocpus', 'memoryGB', 'bootVolumeGB']);
const ALLOWED_NETWORK_KEYS = new Set(['internetGateway', 'natGateway', 'loadBalancer']);
const MAX_OCPUS = 2;
const MAX_MEMORY_GB = 12;
const MAX_STORAGE_GB = 200;
const MAX_INSTANCES = 2;

function hasExactKeys(value, allowed) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).every((key) => allowed.has(key));
}

function isPositiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

/**
 * Evaluate a proposed OCI plan against a deliberately conservative subset of
 * the Always Free A1 allowance. This is a local policy check, not an OCI quote
 * or a guarantee that an account will incur no charges.
 */
export function evaluateOciFreeTierPlan(plan) {
  const errors = [];
  if (!hasExactKeys(plan, ALLOWED_PLAN_KEYS)) {
    return { allowed: false, errors: ['PLAN_SCHEMA_INVALID'], totals: null, billingPolicy: 'paid-resources-denied' };
  }

  if (plan.provider !== 'oracle-cloud-infrastructure') errors.push('PROVIDER_NOT_SUPPORTED');
  if (plan.tier !== 'always-free') errors.push('TIER_NOT_ALWAYS_FREE');
  if (plan.billingMode !== 'always-free-only') errors.push('BILLING_MODE_NOT_ALLOWED');
  if (plan.allowPaidFallback !== false) errors.push('PAID_FALLBACK_MUST_BE_DISABLED');

  if (!Array.isArray(plan.compute) || plan.compute.length < 1 || plan.compute.length > MAX_INSTANCES) {
    errors.push('INSTANCE_COUNT_OUTSIDE_POLICY');
  }

  let ocpus = 0;
  let memoryGB = 0;
  let bootVolumeGB = 0;
  let validCompute = Array.isArray(plan.compute) && plan.compute.length > 0 && plan.compute.length <= MAX_INSTANCES;
  if (validCompute) {
    for (const instance of plan.compute) {
      if (!hasExactKeys(instance, ALLOWED_COMPUTE_KEYS) ||
          instance.shape !== 'VM.Standard.A1.Flex' ||
          !isPositiveInteger(instance.ocpus) ||
          !isPositiveInteger(instance.memoryGB) ||
          !isPositiveInteger(instance.bootVolumeGB)) {
        validCompute = false;
        continue;
      }
      ocpus += instance.ocpus;
      memoryGB += instance.memoryGB;
      bootVolumeGB += instance.bootVolumeGB;
    }
  }
  if (!validCompute) errors.push('COMPUTE_SHAPE_OR_CONFIGURATION_NOT_ALLOWED');
  if (ocpus > MAX_OCPUS) errors.push('OCPU_ALLOWANCE_EXCEEDED');
  if (memoryGB > MAX_MEMORY_GB) errors.push('MEMORY_ALLOWANCE_EXCEEDED');

  const blockVolumeGB = plan.blockVolumeGB;
  if (!Number.isSafeInteger(blockVolumeGB) || blockVolumeGB < 0) {
    errors.push('BLOCK_VOLUME_CONFIGURATION_INVALID');
  }
  const storageGB = bootVolumeGB + (Number.isSafeInteger(blockVolumeGB) && blockVolumeGB >= 0 ? blockVolumeGB : 0);
  if (storageGB > MAX_STORAGE_GB) errors.push('COMBINED_STORAGE_ALLOWANCE_EXCEEDED');

  if (!hasExactKeys(plan.network, ALLOWED_NETWORK_KEYS) ||
      plan.network.internetGateway !== true ||
      plan.network.natGateway !== false ||
      plan.network.loadBalancer !== false) {
    errors.push('NETWORK_RESOURCE_POLICY_VIOLATION');
  }

  return {
    allowed: errors.length === 0,
    errors,
    totals: { instances: Array.isArray(plan.compute) ? plan.compute.length : 0, ocpus, memoryGB, storageGB },
    limits: { instances: MAX_INSTANCES, ocpus: MAX_OCPUS, memoryGB: MAX_MEMORY_GB, storageGB: MAX_STORAGE_GB },
    billingPolicy: 'paid-resources-denied',
    execution: 'not-available',
  };
}

export function createOciFreeCloudForge() {
  return Object.freeze({
    id: 'oci-free-cloud-forge',
    name: 'AEGIS Free Cloud Forge',
    provider: 'oracle-cloud-infrastructure',
    status: 'policy-and-planning-only',
    evaluate: evaluateOciFreeTierPlan,
  });
}
