import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
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
  assert.equal(audited.length, 2);
  assert.deepEqual(audited.map(item => item.id).sort(), ['companion', 'research']);
  assert.ok(progress.workstreams.filter(item => item.id !== 'companion' && item.id !== 'research')
    .every(item => item.auditStatus === 'pending'));
  assert.match(progress.progressPolicy, /not a measure of total product completion/i);
});

test('the register records verified dashboard and companion lifecycle checkpoints', () => {
  assert.match(progress.latestVerifiedCheckpoint, /44592454361/);
  assert.match(progress.latestVerifiedCheckpoint, /44592511233/);
  assert.match(progress.latestVerifiedCheckpoint, /1,035 passed, 0 failed, 1 skipped/);
  assert.match(progress.latestVerifiedCheckpoint, /44595564920/);
  assert.match(progress.latestVerifiedCheckpoint, /44595869026/);
  assert.match(progress.nextMilestone, /lazily loaded Three\.js\/VRM renderer/i);
  assert.match(progress.workstreams.find(item => item.id === 'companion').summary, /no VRM parser\/runtime is bundled/i);
  assert.match(progress.workstreams.find(item => item.id === 'research').summary, /Composio intake reviewed/i);
});


test('audited workstreams cite concrete implementation and research evidence', () => {
  const companion = progress.workstreams.find(item => item.id === 'companion');
  const research = progress.workstreams.find(item => item.id === 'research');
  assert.match(companion.summary, /docs\/AEGIS_COMPANION\.md/);
  assert.match(companion.summary, /44595869026/);
  assert.match(companion.summary, /imported VRM\/GLB assets are not rendered/i);
  assert.match(research.summary, /docs\/AEGIS_RESEARCH_INTAKE\.md/);
  assert.match(research.summary, /docs\/AEGIS_AGENT_RUNTIME_ECOSYSTEM_2026-11-19\.md/);
  assert.match(research.summary, /docs\/AEGIS_AGENT_CONTROL_AND_CAD_RESEARCH_2026-11-19\.md/);
  assert.match(research.summary, /Phantom.*licence/i);
});
