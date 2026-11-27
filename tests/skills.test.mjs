import test from 'node:test';
import assert from 'node:assert/strict';
import { listSkills, selectSkills, getSkillGuidance, buildSkillContext } from '../functions/lib/skills.mjs';

test('registry exposes eighteen AEGIS-native skills with pinned provenance', () => {
  const skills = listSkills();
  assert.equal(skills.length, 18);
  const sourceCounts = new Map();
  for (const skill of skills) {
    assert.ok(skill.id);
    assert.ok(skill.name);
    assert.ok(['obra/superpowers', 'addyosmani/agent-skills'].includes(skill.source.repository));
    assert.equal(skill.source.license, 'MIT');
    assert.match(skill.source.commit, /^[a-f0-9]{40}$/);
    assert.equal(skill.status, 'available');
    sourceCounts.set(skill.source.repository, (sourceCounts.get(skill.source.repository) ?? 0) + 1);
  }
  assert.equal(sourceCounts.get('obra/superpowers'), 10);
  assert.equal(sourceCounts.get('addyosmani/agent-skills'), 8);
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

test('selection chooses source-driven guidance for framework implementation', () => {
  const selected = selectSkills('Implement a Cloudflare Workers API using current official documentation');
  assert.ok(selected.some(skill => skill.id === 'source-driven-development'));
});

test('selection chooses mobile UI and accessibility guidance for interface work', () => {
  const selected = selectSkills('Improve the responsive mobile interface and accessibility');
  assert.ok(selected.some(skill => skill.id === 'frontend-ui-engineering'));
  assert.ok(selected.some(skill => skill.id === 'accessibility-engineering'));
});

test('selection chooses security guidance for external integrations', () => {
  const selected = selectSkills('Harden authentication and third-party API integration security');
  assert.ok(selected.some(skill => skill.id === 'security-and-hardening'));
});

test('selection is bounded and deterministic for unrelated prompts', () => {
  assert.deepEqual(selectSkills('Tell me a joke').map(x => x.id), []);
  assert.ok(selectSkills('build feature, tests, bug, review, plan').length <= 4);
});

test('guidance is available only for registered skill identifiers', () => {
  assert.ok(getSkillGuidance('test-driven-development').includes('RED'));
  assert.ok(getSkillGuidance('source-driven-development').includes('official documentation'));
  assert.equal(getSkillGuidance('../secrets'), null);
});

test('chat skill context contains selected guidance only and grants no tools', () => {
  const context = buildSkillContext('Implement a feature and write tests');
  assert.ok(context.some(skill => skill.id === 'test-driven-development'));
  assert.ok(context.every(skill => typeof skill.guidance === 'string'));
  assert.ok(context.length <= 4);
});
