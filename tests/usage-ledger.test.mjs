import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateUsageReservation,
  validateUsageSettlement,
  isUsageWindowActive,
  validateExistingUsageReservation,
  isQuotaVerificationFresh,
} from '../functions/lib/usage-ledger.mjs';

const reservation = {
  id: 'res_001',
  idempotencyKey: 'request_001',
  principalId: 'user_001',
  providerId: 'workers-ai',
  modelId: 'llama-33',
  unitKind: 'neurons',
  reservedUnits: 2500,
  windowStart: '2026-11-22T00:00:00.000Z',
  windowEnd: '2026-11-23T00:00:00.000Z',
};

test('accepts a bounded reservation with explicit provider, model, units and UTC window', () => {
  assert.deepEqual(validateUsageReservation(reservation), reservation);
});

test('rejects missing or ambiguous cost units instead of assuming tokens or neurons', () => {
  assert.throws(() => validateUsageReservation({ ...reservation, unitKind: undefined }), /unit/i);
  assert.throws(() => validateUsageReservation({ ...reservation, reservedUnits: 0 }), /units/i);
  assert.throws(() => validateUsageReservation({ ...reservation, reservedUnits: 1.5 }), /units/i);
});

test('rejects malformed identifiers, non-UTC windows and reversed windows', () => {
  assert.throws(() => validateUsageReservation({ ...reservation, providerId: '../provider' }), /provider/i);
  assert.throws(() => validateUsageReservation({ ...reservation, windowStart: 'tomorrow' }), /window/i);
  assert.throws(() => validateUsageReservation({ ...reservation, windowEnd: reservation.windowStart }), /window/i);
});

test('settlement requires actual usage not to exceed the reserved amount', () => {
  assert.deepEqual(validateUsageSettlement({ reservedUnits: 2500, actualUnits: 2200 }), {
    reservedUnits: 2500, actualUnits: 2200,
  });
  assert.throws(() => validateUsageSettlement({ reservedUnits: 2500, actualUnits: 2501 }), /reservation/i);
  assert.throws(() => validateUsageSettlement({ reservedUnits: 2500, actualUnits: -1 }), /actual/i);
});

test('quota window is active only inside its half-open UTC interval', () => {
  assert.equal(isUsageWindowActive(reservation, '2026-11-22T00:00:00.000Z'), true);
  assert.equal(isUsageWindowActive(reservation, '2026-11-22T23:59:59.999Z'), true);
  assert.equal(isUsageWindowActive(reservation, '2026-11-23T00:00:00.000Z'), false);
});


const existingReservation = {
  principal_id: 'user_001',
  project_id: null,
  provider_id: 'workers-ai',
  model_id: 'llama-33',
  unit_kind: 'neurons',
  reserved_units: 2500,
  window_start: '2026-11-22T00:00:00.000Z',
  window_end: '2026-11-23T00:00:00.000Z',
  quota_window_id: 'quota_001',
  status: 'reserved',
};

test('allows an idempotent retry only while the original reservation remains open', () => {
  assert.equal(validateExistingUsageReservation(
    existingReservation,
    reservation,
    'quota_001',
  ), true);
});

test('rejects replay of an idempotency key after its reservation was settled', () => {
  assert.throws(() => validateExistingUsageReservation(
    { ...existingReservation, status: 'settled' },
    reservation,
    'quota_001',
  ), /already been consumed/i);
});

test('rejects replay of an idempotency key after its reservation was released', () => {
  assert.throws(() => validateExistingUsageReservation(
    { ...existingReservation, status: 'released' },
    reservation,
    'quota_001',
  ), /already been consumed/i);
});

test('rejects idempotent retries whose provider, model, unit or reservation differs', () => {
  assert.throws(() => validateExistingUsageReservation(
    existingReservation,
    { ...reservation, reservedUnits: 2501 },
    'quota_001',
  ), /different usage reservation/i);
  assert.throws(() => validateExistingUsageReservation(
    existingReservation,
    reservation,
    'quota_002',
  ), /different usage reservation/i);
});


test('accepts a quota verification only while it is current and not from the future', () => {
  assert.equal(isQuotaVerificationFresh(
    '2026-11-22T11:00:00.000Z',
    '2026-11-22T11:30:00.000Z',
  ), true);
  assert.equal(isQuotaVerificationFresh(
    '2026-11-22T10:00:00.000Z',
    '2026-11-22T11:30:00.000Z',
  ), false);
  assert.equal(isQuotaVerificationFresh(
    '2026-11-22T11:31:00.000Z',
    '2026-11-22T11:30:00.000Z',
  ), false);
});

test('rejects invalid quota verification timestamps and freshness limits', () => {
  assert.equal(isQuotaVerificationFresh('not-a-date', '2026-11-22T11:30:00.000Z'), false);
  assert.equal(isQuotaVerificationFresh(
    '2026-11-22T11:00:00.000Z',
    '2026-11-22T11:30:00.000Z',
    0,
  ), false);
});
