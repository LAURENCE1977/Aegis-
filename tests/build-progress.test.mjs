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
  assert.ok(progress.workstreams.every(item => item.auditStatus === 'pending'));
  assert.match(progress.progressPolicy, /not a measure of total product completion/i);
});

test('the register records the latest verified implementation checkpoint and honest next milestone', () => {
  assert.match(progress.latestVerifiedCheckpoint, /44589027079/);
  assert.match(progress.latestVerifiedCheckpoint, /1,035 passed, 0 failed, 1 skipped/);
  assert.match(progress.nextMilestone, /capability baseline audit/i);
  assert.match(progress.workstreams.find(item => item.id === 'companion').summary, /remain incomplete/i);
});
