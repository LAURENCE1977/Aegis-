import test from 'node:test';
import assert from 'node:assert/strict';
import { listSkills, selectSkills, getSkillGuidance, buildSkillContext, validateSkillManifest } from '../functions/lib/skills.mjs';

test('registry exposes ten AEGIS-native Superpowers adaptations with provenance', () => {
  const skills = listSkills();
  assert.equal(skills.length, 10);
  for (const skill of skills) {
    assert.ok(skill.id);
    assert.ok(skill.name);
    assert.equal(skill.source.repository, 'obra/superpowers');
    assert.equal(skill.source.license, 'MIT');
    assert.match(skill.source.commit, /^[a-f0-9]{40}$/);
    assert.equal(skill.status, 'available');
  }
});

test('skill listing does not expose executable scripts or grant tool permissions', () => {
  for (const skill of listSkills()) {
    assert.deepEqual(skill.permissions, []);
    assert.equal(skill.execution, 'guidance-only');
  }
});

test('selection chooses TDD guidance for implementation prompts', () => {
  const selected = selectSkills('Implement a new API feature and write tests');
  assert.ok(selected.some(skill => skill.id === 'test-driven-development'));
});

test('selection chooses debugging guidance for failures', () => {
  const selected = selectSkills('The deployment is failing with an unexpected error');
  assert.ok(selected.some(skill => skill.id === 'systematic-debugging'));
});

test('selection is bounded and deterministic for unrelated prompts', () => {
  assert.deepEqual(selectSkills('Tell me a joke').map(x => x.id), []);
  assert.ok(selectSkills('build feature, tests, bug, review, plan').length <= 4);
});

test('guidance is available only for registered skill identifiers', () => {
  assert.ok(getSkillGuidance('test-driven-development').includes('RED'));
  assert.equal(getSkillGuidance('../secrets'), null);
});

test('chat skill context contains selected guidance only and grants no tools', () => {
  const context = buildSkillContext('Implement a feature and write tests');
  assert.ok(context.some(skill => skill.id === 'test-driven-development'));
  assert.ok(context.every(skill => typeof skill.guidance === 'string'));
  assert.ok(context.length <= 4);
});

test('skill manifests are versioned, provenance-pinned and guidance-only', () => {
  for (const skill of listSkills()) {
    assert.equal(validateSkillManifest(skill), true);
    assert.equal(skill.schemaVersion, '1.0');
    assert.equal(skill.manifestVersion, '1.0.0');
    assert.equal(skill.execution, 'guidance-only');
    assert.deepEqual(skill.permissions, []);
  }
});

test('skill manifest validator rejects executable authority and broken provenance', () => {
  const skill = listSkills()[0];
  for (const candidate of [
    { ...skill, execution: 'shell' },
    { ...skill, permissions: ['filesystem.write'] },
    { ...skill, schemaVersion: '99.0' },
    { ...skill, source: { ...skill.source, commit: 'latest' } },
    { ...skill, source: { ...skill.source, url: 'http://github.com/obra/superpowers' } },
    { ...skill, unreviewedInstruction: true },
  ]) assert.throws(() => validateSkillManifest(candidate));
});
