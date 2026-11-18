import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AGENT_EXECUTION_RECEIPT_SCHEMA_VERSION,
  AGENT_RUN_RECORD_SCHEMA_VERSION,
  createAgentTaskEnvelope,
  listAgentSpecialists,
  validateAgentExecutionReceipt,
  validateAgentRunRecord,
  validateAgentSpecialistManifest,
} from '../functions/lib/agent-contracts.mjs';
import {
  CAPABILITY_PERMISSION_REQUEST_SCHEMA_VERSION,
  validatePermissionRequest,
} from '../functions/lib/capability-approvals.mjs';
import {
  createDefaultAegisCompanionProfile,
  validateCompanionProfile,
} from '../functions/lib/companion-contracts.mjs';
import { createDeviceProfile, validateDeviceProfile } from '../functions/lib/device-profile.mjs';
import { listSkills, validateSkillManifest } from '../functions/lib/skills.mjs';
import { createAgentPlan } from '../workers/runtime/agents.mjs';

const NOW = '2026-11-18T12:00:00.000Z';
const RUN_ID = '123e4567-e89b-42d3-a456-426614174000';
const DIGEST = 'sha256:' + 'a'.repeat(64);

function deviceSystem() {
  const observed = (value, source) => ({
    status: 'observed', value, source, observedAt: NOW, confidence: 'high',
  });
  const unavailable = (source) => ({
    status: 'not-available', value: null, source, observedAt: NOW, confidence: 'none',
  });
  return {
    osFamily: observed('ChromeOS', 'browser-capability'),
    osVersion: unavailable('browser-capability'),
    architecture: observed('arm64', 'browser-capability'),
    logicalProcessors: observed(8, 'browser-capability'),
    memoryBytes: unavailable('browser-capability'),
    storageBytes: observed(1000000000, 'storage-estimate'),
    storageFreeBytes: observed(500000000, 'storage-estimate'),
    gpuAcceleration: observed(true, 'webgl-capability-check'),
  };
}

function validReceipt() {
  return {
    schemaVersion: AGENT_EXECUTION_RECEIPT_SCHEMA_VERSION,
    receiptId: 'receipt-001',
    runId: RUN_ID,
    stepId: RUN_ID + ':1',
    attempt: 1,
    specialist: 'researcher',
    status: 'succeeded',
    executionMode: 'read-only',
    startedAt: NOW,
    completedAt: '2026-11-18T12:00:01.000Z',
    durationMs: 1000,
    inputDigest: DIGEST,
    outputDigest: 'sha256:' + 'b'.repeat(64),
    outputBytes: 128,
    workerId: 'worker-local-01',
    capabilityInvocations: [],
    externalEffects: false,
    errorCode: null,
    attestation: 'unsigned-structural-record',
  };
}

