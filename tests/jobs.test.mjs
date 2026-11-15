import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateJobSubmission,
  isJobId,
  isTerminalJobStatus,
  buildHealthCheckResult,
} from '../workers/runtime/lib.mjs';

test('accepts only the explicitly allowlisted no-argument health-check job', () => {
  assert.deepEqual(
    validateJobSubmission({ type: 'aegis.health_check', payload: {} }),
    { type: 'aegis.health_check', payload: {} },
  );
});

test('rejects unknown job types rather than executing arbitrary work', () => {
  assert.throws(
    () => validateJobSubmission({ type: 'shell.exec', payload: { command: 'whoami' } }),
    /Unsupported job type/,
  );
});

test('rejects unexpected payload fields for the health-check task', () => {
  assert.throws(
    () => validateJobSubmission({ type: 'aegis.health_check', payload: { url: 'https://example.com' } }),
    /does not accept payload fields/,
  );
});

test('rejects malformed job submissions', () => {
  for (const input of [null, [], {}, { type: 'aegis.health_check' }, { type: 3, payload: {} }]) {
    assert.throws(() => validateJobSubmission(input));
  }
});

test('recognises only opaque UUID job identifiers', () => {
  assert.equal(isJobId('f47ac10b-58cc-4372-a567-0e02b2c3d479'), true);
  assert.equal(isJobId('../secrets'), false);
  assert.equal(isJobId('not-a-uuid'), false);
});

test('identifies terminal job states', () => {
  assert.equal(isTerminalJobStatus('succeeded'), true);
  assert.equal(isTerminalJobStatus('failed'), true);
  assert.equal(isTerminalJobStatus('queued'), false);
  assert.equal(isTerminalJobStatus('running'), false);
});

test('health-check result reports runtime readiness without exposing configuration', () => {
  const result = buildHealthCheckResult({ DB: {}, JOBS: {} });
  assert.deepEqual(result, {
    ok: true,
    service: 'aegis-runtime',
    checks: { database: true, queue: true },
  });
  assert.equal(JSON.stringify(result).includes('secret'), false);
});
