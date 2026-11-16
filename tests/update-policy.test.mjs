import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateUpdateManifest,
  classifyUpdateRisk,
  canAutoApplyUpdate,
} from '../functions/lib/update-policy.mjs';

const validManifest = {
  schemaVersion: 1,
  product: 'aegis',
  version: '1.2.3',
  channel: 'stable',
  releasedAt: '2026-11-16T12:00:00.000Z',
  minimumVersion: '1.0.0',
  artifacts: [{
    platform: 'web',
    url: 'https://updates.example.org/aegis/1.2.3/web.tar.gz',
    sha256: 'a'.repeat(64),
  }],
  changes: [{ type: 'bugfix', summary: 'Fix a scheduling defect.' }],
  requiresMigration: false,
  permissionsChanged: false,
  securityUpdate: false,
};

test('accepts a well-formed stable release manifest', () => {
  assert.deepEqual(validateUpdateManifest(validManifest), { valid: true, errors: [] });
});

test('rejects non-HTTPS artifacts and invalid integrity digests', () => {
  const manifest = structuredClone(validManifest);
  manifest.artifacts[0].url = 'http://updates.example.org/aegis.tar.gz';
  manifest.artifacts[0].sha256 = 'not-a-digest';
  const result = validateUpdateManifest(manifest);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('HTTPS')));
  assert.ok(result.errors.some((error) => error.includes('SHA-256')));
});

test('rejects unknown channels, malformed versions and empty release notes', () => {
  const manifest = structuredClone(validManifest);
  manifest.channel = 'secret';
  manifest.version = 'latest';
  manifest.changes = [];
  const result = validateUpdateManifest(manifest);
  assert.equal(result.valid, false);
  assert.ok(result.errors.length >= 3);
});

test('classifies security, permission and migration changes as high risk', () => {
  assert.equal(classifyUpdateRisk({ securityUpdate: true }), 'high');
  assert.equal(classifyUpdateRisk({ permissionsChanged: true }), 'high');
  assert.equal(classifyUpdateRisk({ requiresMigration: true }), 'high');
  assert.equal(classifyUpdateRisk({ securityUpdate: false, permissionsChanged: false, requiresMigration: false }), 'low');
});

test('only low-risk stable patch releases may be automatically applied', () => {
  const lowRisk = { ...validManifest, version: '1.2.4' };
  assert.equal(canAutoApplyUpdate(lowRisk, '1.2.3'), true);
  assert.equal(canAutoApplyUpdate({ ...lowRisk, channel: 'beta' }, '1.2.3'), false);
  assert.equal(canAutoApplyUpdate({ ...lowRisk, securityUpdate: true }, '1.2.3'), false);
  assert.equal(canAutoApplyUpdate({ ...lowRisk, version: '1.3.0' }, '1.2.3'), false);
  assert.equal(canAutoApplyUpdate({ ...lowRisk, version: '2.0.0' }, '1.2.3'), false);
});

test('does not auto-apply downgrades or updates outside the patch line', () => {
  assert.equal(canAutoApplyUpdate({ ...validManifest, version: '1.2.2' }, '1.2.3'), false);
  assert.equal(canAutoApplyUpdate({ ...validManifest, version: '1.3.0' }, '1.2.3'), false);
});
