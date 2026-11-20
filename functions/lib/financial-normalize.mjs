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
  if (typeof amount !== 'string' || !DECIMAL_AMOUNT_PATTERN.test(amount)) {
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
