import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const serviceWorker = await readFile(new URL('../service-worker.js', import.meta.url), 'utf8');
const manifest = JSON.parse(await readFile(new URL('../manifest.webmanifest', import.meta.url), 'utf8'));
const platformStrategy = await readFile(new URL('../docs/PLATFORM_COMPATIBILITY.md', import.meta.url), 'utf8');
const progress = JSON.parse(await readFile(new URL('../build-progress.json', import.meta.url), 'utf8'));

test('build progress is reachable from the signed-in AEGIS navigation', () => {
  assert.match(html, /id="buildProgressTab"[^>]*>Build progress<\/button>/);
  assert.match(html, /id="buildProgressSection"/);
  assert.match(html, /buildProgressSection\.hidden = panel !== 'buildProgress'/);
  assert.match(html, /buildProgressTab\.addEventListener\('click', \(\) => showPanel\('buildProgress'\)\)/);
});

test('build progress loads a versioned canonical register without trusting HTML from it', () => {
  assert.match(html, /fetch\('\/build-progress\.json', \{ cache: 'no-store' \}\)/);
  assert.match(html, /data\.schema !== 'aegis\.build-progress\/1\.0'/);
  assert.match(html, /detail\.textContent = item\.summary/);
  assert.doesNotMatch(html, /departments\.innerHTML\s*=/);
});

test('overall completion stays unpublished until every workstream has an audited baseline', () => {
  assert.equal(progress.schema, 'aegis.build-progress/1.0');
  assert.equal(progress.overallCompletion, null);
  assert.equal(progress.workstreams.length, 6);
  const audited = progress.workstreams.filter(item => item.auditStatus === 'audited');
  assert.equal(audited.length, 5);
  assert.deepEqual(audited.map(item => item.id).sort(), ['companion', 'engineering', 'platform', 'research', 'security']);
  assert.ok(progress.workstreams.filter(item => !['companion', 'engineering', 'platform', 'research', 'security'].includes(item.id))
    .every(item => item.auditStatus === 'pending'));
  assert.match(progress.progressPolicy, /not a measure of total product completion/i);
});

test('the register records verified dashboard and companion lifecycle checkpoints', () => {
  assert.match(progress.latestVerifiedCheckpoint, /44595869026/);
  assert.match(progress.latestVerifiedCheckpoint, /44595887588/);
  assert.match(progress.latestVerifiedCheckpoint, /1,047 passed, 0 failed, 1 skipped/);
  assert.match(progress.latestVerifiedCheckpoint, /44595564920/);
  assert.match(progress.latestVerifiedCheckpoint, /44595869026/);
  assert.match(progress.nextMilestone, /lazily loaded Three\.js\/VRM renderer/i);
  assert.match(progress.workstreams.find(item => item.id === 'companion').summary, /no imported VRM\/GLB\/VRMA is rendered/i);
  assert.match(progress.workstreams.find(item => item.id === 'research').summary, /narrow Composio GitHub read-only tools/i);
});


test('audited workstreams cite concrete implementation and research evidence', () => {
  const companion = progress.workstreams.find(item => item.id === 'companion');
  const research = progress.workstreams.find(item => item.id === 'research');
  assert.match(companion.summary, /docs\/AEGIS_COMPANION\.md/);
  assert.match(companion.summary, /44595869026/);
  assert.match(companion.summary, /no imported VRM\/GLB\/VRMA is rendered/i);
  assert.match(research.summary, /docs\/AEGIS_RESEARCH_INTAKE\.md/);
  assert.match(research.summary, /docs\/AEGIS_AGENT_RUNTIME_ECOSYSTEM_2026-11-19\.md/);
  assert.match(research.summary, /docs\/AEGIS_AGENT_CONTROL_AND_CAD_RESEARCH_2026-11-19\.md/);
  assert.match(research.summary, /Phantom.*licence/i);
});


test('security audit distinguishes implemented primitives from a deployed security service', () => {
  const security = progress.workstreams.find(item => item.id === 'security');
  assert.match(security.summary, /functions\/lib\/sentinel\.mjs/);
  assert.match(security.summary, /functions\/lib\/secret-vault\.mjs/);
  assert.match(security.summary, /AES-GCM/);
  assert.match(security.summary, /human-always/i);
  assert.match(security.summary, /D1 is not provisioned/i);
  assert.match(security.summary, /post-execution audit can fail/i);
});


test('engineering audit keeps agent plans separate from executable authority', () => {
  const engineering = progress.workstreams.find(item => item.id === 'engineering');
  assert.match(engineering.summary, /docs\/AEGIS_AGENT_ORCHESTRATION\.md/);
  assert.match(engineering.summary, /execution: plan-only/);
  assert.match(engineering.summary, /AGENT_RUNS_ENABLED/);
  assert.match(engineering.summary, /functions\/lib\/agent-tools\.mjs/);
  assert.match(engineering.summary, /four fixed read-only tools/i);
  assert.match(engineering.summary, /no shell, filesystem, browser or arbitrary MCP execution/i);
  assert.match(engineering.summary, /OpenAI-compatible endpoint adapter remains planned/i);
});


test('platform audit distinguishes a responsive PWA shell from certified native support', () => {
  const platform = progress.workstreams.find(item => item.id === 'platform');
  assert.match(platform.summary, /docs\/PLATFORM_COMPATIBILITY\.md/);
  assert.match(platform.summary, /manifest\.webmanifest/);
  assert.match(platform.summary, /service-worker\.js/);
  assert.match(platform.summary, /API, login and MCP responses are not cached/i);
  assert.match(platform.summary, /real-device validation remains outstanding/i);
  assert.equal(manifest.display, 'standalone');
  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /@media \(max-width: 820px\)/);
  assert.match(serviceWorker, /url\.pathname\.startsWith\('\/api\/'\)/);
  assert.match(serviceWorker, /url\.pathname === '\/mcp'/);
  assert.match(platformStrategy, /not a support certification/i);
});
