import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('Security Centre provides explicit controls for one exact read-only Sentinel capability', () => {
  for (const id of [
    'securityPanel', 'capabilitySummary', 'createModuleGrantBtn',
    'invokeModuleCatalogueBtn', 'securityStatus', 'grantList', 'sentinelOutput',
  ]) assert.match(html, new RegExp('id="' + id + '"'));
  assert.match(html, /capabilityId:\s*'aegis-module-catalogue'/);
  assert.match(html, /actionIds:\s*\['list'\]/);
  assert.match(html, /resourceId:\s*'aegis:modules'/);
  assert.match(html, /input:\s*\{\}/);
  assert.match(html, /securityCall\('\/api\/grants', 'POST'/);
  assert.match(html, /securityCall\('\/api\/sentinel\/invoke', 'POST'/);
});

test('Security Centre does not create grants or invoke Sentinel during page load', () => {
  assert.match(html, /createModuleGrantBtn\.addEventListener\('click', createModuleGrant\)/);
  assert.match(html, /invokeModuleCatalogueBtn\.addEventListener\('click', invokeModuleCatalogue\)/);
  assert.match(html, /loadSecurityCentre\(\);/);
  assert.doesNotMatch(html, /loadSecurityCentre\(\)[\s\S]{0,300}securityCall\('\/api\/grants', 'POST'/);
});

test('grant history and invocation output are rendered as text nodes, not HTML', () => {
  assert.match(html, /grantList\.replaceChildren\(\)/);
  assert.match(html, /title\.textContent\s*=/);
  assert.match(html, /meta\.textContent\s*=/);
  assert.match(html, /sentinelOutput\.textContent\s*=/);
});
