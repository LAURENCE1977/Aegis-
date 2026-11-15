import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('mobile AEGIS page has a chat and memory review surface', () => {
  for (const id of [
    'loginPanel','appPanel','chatTab','memoryTab','chatSection','memorySection',
    'memoryForm','memoryKind','memoryContent','saveMemoryBtn','memoryStatus','memoryList',
  ]) {
    assert.match(html, new RegExp('id="' + id + '"'), 'missing UI element: ' + id);
  }
});

test('all inline JavaScript parses before a preview can be promoted', () => {
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  assert.ok(scripts.length > 0, 'expected at least one inline script');
  for (const [, source] of scripts) {
    assert.doesNotThrow(() => new vm.Script(source), 'inline script must parse');
  }
});

test('memory UI uses authenticated API routes and safe text rendering', () => {
  assert.match(html, /fetch\('\/api\/memories'/);
  assert.match(html, /memoryApi\('\?review=1'\)/);
  assert.match(html, /textContent\s*=\s*memory\.content/);
  assert.match(html, /method:\s*'PATCH'/);
  assert.match(html, /\/events/);
});


test('chat UI uses the authenticated AG-UI 1.0 transport rather than the legacy JSON route', () => {
  assert.match(html, /fetch\('\/api\/ag-ui'/);
  assert.match(html, /protocolVersion:\s*'1\.0'/);
  assert.match(html, /TEXT_MESSAGE_CONTENT/);
  assert.match(html, /RUN_FINISHED/);
  assert.doesNotMatch(html, /fetch\('\/api\/ask'/);
});


test('AG-UI frontend parser splits real SSE frame boundaries', () => {
  assert.match(html, /body\.split\(\/\\r\?\\n\\r\?\\n\/\)/);
  assert.match(html, /frame\.split\(\/\\r\?\\n\/\)/);
});
