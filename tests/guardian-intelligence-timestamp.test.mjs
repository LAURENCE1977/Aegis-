import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateResourceRecord,
  validateSecurityFinding,
} from '../functions/lib/guardian-intelligence.mjs';

const resource = (checkedAt) => ({
  id: 'timestamp-resource',
  name: 'Timestamp resource',
  canonicalUrl: 'https://example.org/project',
  category: 'developer-tool',
  sourceRevision: 'revision-1',
  licence: { identifier: 'MIT', review: 'review-required', evidenceUrl: null },
  pricing: { model: 'free', limits: [], evidenceUrl: 'https://example.org/pricing', checkedAt },
  hosting: { mode: 'hosted', requirements: [] },
  limitations: [],
});

const finding = (observedAt) => ({
  id: 'timestamp-finding',
  target: { ownerId: 'owner', resourceId: 'resource', scopeDigest: 'sha256:' + 'a'.repeat(64) },
  category: 'configuration-risk',
  severity: 'low',
  confidence: 'medium',
  status: 'suspected',
  method: 'static-analysis',
  authorization: null,
  evidence: [{ kind: 'source-location', reference: 'src/config.mjs', digest: 'sha256:' + 'b'.repeat(64) }],
  summary: 'A configuration requires review.',
  remediation: null,
  observedAt,
});

test('rejects impossible calendar dates in resource pricing timestamps', () => {
  for (const value of [
    '2026-02-29T12:00:00.000Z',
    '2026-04-31T12:00:00.000Z',
    '2026-13-01T12:00:00.000Z',
    '2026-11-31T12:00:00.000Z',
  ]) {
    assert.throws(() => validateResourceRecord(resource(value)), /timestamp/i, value);
  }
});

test('rejects impossible calendar dates in security finding timestamps', () => {
  for (const value of [
    '2026-02-29T12:00:00Z',
    '2026-04-31T12:00:00Z',
    '2026-13-01T12:00:00Z',
    '2026-11-31T12:00:00Z',
  ]) {
    assert.throws(() => validateSecurityFinding(finding(value)), /timestamp/i, value);
  }
});

test('accepts valid leap days and canonical UTC timestamps with or without milliseconds', () => {
  assert.equal(validateResourceRecord(resource('2024-02-29T12:00:00.000Z')), true);
  assert.equal(validateSecurityFinding(finding('2024-02-29T12:00:00Z')), true);
  assert.equal(validateSecurityFinding(finding('2026-11-18T02:00:00.123Z')), true);
});
