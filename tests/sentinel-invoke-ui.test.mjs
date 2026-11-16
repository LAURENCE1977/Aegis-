import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('Security Centre exposes an explicit manual control for the fixed Sentinel read-only invocation', () => {
  for (const id of ['invokeModuleCatalogueBtn', 'sentinelInvokeStatus', 'sentinelInvokeOutput']) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }
  assert.match(html, /controlApi\('\/api\/sentinel\/invoke'/);
  assert.match(html, /aegis-module-catalogue/);
  assert.match(html, /aegis:modules/);
});
