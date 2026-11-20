import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMoneyToMinorUnits } from '../functions/lib/financial-normalize.mjs';

test('converts an exact decimal amount to integer minor units without floating-point rounding', () => {
  assert.deepEqual(
    parseMoneyToMinorUnits({ amount: '123.45', currency: 'GBP', minorUnitDigits: 2 }),
    { amountMinor: '12345', currency: 'GBP' },
  );
});

test('supports zero-decimal and three-decimal currencies when the provider exponent is explicit', () => {
  assert.deepEqual(
    parseMoneyToMinorUnits({ amount: '125', currency: 'JPY', minorUnitDigits: 0 }),
    { amountMinor: '125', currency: 'JPY' },
  );
  assert.deepEqual(
    parseMoneyToMinorUnits({ amount: '1.234', currency: 'KWD', minorUnitDigits: 3 }),
    { amountMinor: '1234', currency: 'KWD' },
  );
});

test('normalizes currency codes and negative values without losing precision', () => {
  assert.deepEqual(
    parseMoneyToMinorUnits({ amount: '-0.10', currency: 'gbp', minorUnitDigits: 2 }),
    { amountMinor: '-10', currency: 'GBP' },
  );
});

test('accepts only exact decimal strings and refuses implicit rounding', () => {
  for (const amount of [1.25, Number.NaN, '1.239', '1e3', '1,000.00', '', ' 1.00 ']) {
    assert.throws(
      () => parseMoneyToMinorUnits({ amount, currency: 'GBP', minorUnitDigits: 2 }),
      TypeError,
    );
  }
});

test('rejects invalid currency codes and unspecified or unsupported decimal exponents', () => {
  for (const input of [
    { amount: '1.00', currency: 'GB', minorUnitDigits: 2 },
    { amount: '1.00', currency: 'GBP1', minorUnitDigits: 2 },
    { amount: '1.00', currency: 'GBP', minorUnitDigits: undefined },
    { amount: '1.00', currency: 'GBP', minorUnitDigits: 5 },
    { amount: '1.00', currency: 'GBP', minorUnitDigits: -1 },
  ]) {
    assert.throws(() => parseMoneyToMinorUnits(input), TypeError);
  }
});

test('allows excess fractional zeroes but never rounds non-zero excess digits', () => {
  assert.deepEqual(
    parseMoneyToMinorUnits({ amount: '7.2300', currency: 'GBP', minorUnitDigits: 2 }),
    { amountMinor: '723', currency: 'GBP' },
  );
  assert.throws(
    () => parseMoneyToMinorUnits({ amount: '7.2301', currency: 'GBP', minorUnitDigits: 2 }),
    TypeError,
  );
});

test('rejects excessively long decimal input before BigInt conversion', () => {
  assert.throws(
    () => parseMoneyToMinorUnits({ amount: '9'.repeat(41), currency: 'GBP', minorUnitDigits: 2 }),
    TypeError,
  );
});


import { normalizeFinancialAccount, normalizeFinancialSyncRun, normalizeFinancialTransaction } from '../functions/lib/financial-normalize.mjs';

test('normalizes a transaction while retaining exact amount and provider provenance', () => {
  assert.deepEqual(
    normalizeFinancialTransaction({
      provider: 'xero',
      accountRef: 'acct_opaque_01',
      externalId: 'txn_123',
      amount: '-12.34',
      currency: 'gbp',
      minorUnitDigits: 2,
      occurredAt: '2026-11-20T10:30:00+00:00',
      status: 'booked',
      sourceUpdatedAt: '2026-11-20T10:31:00Z',
    }),
    {
      provider: 'xero',
      accountRef: 'acct_opaque_01',
      externalId: 'txn_123',
      amountMinor: '-1234',
      currency: 'GBP',
      occurredAt: '2026-11-20T10:30:00.000Z',
      status: 'booked',
      sourceUpdatedAt: '2026-11-20T10:31:00.000Z',
    },
  );
});

test('normalizes an offset timestamp to UTC and permits an absent source update time', () => {
  const result = normalizeFinancialTransaction({
    provider: 'freeagent',
    accountRef: 'bank_opaque_02',
    externalId: 'txn_456',
    amount: '8.00',
    currency: 'GBP',
    minorUnitDigits: 2,
    occurredAt: '2026-11-20T11:30:00+01:00',
    status: 'pending',
  });

  assert.equal(result.occurredAt, '2026-11-20T10:30:00.000Z');
  assert.equal(result.sourceUpdatedAt, null);
});

test('accepts only explicit provider transaction lifecycle states', () => {
  for (const status of ['pending', 'booked', 'reversed', 'deleted']) {
    assert.equal(normalizeFinancialTransaction({
      provider: 'xero',
      accountRef: 'acct_01',
      externalId: 'txn_' + status,
      amount: '1.00',
      currency: 'GBP',
      minorUnitDigits: 2,
      occurredAt: '2026-11-20T10:30:00Z',
      status,
    }).status, status);
  }
  assert.throws(() => normalizeFinancialTransaction({
    provider: 'xero',
    accountRef: 'acct_01',
    externalId: 'txn_unknown',
    amount: '1.00',
    currency: 'GBP',
    minorUnitDigits: 2,
    occurredAt: '2026-11-20T10:30:00Z',
    status: 'settled',
  }), TypeError);
});

