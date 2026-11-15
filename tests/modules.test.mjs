import test from 'node:test';
import assert from 'node:assert/strict';
import {
  listModules,
  getModule,
  hasCapability,
  isCapabilityAllowed,
  validateModule,
} from '../functions/lib/modules.mjs';

test('module registry exposes unique stable identifiers', () => {
  const modules = listModules();
  const ids = modules.map((module) => module.id);
  assert.ok(modules.length > 0);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^[a-z][a-z0-9-]{1,63}$/);
});

test('registered modules declare valid status and metadata', () => {
  for (const module of listModules()) {
    assert.ok(['available', 'planned'].includes(module.status));
    assert.equal(typeof module.name, 'string');
    assert.ok(module.name.length > 0);
    assert.ok(Array.isArray(module.capabilities));
  }
});

test('registry returns defensive copies rather than mutable internal state', () => {
  const modules = listModules();
  modules[0].name = 'tampered';
  assert.notEqual(listModules()[0].name, 'tampered');
});

test('unknown module identifiers are not resolved', () => {
  assert.equal(getModule('../secrets'), null);
  assert.equal(getModule('not-registered'), null);
});

test('capability declarations are discoverable but grant no permissions', () => {
  const modules = listModules();
  assert.ok(modules.some((module) => module.capabilities.length > 0));
  for (const module of modules) {
    assert.deepEqual(module.permissions, []);
    for (const capability of module.capabilities) {
      assert.equal(hasCapability(module.id, capability), true);
      assert.equal(isCapabilityAllowed(module.id, capability), false);
    }
  }
});

test('unknown capabilities are denied even for registered modules', () => {
  const first = listModules()[0];
  assert.equal(hasCapability(first.id, 'secrets.read'), false);
  assert.equal(isCapabilityAllowed(first.id, 'secrets.read'), false);
  assert.equal(isCapabilityAllowed('unknown-module', 'chat.read'), false);
});

test('module metadata rejects unsafe identifiers, duplicate capabilities and permissions', () => {
  assert.throws(() => validateModule({ id: '../escape', name: 'Bad', status: 'planned', capabilities: [], permissions: [] }));
  assert.throws(() => validateModule({ id: 'bad-module', name: 'Bad', status: 'running', capabilities: [], permissions: [] }));
  assert.throws(() => validateModule({ id: 'bad-module', name: 'Bad', status: 'planned', capabilities: ['chat.read', 'chat.read'], permissions: [] }));
  assert.throws(() => validateModule({ id: 'bad-module', name: 'Bad', status: 'planned', capabilities: [], permissions: ['secrets.read'] }));
});
