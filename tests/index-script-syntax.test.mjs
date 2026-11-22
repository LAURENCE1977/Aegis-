import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('the browser application script remains valid JavaScript after UI changes', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const scripts = [...html.matchAll(/<script>([\\s\\S]*?)<\\/script>/g)];
  assert.equal(scripts.length, 1, 'expected one inline application script');
  assert.doesNotThrow(() => new Function(scripts[0][1]));
});
