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
