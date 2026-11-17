import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('Forge exposes an accessible Guardian Resource intake and catalogue', () => {
  for (const id of [
    'guardianResourceForm', 'guardianResourceName', 'guardianResourceUrl',
    'guardianResourceCategory', 'guardianResourceRevision', 'guardianResourceLicence',
    'guardianResourceLicenceEvidence', 'guardianResourcePricing', 'guardianResourcePricingEvidence',
    'guardianResourceHosting', 'guardianResourceLimitations', 'guardianResourceStatus',
    'guardianResourceList', 'guardianResourceReviewNote',
  ]) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }
  assert.match(html, /id="guardianResourceStatus"[^>]*role="status"[^>]*aria-live="polite"/);
});

test('Guardian Resource UI uses the authenticated owner API and optimistic review concurrency', () => {
  assert.match(html, /controlApi\(['"]\/api\/guardian\/resources['"]/);
  assert.match(html, /method:\s*['"]POST['"]/);
  assert.match(html, /method:\s*['"]PATCH['"]/);
  assert.match(html, /expectedUpdatedAt:\s*resource\.updatedAt/);
  assert.match(html, /status:\s*nextStatus/);
});

test('Guardian Resource cards render source text safely and expose only valid lifecycle actions', () => {
  assert.match(html, /function loadGuardianResources\(/);
  assert.match(html, /heading\.textContent\s*=\s*resource\.name/);
  assert.match(html, /resource\.status === ['"]draft['"]/);
  assert.match(html, /resource\.status === ['"]reviewed['"]/);
  assert.match(html, /resource\.status === ['"]accepted['"]/);
  assert.doesNotMatch(html, /guardianResourceList\.innerHTML/);
});

test('Knowledge Library copy reflects objective-relevant retrieval while preserving untrusted-data boundary', () => {
  assert.match(html, /ranked against each Project Space agent objective/i);
  assert.match(html, /untrusted reference data/i);
});
