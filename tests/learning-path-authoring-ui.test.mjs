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


test('Learning Forge offers curated local starter paths while retaining the editable JSON workflow', () => {
  assert.match(html, /id="learningPathStarterSelect"/);
  assert.match(html, /id="learningPathLoadStarterBtn"/);
  assert.match(html, /value="javascript-foundations"/);
  assert.match(html, /value="web-safety-foundations"/);
  assert.match(html, /const LEARNING_PATH_STARTER_TEMPLATES/);
  assert.match(html, /learningPathLoadStarterBtn\.addEventListener\(['"]click['"]/);
  assert.match(html, /learningPathGraphJson\.value\s*=\s*JSON\.stringify/);
  assert.match(html, /contentLicenseStatus:\s*['"]link-only['"]/);
  assert.match(html, /not registered until you submit/i);
});

test('starter path loading is local-only and does not bypass the authenticated registration API', () => {
  assert.match(html, /learningPathStarterSelect\.value/);
  assert.match(html, /learningPathAuthorStatus\.textContent/);
  assert.match(html, /controlApi\(['"]\/api\/learning\/paths['"]/);
  assert.doesNotMatch(html, /learningPathAuthorStatus\.innerHTML/);
});

test('Learning Forge provides a guided local authoring path for non-technical users', () => {
  assert.match(html, /id="learningPathGuidedEditor"/);
  assert.match(html, /id="learningPathGuidedId"/);
  assert.match(html, /id="learningPathGuidedVersion"/);
  assert.match(html, /id="learningPathGuidedTitle"/);
  assert.match(html, /id="learningPathGuidedNodeId"/);
  assert.match(html, /id="learningPathGuidedNodeTitle"/);
  assert.match(html, /id="learningPathGuidedOutcomes"/);
  assert.match(html, /id="learningPathGuidedPrerequisites"/);
  assert.match(html, /id="learningPathGuidedSources"/);
  assert.match(html, /id="learningPathGuidedAddNodeBtn"/);
  assert.match(html, /id="learningPathGuidedStatus"/);
});

test('guided Learning Forge authoring builds local JSON drafts without registering or bypassing the owner API', () => {
  assert.match(html, /learningPathGuidedAddNodeBtn\.addEventListener\(['"]click['"]/);
  assert.match(html, /learningPathGuidedSources\.value/);
  assert.match(html, /contentLicenseStatus:\s*['"]link-only['"]/);
  assert.match(html, /learningPathGraphJson\.value\s*=\s*JSON\.stringify/);
  assert.match(html, /controlApi\(['"]\/api\/learning\/paths['"]/);
  assert.match(html, /method:\s*['"]POST['"]/);
  assert.doesNotMatch(html, /learningPathGuidedStatus\.innerHTML/);
});
