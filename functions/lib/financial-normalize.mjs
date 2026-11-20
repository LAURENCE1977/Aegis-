const DECIMAL_AMOUNT_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

/**
 * Convert an exact decimal string into integer minor units.
 *
 * The currency exponent must come from trusted provider/currency metadata;
 * this function deliberately does not guess it or perform FX conversion.
 * BigInt arithmetic avoids binary floating-point rounding, while the returned
 * integer is a string so it remains JSON-safe at any supported magnitude.
 */
export function parseMoneyToMinorUnits({ amount, currency, minorUnitDigits } = {}) {
  if (typeof amount !== 'string' || amount.length > 40 || !DECIMAL_AMOUNT_PATTERN.test(amount)) {
    throw new TypeError('Money amount must be an exact decimal string.');
  }
  if (typeof currency !== 'string' || !CURRENCY_PATTERN.test(currency.toUpperCase())) {
    throw new TypeError('Currency must be a three-letter ISO-style code.');
  }
  if (!Number.isInteger(minorUnitDigits) || minorUnitDigits < 0 || minorUnitDigits > 4) {
    throw new TypeError('A trusted currency exponent from zero to four is required.');
  }

  const negative = amount.startsWith('-');
  const unsigned = negative ? amount.slice(1) : amount;
  const [whole, fraction = ''] = unsigned.split('.');
  const significantFraction = fraction.replace(/0+$/, '');
  if (significantFraction.length > minorUnitDigits) {
    throw new TypeError('Money amount has non-zero precision beyond the currency exponent.');
  }

  const scaledFraction = significantFraction.padEnd(minorUnitDigits, '0');
  const scale = 10n ** BigInt(minorUnitDigits);
  const wholeUnits = BigInt(whole) * scale;
  const fractionalUnits = scaledFraction ? BigInt(scaledFraction) : 0n;
  const magnitude = wholeUnits + fractionalUnits;
  const signed = negative && magnitude !== 0n ? -magnitude : magnitude;

  return {
    amountMinor: signed.toString(),
    currency: currency.toUpperCase(),
  };
}


const PROVIDER_PATTERN = /^[a-z][a-z0-9_-]{0,63}$/;
const TRANSACTION_STATUSES = new Set(['pending', 'booked', 'reversed', 'deleted']);
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:(?:0\d|1[0-3]):[0-5]\d|14:00))$/;

function requireOpaqueIdentifier(value, label) {
  if (
    typeof value !== 'string'
    || value.length < 1
    || value.length > 256
    || value.trim() !== value
    || /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new TypeError(label + ' must be a bounded, non-empty identifier.');
  }
  return value;
}

function normalizeSourceTimestamp(value, label) {
  if (typeof value !== 'string' || !ISO_TIMESTAMP_PATTERN.test(value)) {
    throw new TypeError(label + ' must be an ISO timestamp with an explicit timezone.');
  }

  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  if (
    calendarDate.getUTCFullYear() !== year
    || calendarDate.getUTCMonth() !== month - 1
    || calendarDate.getUTCDate() !== day
  ) {
    throw new TypeError(label + ' must contain a valid calendar date.');
  }

  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) {
    throw new TypeError(label + ' must be a valid ISO timestamp.');
  }
  return new Date(milliseconds).toISOString();
}

/**
 * Normalize one provider transaction without losing its source identity.
 * The external account reference must already be scoped to the owner/tenant
 * by the trusted adapter; this pure function does not establish ownership.
 */
export function normalizeFinancialTransaction({
  provider,
  accountRef,
  externalId,
  amount,
  currency,
  minorUnitDigits,
  occurredAt,
  status,
  sourceUpdatedAt = null,
} = {}) {
  if (typeof provider !== 'string' || !PROVIDER_PATTERN.test(provider)) {
    throw new TypeError('Provider must be a lowercase provider slug.');
  }
  requireOpaqueIdentifier(accountRef, 'Account reference');
  requireOpaqueIdentifier(externalId, 'External transaction ID');

  if (!TRANSACTION_STATUSES.has(status)) {
    throw new TypeError('Transaction status is not supported.');
  }

  const money = parseMoneyToMinorUnits({ amount, currency, minorUnitDigits });
  const normalizedOccurredAt = normalizeSourceTimestamp(occurredAt, 'Transaction timestamp');
  const normalizedSourceUpdatedAt = sourceUpdatedAt === null
    ? null
    : normalizeSourceTimestamp(sourceUpdatedAt, 'Source update timestamp');

  return {
    provider,
    accountRef,
    externalId,
    amountMinor: money.amountMinor,
    currency: money.currency,
    occurredAt: normalizedOccurredAt,
    status,
    sourceUpdatedAt: normalizedSourceUpdatedAt,
  };
}
