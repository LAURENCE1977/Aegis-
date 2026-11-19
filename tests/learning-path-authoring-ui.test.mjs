import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('Learning Forge exposes a bounded path registration form with editable graph JSON', () => {
  assert.match(html, /id="learningPathForm"/);
  assert.match(html, /id="learningPathGraphJson"/);
  assert.match(html, /id="learningPathRegisterBtn"/);
  assert.match(html, /id="learningPathAuthorStatus"/);
  assert.match(html, /contentLicenseStatus/);
  assert.match(html, /sourceRefs/);
});

test('path authoring parses JSON locally and registers only through the authenticated Learning Forge API', () => {
  assert.match(html, /JSON\.parse\(learningPathGraphJson\.value\)/);
  assert.match(html, /controlApi\(['"]\/api\/learning\/paths['"]/);
  assert.match(html, /method:\s*['"]POST['"]/);
  assert.match(html, /body:\s*JSON\.stringify\(pathDefinition\)/);
  assert.match(html, /await loadLearningPaths\(\)/);
  assert.doesNotMatch(html, /learningPathAuthorStatus\.innerHTML/);
});
