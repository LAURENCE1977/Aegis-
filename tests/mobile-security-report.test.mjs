import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMobileSecurityReport } from '../functions/lib/mobile-security-report.mjs';

const digest = 'a'.repeat(64);
const report = (overrides = {}) => ({
  tool: 'mobsf',
  toolVersion: '4.6.4',
  artifact: { sha256: digest, platform: 'android', packageId: 'org.example.app' },
  generatedAt: '2026-11-17T12:00:00.000Z',
  findings: [{
    ruleId: 'ANDROID_EXPORTED_COMPONENT',
    title: 'Exported component requires review',
    severity: 'high',
    confidence: 0.92,
    component: 'MainActivity',
    location: { path: 'AndroidManifest.xml', line: 24 },
    evidenceDigest: 'b'.repeat(64),
    remediation: 'Review the component export and permission configuration.',
  }],
  ...overrides,
});

test('normalizes a static mobile security report into untrusted evidence findings', () => {
  const normalized = normalizeMobileSecurityReport(report());
  assert.equal(normalized.artifact.sha256, digest);
  assert.equal(normalized.analysisMode, 'static');
  assert.equal(normalized.findings[0].status, 'unreviewed');
  assert.equal(normalized.findings[0].severity, 'high');
  assert.equal(normalized.findings[0].evidence.digest, 'b'.repeat(64));
  assert.equal(normalized.findings[0].location.line, 24);
  assert.equal(normalized.authority, 'none');
  assert.equal(normalized.execution, 'none');
});

test('rejects dynamic mode, unsupported platforms and malformed artifact digests', () => {
  assert.throws(() => normalizeMobileSecurityReport(report({ analysisMode: 'dynamic' })), /report fields/);
  assert.throws(() => normalizeMobileSecurityReport(report({
    artifact: { sha256: digest, platform: 'linux', packageId: 'org.example.app' },
  })), /artifact/);
  assert.throws(() => normalizeMobileSecurityReport(report({
    artifact: { sha256: 'bad', platform: 'android', packageId: 'org.example.app' },
  })), /artifact/);
});

test('rejects unknown finding fields, unsafe evidence paths and invalid confidence', () => {
  const extra = report();
  extra.findings[0].execute = true;
  assert.throws(() => normalizeMobileSecurityReport(extra), /finding/);

  const traversal = report();
  traversal.findings[0].location.path = '../secrets.txt';
  assert.throws(() => normalizeMobileSecurityReport(traversal), /location/);

  const confidence = report();
  confidence.findings[0].confidence = 1.5;
  assert.throws(() => normalizeMobileSecurityReport(confidence), /finding/);
});

test('bounds report size and finding count and never accepts tool-directed actions', () => {
  const tooMany = report({ findings: Array.from({ length: 5001 }, (_, index) => ({
    ruleId: 'RULE_' + index, title: 'Finding', severity: 'low', confidence: 0.5,
    evidenceDigest: digest, remediation: 'Review manually.',
  })) });
  assert.throws(() => normalizeMobileSecurityReport(tooMany), /finding count/);

  const action = report();
  action.findings[0].action = 'delete-file';
  assert.throws(() => normalizeMobileSecurityReport(action), /finding/);
});