test('Stage 1 contracts compose without granting authority across trust boundaries', () => {
  const specialists = listAgentSpecialists();
  assert.equal(specialists.length, 5);
  for (const manifest of specialists) {
    assert.equal(validateAgentSpecialistManifest(manifest), true);
    assert.equal(manifest.executionMode, 'plan-only');
    assert.deepEqual(manifest.capabilityRequests, []);
  }

  const plan = createAgentPlan({
    objective: 'Review a bounded implementation and its security properties',
    specialists: specialists.map((entry) => entry.id),
  }, { runId: RUN_ID, createdAt: NOW });

  const runRecord = {
    schemaVersion: AGENT_RUN_RECORD_SCHEMA_VERSION,
    id: RUN_ID,
    objective: plan.objective,
    specialists: plan.steps.map((step) => step.specialist),
    projectId: null,
    hasProjectContext: false,
    contextDigest: null,
    status: 'planned',
    attempts: 1,
    createdAt: NOW,
    updatedAt: NOW,
    cancelledAt: null,
    executionAuthorized: false,
    executionAuthorizedAt: null,
    executionGrantId: null,
    plan,
    errorCode: null,
  };
  assert.equal(validateAgentRunRecord(runRecord), true);

  const task = createAgentTaskEnvelope(plan, {
    stepId: plan.steps[0].id,
    attempt: 1,
    createdAt: NOW,
  });
  assert.equal(task.runId, runRecord.id);
  assert.equal(task.specialist, runRecord.plan.steps[0].specialist);
  assert.equal(task.executionMode, 'plan-only');
  assert.deepEqual(task.capabilityRequests, []);

  const companion = validateCompanionProfile(createDefaultAegisCompanionProfile());
  assert.equal(companion.id, 'aegis');
  assert.equal(companion.memoryScope, 'user-governed');
  assert.equal(Object.hasOwn(companion, 'permissions'), false);

  const device = createDeviceProfile({
    platform: 'web',
    deviceClass: 'laptop',
    observedAt: NOW,
    system: deviceSystem(),
    aegis: {
      version: '0.1.0',
      activeModules: ['adaptive-guardian'],
      resourceBudget: { maxBackgroundTasks: 2, maxConcurrency: 1 },
    },
    permissions: ['device-profile:read'],
  });
  assert.equal(validateDeviceProfile(device), true);
  assert.equal(device.observationMode, 'read-only');

  const skills = listSkills();
  assert.ok(skills.length > 0);
  for (const skill of skills) {
    assert.equal(validateSkillManifest(skill), true);
    assert.equal(skill.execution, 'guidance-only');
    assert.deepEqual(skill.permissions, []);
  }

  const permissionRequest = {
    schemaVersion: CAPABILITY_PERMISSION_REQUEST_SCHEMA_VERSION,
    principalId: 'owner-1',
    capabilityId: 'project-space',
    capabilityVersion: '1.0.0',
    actionId: 'read-project',
    resourceId: 'project-a',
    operationSummary: 'Read the selected project summary',
    connectionId: null,
    inputDigest: DIGEST,
    requestedBy: 'owner-1',
    expiresAt: '2026-11-18T12:05:00.000Z',
  };
  assert.equal(validatePermissionRequest(permissionRequest, Date.parse(NOW)), true);
  assert.equal(Object.hasOwn(permissionRequest, 'grantId'), false);

  const receipt = validReceipt();
  assert.equal(validateAgentExecutionReceipt(receipt), true);
  assert.equal(receipt.attestation, 'unsigned-structural-record');
  assert.equal(receipt.externalEffects, false);
});

test('cross-contract boundaries reject attempts to smuggle authority between profiles and tasks', () => {
  const plan = createAgentPlan({
    objective: 'Inspect the safe task boundary',
    specialists: ['researcher'],
  }, { runId: RUN_ID, createdAt: NOW });
  const task = createAgentTaskEnvelope(plan, {
    stepId: plan.steps[0].id,
    attempt: 1,
    createdAt: NOW,
  });
  assert.throws(() => createAgentTaskEnvelope(plan, {
    stepId: plan.steps[0].id,
    attempt: 1,
    createdAt: NOW,
    budget: { maxOutputBytes: 8192, timeoutMs: 15000, permissions: ['admin'] },
  }));

  const companion = createDefaultAegisCompanionProfile();
  companion.permissions = ['admin'];
  assert.throws(() => validateCompanionProfile(companion));

  const permissionRequest = {
    schemaVersion: CAPABILITY_PERMISSION_REQUEST_SCHEMA_VERSION,
    principalId: 'owner-1',
    capabilityId: 'project-space',
    capabilityVersion: '1.0.0',
    actionId: 'read-project',
    resourceId: 'project-a',
    operationSummary: 'Read the selected project summary',
    connectionId: null,
    inputDigest: DIGEST,
    requestedBy: 'owner-1',
    expiresAt: '2026-11-18T12:05:00.000Z',
    grantId: 'self-issued-grant',
  };
  assert.throws(() => validatePermissionRequest(permissionRequest, Date.parse(NOW)));
  assert.throws(() => validateAgentExecutionReceipt({
    ...validReceipt(),
    attestation: 'signed',
  }));
  assert.equal(task.executionMode, 'plan-only');
});
