import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('Forge exposes an explicit manual GitHub metadata invocation through Sentinel', () => {
  for (const id of ['forgeSentinelDiscoverBtn', 'forgeSentinelStatus']) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }
  assert.match(html, /controlApi\('\/api\/sentinel\/github-discover'/);
  assert.match(html, /github:public:/);
});

test('inline browser script remains syntactically valid after adding Sentinel discovery', () => {
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
    .map(match => match[1])
    .filter(source => source.trim());
  scripts.forEach((source, index) => {
    assert.doesNotThrow(() => new vm.Script(source, { filename: 'index.html inline script ' + index }));
  });
});
