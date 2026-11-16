import test from 'node:test';
import assert from 'node:assert/strict';
import { createBuiltinAdapterRegistry } from '../functions/lib/sentinel-adapters.mjs';

test('exposes the local module catalogue as a read-only built-in adapter', async () => {
  const adapters = createBuiltinAdapterRegistry();
  const handler = adapters['aegis-module-catalogue:list'];
  assert.equal(typeof handler, 'function');

  const result = await handler({}, {
    capabilityId: 'aegis-module-catalogue',
    actionId: 'list',
  });
  assert.equal(result.total, result.modules.length);
  assert.ok(result.modules.length > 0);
  assert.ok(result.modules.every((module) => Array.isArray(module.permissions) && module.permissions.length === 0));
  assert.ok(result.modules.every((module) => module.status === 'planned' || module.status === 'available'));
});

test('rejects unexpected input rather than treating it as a command', async () => {
  const adapters = createBuiltinAdapterRegistry();
  await assert.rejects(() => adapters['aegis-module-catalogue:list']({
    command: 'run-shell',
  }, {}), /does not accept input/i);
});