test('rejects missing, malformed or oversized transaction identity fields', () => {
  const valid = {
    provider: 'xero',
    accountRef: 'acct_01',
    externalId: 'txn_01',
    amount: '1.00',
    currency: 'GBP',
    minorUnitDigits: 2,
    occurredAt: '2026-11-20T10:30:00Z',
    status: 'booked',
  };

  for (const patch of [
    { provider: '' },
    { provider: 'Xero API' },
    { accountRef: ' acct_01' },
    { externalId: '' },
    { externalId: 'x'.repeat(257) },
  ]) {
    assert.throws(() => normalizeFinancialTransaction({ ...valid, ...patch }), TypeError);
  }
});

test('rejects timestamps without an explicit timezone or with invalid calendar dates', () => {
  const valid = {
    provider: 'xero',
    accountRef: 'acct_01',
    externalId: 'txn_01',
    amount: '1.00',
    currency: 'GBP',
    minorUnitDigits: 2,
    occurredAt: '2026-11-20T10:30:00Z',
    status: 'booked',
  };

  for (const occurredAt of [
    '2026-11-20T10:30:00',
    '2026-02-30T10:30:00Z',
    'not-a-date',
  ]) {
    assert.throws(() => normalizeFinancialTransaction({ ...valid, occurredAt }), TypeError);
  }
});

test('rejects an invalid optional source update timestamp', () => {
  assert.throws(() => normalizeFinancialTransaction({
    provider: 'xero',
    accountRef: 'acct_01',
    externalId: 'txn_01',
    amount: '1.00',
    currency: 'GBP',
    minorUnitDigits: 2,
    occurredAt: '2026-11-20T10:30:00Z',
    status: 'booked',
    sourceUpdatedAt: 'yesterday',
  }), TypeError);
});

test('normalizes owner-scoped read-only account references without treating them as credentials', () => {
  assert.deepEqual(
    normalizeFinancialAccount({
      ownerId: 'owner',
      provider: 'xero',
      connectionRef: 'connection_123',
      externalAccountRef: 'tenant_account_456',
      currency: 'gbp',
      status: 'read_only',
      createdAt: '2026-11-20T10:00:00Z',
      updatedAt: '2026-11-20T10:05:00+00:00',
    }),
    {
      ownerId: 'owner',
      provider: 'xero',
      connectionRef: 'connection_123',
      externalAccountRef: 'tenant_account_456',
      currency: 'GBP',
      status: 'read_only',
      createdAt: '2026-11-20T10:00:00.000Z',
      updatedAt: '2026-11-20T10:05:00.000Z',
    },
  );
});

test('rejects account references without an owner, connection, provider or safe read-only state', () => {
  const valid = {
    ownerId: 'owner',
    provider: 'xero',
    connectionRef: 'connection_123',
    externalAccountRef: 'tenant_account_456',
    currency: 'GBP',
    status: 'read_only',
    createdAt: '2026-11-20T10:00:00Z',
    updatedAt: '2026-11-20T10:05:00Z',
  };
  for (const patch of [
    { ownerId: '' },
    { connectionRef: '' },
    { provider: 'Xero API' },
    { externalAccountRef: ' tenant_account_456' },
    { currency: 'US' },
    { status: 'writable' },
    { updatedAt: 'not-a-date' },
  ]) {
    assert.throws(() => normalizeFinancialAccount({ ...valid, ...patch }), TypeError);
  }
});

test('normalizes running and complete sync metadata with explicit completeness', () => {
  assert.deepEqual(
    normalizeFinancialSyncRun({
      ownerId: 'owner',
      accountId: 'account_123',
      status: 'running',
      pagesRead: 1,
      recordsRead: 20,
      startedAt: '2026-11-20T10:00:00Z',
    }),
    {
      ownerId: 'owner',
      accountId: 'account_123',
      status: 'running',
      pagesRead: 1,
      recordsRead: 20,
      startedAt: '2026-11-20T10:00:00.000Z',
      completedAt: null,
      failureCode: null,
    },
  );

  const complete = normalizeFinancialSyncRun({
    ownerId: 'owner',
    accountId: 'account_123',
    status: 'complete',
    pagesRead: 3,
    recordsRead: 42,
    startedAt: '2026-11-20T10:00:00Z',
    completedAt: '2026-11-20T10:01:00Z',
  });
  assert.equal(complete.status, 'complete');
  assert.equal(complete.completedAt, '2026-11-20T10:01:00.000Z');
});

test('rejects sync runs that could misrepresent incomplete or failed reads as complete', () => {
  const valid = {
    ownerId: 'owner',
    accountId: 'account_123',
    status: 'running',
    pagesRead: 0,
    recordsRead: 0,
    startedAt: '2026-11-20T10:00:00Z',
  };
  for (const patch of [
    { pagesRead: -1 },
    { recordsRead: 1.5 },
    { status: 'unknown' },
    { status: 'complete' },
    { status: 'failed', completedAt: '2026-11-20T10:01:00Z' },
    { status: 'running', completedAt: '2026-11-20T10:01:00Z' },
    { failureCode: 'provider auth failed' },
  ]) {
    assert.throws(() => normalizeFinancialSyncRun({ ...valid, ...patch }), TypeError);
  }
});
