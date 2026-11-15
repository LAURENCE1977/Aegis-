import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('mobile AEGIS page has a chat and memory review surface', () => {
  for (const id of [
    'loginPanel','appPanel','chatTab','memoryTab','chatSection','memorySection',
    'memoryForm','memoryKind','memoryContent','saveMemoryBtn','memoryStatus','memoryList','exportMemoriesBtn',
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
  assert.match(html, /memoryApi\('\?review=1/);
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



test('chat UI reads AG-UI RUN_ERROR frames returned before a run stream begins', () => {
  assert.match(html, /content-type'\) \|\| ''\)\.includes\('text\/event-stream'\)/);
  assert.match(html, /await readAgUiReply\(res\)/);
});


test('AG-UI frontend rejects streams whose first event is not RUN_STARTED or RUN_ERROR', () => {
  assert.match(html, /let firstEvent = true/);
  assert.match(html, /firstEvent && event\.type !== 'RUN_STARTED' && event\.type !== 'RUN_ERROR'/);
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
    'workspaceStatus','approvalList','approvalStatus','chatProjectSelect',
  ]) {
    assert.match(html, new RegExp('id="' + id + '"'), 'missing Control Centre element: ' + id);
  }
  assert.match(html, /controlApi\('\/api\/workspaces'/);
  assert.match(html, /controlApi\('\/api\/approvals'/);
  assert.match(html, /method:\s*'POST'/);
  assert.match(html, /method:\s*'POST'/);
});


test('Project Space cards expose a bounded handover brief that can be copied by the owner', () => {
  assert.match(html, /Build handover brief/);
  assert.match(html, /\/api\/workspaces\/.*\/brief/);
  assert.match(html, /navigator\.clipboard\.writeText/);
  assert.match(html, /briefOutput\.value\s*=\s*JSON\.stringify/);
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


test('chat sends only the explicitly selected Project Space context', () => {
  assert.match(html, /projectId:\s*chatProjectSelect\.value\s*\|\|\s*undefined/);
  assert.match(html, /loadChatProjects\(\)/);
  assert.match(html, /option\.value\s*=\s*workspace\.id/);
});


test('chat and memory controls expose the selected Project Space scope end to end', () => {
  assert.equal((html.match(/id="chatProjectSelect"/g) || []).length, 1);
  assert.match(html, /id="memoryProjectSelect"/);
  assert.match(html, /projectId:\s*chatProjectSelect\.value\s*\|\|\s*undefined/);
  assert.match(html, /projectId:\s*memoryProjectSelect\.value\s*\|\|\s*undefined/);
  assert.match(html, /projectId:\s*memory\.projectId\s*\|\|\s*null/);
  assert.match(html, /memoryProjectSelect\.addEventListener\('change',\s*loadMemories\)/);
  assert.match(html, /memoryApi\('\?review=1&projectId='\s*\+\s*encodeURIComponent\(memoryProjectSelect\.value\)\)/);
  assert.match(html, /encodeURIComponent\(memory\.projectId\)/);
});


test('memory review UI offers an authenticated no-store JSON export', () => {
  assert.match(html, /id="exportMemoriesBtn"/);
  assert.match(html, /fetch\('\/api\/memories\/export/);
  assert.match(html, /URL\.createObjectURL\(await response\.blob\(\)\)/);
  assert.match(html, /download\s*=\s*'aegis-memory-export\.json'/);
});


test('Forge Control Centre provides safe read-only repository inspection and source reading', () => {
  for (const id of ['forgeTab','forgeSection','forgeForm','forgeSourceUrl','forgeStatus','forgeFileList','forgeFilePreview','forgeCandidateList']) {
    assert.match(html, new RegExp('id="' + id + '"'), 'missing Forge UI element: ' + id);
  }
  assert.match(html, /controlApi\('\/api\/forge\/inspect'/);
  assert.match(html, /controlApi\('\/api\/forge\/read'/);
  assert.match(html, /controlApi\('\/api\/forge\/candidates'/);
  assert.match(html, /candidateNode\.textContent\s*=\s*candidate\.metadata\.fullName/);
  assert.match(html, /reviewSummary\.textContent\s*=\s*'Latest owner review: '\s*\+/);
  assert.match(html, /forgeFilePreview\.textContent\s*=\s*data\.content/);
  assert.match(html, /Nothing is executed|Nothing is run/);
});


test('Forge candidate review UI requires an explicit licence decision and records an owner review', () => {
  assert.match(html, /controlApi\('\/api\/forge\/candidates\/'\s*\+/);
  assert.match(html, /licenceReview:\s*licenceSelect\.value/);
  assert.match(html, /licenceConfirmed\.checked/);
  assert.match(html, /licenceEvidenceUrl\.value\.trim\(\)/);
  assert.match(html, /reviewNote\.value\.trim\(\)/);
  assert.match(html, /expectedUpdatedAt:\s*candidate\.updatedAt/);
  assert.match(html, /licenceAttested:\s*licenceConfirmed\.checked/);
  assert.match(html, /licenceSelect\.value\s*!==\s*'verified'\)\s*licenceConfirmed\.checked\s*=\s*false/);
  assert.match(html, /candidateReviewForm\.addEventListener\('submit'/);
});


test('Forge candidate review UI requires an explicit owner licence decision', () => {
  assert.match(html, /candidateReviewForm/);
  assert.match(html, /candidate\.licence\.review/);
  assert.match(html, /method:\s*'PATCH'/);
  assert.match(html, /licenceReview/);
  assert.match(html, /review-required/);
  assert.match(html, /Choose an engineering decision before approval/);
});


test('Forge candidate review UI exposes owner audit history without rendering HTML', () => {
  assert.match(html, /controlApi\('\/api\/forge\/candidates\/'\s*\+\s*encodeURIComponent\(candidate\.id\)\s*\+\s*'\/events'/);
  assert.match(html, /candidate-history/);
  assert.match(html, /entry\.textContent\s*=/);
});


test('Forge candidate cards expose their append-only audit history', () => {
  assert.match(html, /controlApi\('\/api\/forge\/candidates\/'\s*\+\s*encodeURIComponent\(candidate\.id\)\s*\+\s*'\/events'/);
  assert.match(html, /history\.textContent\s*=\s*error\.message/);
});


test('memory review UI requires explicit confirmation before permanent deletion', () => {
  assert.match(html, /memoryButton\('Delete permanently'/);
  assert.match(html, /confirm\('Permanently delete this memory/);
  assert.match(html, /method:\s*'DELETE'/);
  assert.match(html, /confirm:\s*true/);
});

test('Project Space timeline renders memory lifecycle events from the merged event feed', () => {
  assert.match(html, /controlApi\('\/api\/workspaces\/' \+ encodeURIComponent\(id\) \+ '\/events'/);
  assert.match(html, /timelineData\.events/);
  assert.match(html, /event\.source\s*===\s*'memory'/);
  assert.match(html, /event\.occurredAt\s*\|\|\s*event\.createdAt/);
});

test('Security Centre exposes read-only capability and module inventory without granting permissions', () => {
  for (const id of ['securityTab','securitySection','securityStatus','moduleList','capabilityList']) {
    assert.match(html, new RegExp('id="' + id + '"'), 'missing Security Centre element: ' + id);
  }
  assert.match(html, /controlApi\('\/api\/modules'/);
  assert.match(html, /controlApi\('\/api\/capabilities'/);
  assert.match(html, /capabilityNode\.textContent\s*=\s*capability\.name/);
  assert.match(html, /moduleNode\.textContent\s*=\s*module\.name/);
  assert.match(html, /No grants are created by this inventory/);
});
