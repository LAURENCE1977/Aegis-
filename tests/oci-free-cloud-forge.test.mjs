import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateOciFreeTierPlan, createOciFreeCloudForge } from '../functions/lib/oci-free-cloud-forge.mjs';

const plan = {
  provider: 'oracle-cloud-infrastructure',
  tier: 'always-free',
  billingMode: 'always-free-only',
  allowPaidFallback: false,
  compute: [{ shape: 'VM.Standard.A1.Flex', ocpus: 2, memoryGB: 12, bootVolumeGB: 50 }],
  blockVolumeGB: 150,
  network: { internetGateway: true, natGateway: false, loadBalancer: false },
};

test('accepts a plan inside the conservative OCI A1 Always Free envelope', () => {
  const result = evaluateOciFreeTierPlan(plan);
  assert.equal(result.allowed, true);
  assert.deepEqual(result.totals, { instances: 1, ocpus: 2, memoryGB: 12, storageGB: 200 });
  assert.equal(result.billingPolicy, 'paid-resources-denied');
});

test('rejects paid fallbacks and any non-Always-Free billing mode', () => {
  assert.equal(evaluateOciFreeTierPlan({ ...plan, allowPaidFallback: true }).allowed, false);
  assert.equal(evaluateOciFreeTierPlan({ ...plan, billingMode: 'pay-as-you-go' }).allowed, false);
  assert.equal(evaluateOciFreeTierPlan({ ...plan, tier: 'free-trial' }).allowed, false);
});

test('rejects compute above the aggregate two OCPU or twelve GB limits', () => {
  assert.equal(evaluateOciFreeTierPlan({ ...plan, compute: [{ ...plan.compute[0], ocpus: 3 }] }).allowed, false);
  assert.equal(evaluateOciFreeTierPlan({ ...plan, compute: [{ ...plan.compute[0], memoryGB: 13 }] }).allowed, false);
  assert.equal(evaluateOciFreeTierPlan({ ...plan, compute: [
    { shape: 'VM.Standard.A1.Flex', ocpus: 1, memoryGB: 6, bootVolumeGB: 30 },
    { shape: 'VM.Standard.A1.Flex', ocpus: 1, memoryGB: 7, bootVolumeGB: 30 },
  ] }).allowed, false);
});

test('rejects unsupported shapes and malformed or empty compute plans', () => {
  assert.equal(evaluateOciFreeTierPlan({ ...plan, compute: [] }).allowed, false);
  assert.equal(evaluateOciFreeTierPlan({ ...plan, compute: [{ ...plan.compute[0], shape: 'VM.Standard.E5.Flex' }] }).allowed, false);
  assert.equal(evaluateOciFreeTierPlan({ ...plan, compute: [{ ...plan.compute[0], ocpus: 0 }] }).allowed, false);
});

test('enforces the combined boot and block volume ceiling', () => {
  assert.equal(evaluateOciFreeTierPlan({ ...plan, blockVolumeGB: 151 }).allowed, false);
  assert.equal(evaluateOciFreeTierPlan({ ...plan, compute: [{ ...plan.compute[0], bootVolumeGB: 201 }], blockVolumeGB: 0 }).allowed, false);
});

test('denies NAT gateways, load balancers and unrecognised network settings', () => {
  assert.equal(evaluateOciFreeTierPlan({ ...plan, network: { ...plan.network, natGateway: true } }).allowed, false);
  assert.equal(evaluateOciFreeTierPlan({ ...plan, network: { ...plan.network, loadBalancer: true } }).allowed, false);
  assert.equal(evaluateOciFreeTierPlan({ ...plan, network: { ...plan.network, unknownResource: true } }).allowed, false);
});

test('fails closed for missing fields and unexpected top-level properties', () => {
  assert.equal(evaluateOciFreeTierPlan({ ...plan, provider: undefined }).allowed, false);
  assert.equal(evaluateOciFreeTierPlan({ ...plan, estimatedMonthlyCost: 0 }).allowed, false);
  assert.equal(evaluateOciFreeTierPlan(null).allowed, false);
});

test('the Forge exposes evaluation only and has no provisioning or account-creation method', () => {
  const forge = createOciFreeCloudForge();
  assert.equal(forge.status, 'policy-and-planning-only');
  assert.equal(typeof forge.evaluate, 'function');
  assert.equal('provision' in forge, false);
  assert.equal('createAccount' in forge, false);
});
