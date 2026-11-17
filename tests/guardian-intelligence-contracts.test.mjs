import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateResourceRecord,
  validateLearningGraph,
  validateSecurityFinding,
} from '../functions/lib/guardian-intelligence.mjs';

const resource = () => ({
  id: 'selfhosted-search',
  name: 'Self-hosted Search',
  canonicalUrl: 'https://github.com/example/search',
  category: 'self-hosted-service',
  sourceRevision: 'a'.repeat(40),
  licence: {
    identifier: 'MIT',
    review: 'review-required',
    evidenceUrl: null,
  },
  pricing: {
    model: 'free',
    limits: [],
    evidenceUrl: 'https://example.org/pricing',
    checkedAt: '2026-11-17T12:00:00.000Z',
  },
  hosting: {
    mode: 'self-hosted',
    requirements: ['Linux host', '2 GB RAM'],
  },
  limitations: ['Requires operator maintenance'],
});

const learningNode = (overrides = {}) => ({
  id: 'javascript-basics',
  title: 'JavaScript basics',
  outcomes: ['Explain variables', 'Write a pure function'],
  prerequisites: [],
  difficulty: 'beginner',
  sourceRefs: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
  contentLicenseStatus: 'link-only',
  ...overrides,
});

const finding = (overrides = {}) => ({
  id: 'unsafe-config-001',
  target: {
    ownerId: 'owner',
    resourceId: 'aegis-test-app',
    scopeDigest: 'sha256:' + 'a'.repeat(64),
  },
  category: 'security-misconfiguration',
  severity: 'medium',
  confidence: 'high',
  status: 'reproduced',
  method: 'dynamic-test',
  authorization: {
    grantId: 'grant-123',
    approvalId: 'approval-123',
    scopeDigest: 'sha256:' + 'a'.repeat(64),
  },
  evidence: [{
    kind: 'tool-output-digest',
    reference: 'runs/run-123/output.json',
    digest: 'sha256:' + 'b'.repeat(64),
  }],
  summary: 'A controlled test reproduced the misconfiguration on the authorised test target.',
  remediation: 'Apply the documented secure configuration and retest.',
  observedAt: '2026-11-17T12:00:00.000Z',
  ...overrides,
});

test('accepts a resource record while keeping unverified licence status explicit', () => {
  assert.equal(validateResourceRecord(resource()), true);
});

test('requires HTTPS provenance and rejects credential-bearing URLs', () => {
  assert.throws(() => validateResourceRecord({
    ...resource(), canonicalUrl: 'https://user:password@example.org/project',
  }), /URL/i);
  assert.throws(() => validateResourceRecord({
    ...resource(), canonicalUrl: 'file:///etc/passwd',
  }), /URL/i);
});

test('verified licence requires an HTTPS licence evidence reference', () => {
  assert.throws(() => validateResourceRecord({
    ...resource(), licence: { identifier: 'MIT', review: 'verified', evidenceUrl: null },
  }), /licence evidence/i);
  assert.equal(validateResourceRecord({
    ...resource(), licence: {
      identifier: 'MIT', review: 'verified',
      evidenceUrl: 'https://github.com/example/search/blob/main/LICENSE',
    },
  }), true);
});

test('free-tier and trial resources require explicit limits and a checked evidence timestamp', () => {
  assert.throws(() => validateResourceRecord({
    ...resource(), pricing: {
      model: 'free-tier', limits: [], evidenceUrl: 'https://example.org/pricing',
      checkedAt: '2026-11-17T12:00:00.000Z',
    },
  }), /limits/i);
  assert.throws(() => validateResourceRecord({
    ...resource(), pricing: {
      model: 'trial', limits: ['14 days'], evidenceUrl: 'https://example.org/pricing',
      checkedAt: 'not-a-date',
    },
  }), /timestamp/i);
});

test('rejects unknown fields in resource records instead of persisting unreviewed data', () => {
  assert.throws(() => validateResourceRecord({ ...resource(), apiKey: 'secret' }), /unexpected/i);
});

test('accepts a valid acyclic learning graph', () => {
  assert.equal(validateLearningGraph([
    learningNode(),
    learningNode({
      id: 'javascript-functions',
      title: 'Functions',
      prerequisites: ['javascript-basics'],
    }),
  ]), true);
});

test('rejects missing prerequisites and duplicate learning node identifiers', () => {
  assert.throws(() => validateLearningGraph([
    learningNode({ prerequisites: ['missing-node'] }),
  ]), /prerequisite/i);
  assert.throws(() => validateLearningGraph([
    learningNode(), learningNode(),
  ]), /duplicate/i);
});

test('rejects cyclic learning prerequisites', () => {
  assert.throws(() => validateLearningGraph([
    learningNode({ id: 'node-a', prerequisites: ['node-b'] }),
    learningNode({ id: 'node-b', prerequisites: ['node-a'] }),
  ]), /cycle/i);
});

test('rejects unsafe or unlicensed source references in learning nodes', () => {
  assert.throws(() => validateLearningGraph([
    learningNode({ sourceRefs: ['javascript:alert(1)'] }),
  ]), /URL/i);
});

test('accepts an evidence-backed security finding bound to an authorised exact scope', () => {
  assert.equal(validateSecurityFinding(finding()), true);
});

test('rejects dynamic security tests without explicit grant and approval lineage', () => {
  assert.throws(() => validateSecurityFinding(finding({ authorization: null })), /authori[sz]ation/i);
});

test('rejects a security-test approval whose scope digest differs from the target', () => {
  assert.throws(() => validateSecurityFinding(finding({
    authorization: {
      grantId: 'grant-123',
      approvalId: 'approval-123',
      scopeDigest: 'sha256:' + 'c'.repeat(64),
    },
  })), /scope/i);
});

test('rejects raw tool output and accepts only bounded evidence references and digests', () => {
  assert.throws(() => validateSecurityFinding(finding({
    evidence: [{
      kind: 'tool-output-digest',
      reference: 'runs/run-123/output.json',
      digest: 'sha256:' + 'b'.repeat(64),
      rawOutput: 'sensitive response body',
    }],
  })), /unexpected/i);
});

test('does not allow a verified finding without reproducible evidence', () => {
  assert.throws(() => validateSecurityFinding(finding({
    status: 'verified',
    evidence: [],
  })), /evidence/i);
});
