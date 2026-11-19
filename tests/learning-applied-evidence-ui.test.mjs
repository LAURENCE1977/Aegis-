import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('Forge exposes a learner-facing path, node and applied-artifact intake workspace', () => {
  assert.match(html, /id="learningPathSelect"/);
  assert.match(html, /id="learningNodeSelect"/);
  assert.match(html, /id="learningEvidenceFile"[^>]*type="file"|type="file"[^>]*id="learningEvidenceFile"/);
  assert.match(html, /id="learningEvidenceForm"/);
  assert.match(html, /id="learningEvidenceList"/);
  assert.match(html, /id="learningEvidenceStatus"/);
});

test('learner UI loads registered paths and lists exact-node digest receipts', () => {
  assert.match(html, /\/api\/learning\/paths\?limit=100/);
  assert.match(html, /\/evidence\?version=/);
  assert.match(html, /\/api\/learning\/paths\/\?limit=100/);
  assert.match(html, /contentRetained/);
  assert.match(html, /masteryVerified/);
});

test('learner UI uploads raw file bytes and withdraws receipts without rendering untrusted HTML', () => {
  assert.match(html, /body:\s*file/);
  assert.match(html, /headers:\s*\{\s*['"]Content-Type['"]:\s*mediaType/);
  assert.match(html, /method:\s*['"]DELETE['"]/);
  assert.match(html, /learningEvidenceList\.append\(entry\)/);
  assert.match(html, /entry\.textContent\s*=/);
  assert.doesNotMatch(html, /learningEvidenceList\.innerHTML/);
});
