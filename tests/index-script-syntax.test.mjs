import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('the browser application script remains valid JavaScript after UI changes', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const open = '<script>';
  const close = '</script>';
  const start = html.indexOf(open);
  const end = html.indexOf(close, start + open.length);
  assert.notEqual(start, -1, 'expected an inline application script');
  assert.notEqual(end, -1, 'expected a closing script tag');
  assert.equal(html.indexOf(open, start + open.length), -1, 'expected one inline application script');
  assert.doesNotThrow(() => new Function(html.slice(start + open.length, end)));
});
