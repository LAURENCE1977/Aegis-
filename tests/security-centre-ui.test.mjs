import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('Security Centre provides explicit exact-resource grant and Sentinel invocation controls', () => {
  for (const id of [
    'securitySection', 'capabilityList', 'grantForm', 'grantCapabilitySelect',
    'grantActionSelect', 'grantResourceId', 'grantExpiresAt', 'createGrantBtn',
    'grantStatus', 'grantList', 'invokeModuleCatalogueBtn',
    'sentinelInvokeStatus', 'sentinelInvokeOutput',
  ]) assert.match(html, new RegExp('id="' + id + '"'));
  assert.match(html, /controlApi\('\/api\/grants'/);
  assert.match(html, /capabilityId:\s*grantCapabilitySelect\.value/);
  assert.match(html, /actionIds,/);
  assert.match(html, /resourceId:\s*grantResourceId\.value\.trim\(\)/);
  assert.match(html, /expiresAt,/);
  assert.match(html, /controlApi\('\/api\/sentinel\/invoke'/);
  assert.match(html, /capabilityId:\s*'aegis-module-catalogue'/);
  assert.match(html, /actionId:\s*'list'/);
  assert.match(html, /resourceId:\s*'aegis:modules'/);
  assert.match(html, /input:\s*\{\}/);
});

test('Security Centre does not create grants or invoke Sentinel during page load', () => {
  assert.match(html, /grantForm\.addEventListener\('submit'/);
  assert.match(html, /invokeModuleCatalogueBtn\.addEventListener\('click'/);
  assert.match(html, /loadSecurityCentre\(\)/);
  assert.match(html, /loadGrantManager\(\)/);
  assert.doesNotMatch(html, /loadSecurityCentre\(\)[\s\S]{0,300}controlApi\('\/api\/grants',\s*\{\s*method:\s*'POST'/);
});

test('grant history and invocation output are rendered as text nodes, not HTML', () => {
  assert.match(html, /grantList\.replaceChildren\(\)/);
  assert.match(html, /title\.textContent\s*=/);
  assert.match(html, /detail\.textContent\s*=/);
  assert.match(html, /sentinelInvokeOutput\.textContent\s*=/);
});
