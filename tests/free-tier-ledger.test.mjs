import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateFreeTierRecord,
  createFreeTierLedger,
  isFreeTierRecordCurrent,
} from '../functions/lib/free-tier-ledger.mjs';

const record = {
  id: 'example-cloud-worker-free',
  provider: 'Example Cloud',
  service: 'Worker Runtime',
  category: 'compute',
  allowance: '100000 requests per day',
  duration: 'ongoing',
  cardRequired: false,
  commercialUse: 'allowed',
  overage: 'blocked',
  regions: ['global'],
  quotas: [{ metric: 'requests', limit: 100000, period: 'day' }],
  pricingUrl: 'https://example.com/pricing',
  termsUrl: 'https://example.com/terms',
  verifiedAt: '2026-11-15T00:00:00.000Z',
  confidence: 'high',
  status: 'verified',
};

test('accepts a bounded free-tier record with official terms and verification date', () => {
  assert.equal(validateFreeTierRecord(record), true);
});

test('rejects unverified or non-HTTPS pricing and terms links', () => {
  assert.throws(() => validateFreeTierRecord({ ...record, pricingUrl: 'http://example.com/pricing' }));
  assert.throws(() => validateFreeTierRecord({ ...record, termsUrl: 'https://user:pass@example.com/terms' }));
});

test('rejects unknown overage behavior from being represented as safe free usage', () => {
  assert.throws(() => validateFreeTierRecord({ ...record, overage: 'unlimited-free' }));
  assert.equal(validateFreeTierRecord({ ...record, overage: 'unknown', confidence: 'low' }), true);
});

test('requires explicit commercial-use status and card requirement', () => {
  assert.throws(() => validateFreeTierRecord({ ...record, commercialUse: 'maybe' }));
  assert.throws(() => validateFreeTierRecord({ ...record, cardRequired: 'sometimes' }));
});

test('rejects negative, malformed and duplicate quota definitions', () => {
  assert.throws(() => validateFreeTierRecord({
    ...record,
    quotas: [{ metric: 'requests', limit: -1, period: 'day' }],
  }));
  assert.throws(() => validateFreeTierRecord({
    ...record,
    quotas: [
      { metric: 'requests', limit: 100, period: 'day' },
      { metric: 'requests', limit: 200, period: 'day' },
    ],
  }));
});

test('marks stale offers as requiring re-verification without deleting their evidence', () => {
  assert.equal(isFreeTierRecordCurrent(record, Date.parse('2026-11-20T00:00:00.000Z')), true);
  assert.equal(isFreeTierRecordCurrent(record, Date.parse('2027-01-01T00:00:00.000Z')), false);
});

test('ledger search is case-insensitive and returns defensive copies', () => {
  const ledger = createFreeTierLedger([record]);
  assert.equal(ledger.search('worker').length, 1);
  assert.equal(ledger.search('CLOUD').length, 1);
  const results = ledger.list();
  results[0].quotas[0].limit = 1;
  assert.equal(ledger.get(record.id).quotas[0].limit, 100000);
});

test('ledger rejects duplicate IDs and never exposes provisioning operations', () => {
  assert.throws(() => createFreeTierLedger([record, record]), /duplicate/i);
  const ledger = createFreeTierLedger([record]);
  assert.equal(typeof ledger.provision, 'undefined');
  assert.equal(typeof ledger.createAccount, 'undefined');
});

test('rejects future verification timestamps and oversized records', () => {
  assert.throws(() => validateFreeTierRecord({ ...record, verifiedAt: '2099-01-01T00:00:00.000Z' }, Date.parse('2026-11-15T00:00:00.000Z')));
  assert.throws(() => validateFreeTierRecord({ ...record, allowance: 'x'.repeat(3000) }));
});
test('rejects blank, oversized and control-character text fields', () => {
  for (const patch of [
    { provider: '   ' },
    { service: 'x'.repeat(161) },
    { allowance: 'requests\nwith hidden control character' },
  ]) {
    assert.throws(() => validateFreeTierRecord({ ...record, ...patch }));
  }
});

test('candidate offers are never treated as current verified free tiers', () => {
  assert.equal(isFreeTierRecordCurrent({ ...record, status: 'candidate' }, Date.parse('2026-11-20T00:00:00.000Z')), false);
  assert.equal(isFreeTierRecordCurrent({ ...record, status: 'expired' }, Date.parse('2026-11-20T00:00:00.000Z')), false);
});
