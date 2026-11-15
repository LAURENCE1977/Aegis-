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
  assert.match(html, /const match = \/\\r\?\\n\\r\?\\n\/\.exec\(buffer\)/);
  assert.match(html, /frame\.split\(\/\\r\?\\n\/\)/);
});


test('chat UI consumes AG-UI SSE incrementally and appends deltas as they arrive', () => {
  assert.match(html, /response\.body\.getReader\(\)/);
  assert.match(html, /onDelta\(event\.delta\)/);
  assert.match(html, /assistantText\.textContent\s*\+=\s*delta/);
});


test('Control Centre exposes Project Spaces and owner approval inbox surfaces', () => {
  for (const id of [
    'workspaceTab','approvalTab','workspaceSection','approvalSection',
    'workspaceForm','workspaceName','workspaceDescription','workspaceList',
    'workspaceStatus','approvalList','approvalStatus',
  ]) {
    assert.match(html, new RegExp('id="' + id + '"'), 'missing Control Centre element: ' + id);
  }
  assert.match(html, /controlApi\('\/api\/workspaces'/);
  assert.match(html, /controlApi\('\/api\/approvals'/);
  assert.match(html, /method:\s*'POST'/);
  assert.match(html, /method:\s*'POST'/);
});

test('Project Space and approval views render untrusted data as text, not HTML', () => {
  assert.match(html, /nameNode\.textContent\s*=\s*workspace\.name/);
  assert.match(html, /title\.textContent\s*=\s*approval\.operationSummary/);
  assert.doesNotMatch(html, /workspace\.name\s*\+\s*['"]</);
});


test('mobile AEGIS shell is installable as a privacy-safe PWA', () => {
  assert.match(html, /rel="manifest" href="\/manifest\.webmanifest"/);
  assert.match(html, /navigator\.serviceWorker\.register\('\/service-worker\.js'/);
  assert.match(html, /apple-mobile-web-app-capable/);
  const manifest = JSON.parse(readFileSync(new URL('../manifest.webmanifest', import.meta.url), 'utf8'));
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.icons.some(icon => icon.src === '/icons/aegis.svg'));
});

test('service worker never caches authenticated API or MCP traffic', () => {
  const worker = readFileSync(new URL('../service-worker.js', import.meta.url), 'utf8');
  assert.doesNotThrow(() => new vm.Script(worker));
  assert.match(worker, /url\.pathname\.startsWith\('\/api\/'\)/);
  assert.match(worker, /url\.pathname\s*===\s*'\/mcp'/);
  assert.match(worker, /request\.method\s*!==\s*'GET'/);
  assert.match(worker, /caches\.open\(SHELL_CACHE\)/);
});
