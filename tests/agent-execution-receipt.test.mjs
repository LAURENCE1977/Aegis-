import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AGENT_EXECUTION_RECEIPT_SCHEMA_VERSION,
  validateAgentExecutionReceipt,
} from '../functions/lib/agent-contracts.mjs';

const runId = '123e4567-e89b-42d3-a456-426614174000';
const validReceipt = {
  schemaVersion: AGENT_EXECUTION_RECEIPT_SCHEMA_VERSION,
  receiptId: 'receipt-001',
  runId,
  stepId: runId + ':1',
  attempt: 1,
  specialist: 'researcher',
  status: 'succeeded',
  executionMode: 'read-only',
  startedAt: '2026-11-18T08:00:00.000Z',
  completedAt: '2026-11-18T08:00:01.000Z',
  durationMs: 1000,
  inputDigest: 'sha256:' + 'a'.repeat(64),
  outputDigest: 'sha256:' + 'b'.repeat(64),
  outputBytes: 128,
  workerId: 'worker-local-01',
  capabilityInvocations: [],
  externalEffects: false,
  errorCode: null,
  attestation: 'unsigned-structural-record',
};

test('accepts a bounded read-only execution receipt with explicit structural-only attestation', () => {
  assert.equal(validateAgentExecutionReceipt(validReceipt), true);
});

test('accepts bounded Sentinel invocation metadata without storing tool payloads', () => {
  const receipt = {
    ...validReceipt,
    capabilityInvocations: [{
      invocationId: 'invoke-001',
      capabilityId: 'project-space',
      capabilityVersion: '1.0.0',
      actionId: 'read-project',
      resourceId: 'project-a',
      inputDigest: 'sha256:' + 'c'.repeat(64),
      decision: 'allowed',
    }],
  };
  assert.equal(validateAgentExecutionReceipt(receipt), true);
});

test('rejects write authority, external effects, invalid state and unbounded output', () => {
  for (const overrides of [
    { executionMode: 'write' },
    { externalEffects: true },
    { status: 'running' },
    { outputBytes: 32769 },
    { inputDigest: 'not-a-digest' },
    { durationMs: 1001 },
    { completedAt: '2026-11-18T07:59:59.000Z' },
    { errorCode: 'bad code' },
    { extra: 'unreviewed data' },
  ]) assert.throws(() => validateAgentExecutionReceipt({ ...validReceipt, ...overrides }));
});

test('requires non-success outcomes to carry a bounded error code', () => {
  assert.throws(() => validateAgentExecutionReceipt({
    ...validReceipt,
    status: 'failed',
    errorCode: null,
  }));
  assert.equal(validateAgentExecutionReceipt({
    ...validReceipt,
    status: 'failed',
    errorCode: 'AGENT_STEP_FAILED',
  }), true);
});

test('rejects malformed or excessive Sentinel invocation records', () => {
  const invocation = {
    invocationId: 'invoke-001',
    capabilityId: 'project-space',
    capabilityVersion: '1.0.0',
    actionId: 'read-project',
    resourceId: 'project-a',
    inputDigest: 'sha256:' + 'c'.repeat(64),
    decision: 'allowed',
  };
  assert.throws(() => validateAgentExecutionReceipt({
    ...validReceipt,
    capabilityInvocations: [{ ...invocation, secret: 'never-store' }],
  }));
  assert.throws(() => validateAgentExecutionReceipt({
    ...validReceipt,
    capabilityInvocations: Array.from({ length: 17 }, (_, index) => ({
      ...invocation,
      invocationId: 'invoke-' + String(index).padStart(3, '0'),
    })),
  }));
});
