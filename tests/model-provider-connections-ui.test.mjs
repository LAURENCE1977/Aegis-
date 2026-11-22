import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('provider connection panel is reachable from the AEGIS control centre', () => {
  assert.match(html, /id="providerTab"/);
  assert.match(html, /id="providerSection"/);
  assert.match(html, /providerSection\.hidden = panel !== 'providers'/);
  assert.match(html, /if \(panel === 'providers'\) loadProviderConnections\(\)/);
});

test('provider API key entry is a password field and is not persisted in browser storage', () => {
  assert.match(html, /id="providerApiKey"[^>]*type="password"/);
  assert.match(html, /id="providerApiKey"[^>]*autocomplete="off"/);
  assert.match(html, /providerApiKey\.value = ''/);
  assert.doesNotMatch(html, /localStorage\.(?:setItem|getItem)\([^\n]*providerApiKey/);
});

test('provider connection UI uses the authenticated server API and displays vault-only status', () => {
  assert.match(html, /\/api\/model-provider-connections/);
  assert.match(html, /vault_only/);
  assert.match(html, /not yet connected to live model inference/i);
});
