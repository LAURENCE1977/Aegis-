import test from 'node:test';
import assert from 'node:assert/strict';
import { createSentinelDependencies } from '../functions/lib/sentinel-composition.mjs';

const manifest = {
  id: 'aegis-github-public-discovery',
  version: '0.1.0',
  provider: { id: 'aegis-core', kind: 'builtin' },
};

function fakeDb() {
  return {
    prepare(sql) {
      return {
        bind() {
          return {
            first: async () => null,
            all: async () => ({ results: [] }),
            run: async () => ({ meta: { changes: 1 } }),
          };
        },
      };
    },
  };
}

test('requires a D1 database and an explicit fixed adapter registry', () => {
  assert.throws(() => createSentinelDependencies({ adapters: {} }), /database/i);
  assert.throws(() => createSentinelDependencies({ db: fakeDb() }), /adapter/i);
  assert.throws(() => createSentinelDependencies({
    db: fakeDb(),
    adapters: { 'aegis-github-public-discovery:discover': true },
  }), /adapter/i);
  assert.throws(() => createSentinelDependencies({
    db: fakeDb(),
    adapters: { 'made-up-capability:run': async () => null },
  }), /approved, registered capability action/i);
});

test('composes the persistent stores and dispatches only an explicitly registered adapter', async () => {
  let calls = 0;
  const dependencies = createSentinelDependencies({
    db: fakeDb(),
    clock: () => 1_800_000_000_000,
    adapters: {
      'aegis-github-public-discovery:discover': async (input, context) => {
        calls += 1;
        return { repository: input.repository, invocationId: context.invocationId };
      },
    },
  });

  assert.equal(typeof dependencies.loadGrant, 'function');
  assert.equal(typeof dependencies.loadConnection, 'function');
  assert.equal(typeof dependencies.loadApproval, 'function');
  assert.equal(typeof dependencies.consumeApproval, 'function');
  assert.equal(typeof dependencies.recordAudit, 'function');
  assert.equal(typeof dependencies.registryLookup, 'function');

  const output = await dependencies.execute(
    { repository: 'LAURENCE1977/Aegis-' },
    { capabilityId: manifest.id, actionId: 'discover', invocationId: 'inv-1' },
  );
  assert.deepEqual(output, {
    repository: 'LAURENCE1977/Aegis-',
    invocationId: 'inv-1',
  });
  assert.equal(calls, 1);
  await assert.rejects(() => dependencies.execute(
    { repository: 'attacker-controlled' },
    { capabilityId: manifest.id, actionId: 'delete', invocationId: 'inv-2' },
  ), /adapter is not registered/i);
  assert.equal(calls, 1);
});

test('does not derive adapter destinations from capability manifest URLs or paths', async () => {
  let calls = 0;
  let receivedContext;
  const dependencies = createSentinelDependencies({
    db: fakeDb(),
    adapters: {
      'aegis-github-public-discovery:discover': async (_input, context) => { calls += 1; receivedContext = context; return 'fixed'; },
    },
  });
  const result = await dependencies.execute(
    {},
    {
      capabilityId: manifest.id,
      actionId: 'discover',
      endpoint: 'https://attacker.example/collect',
      path: '/attacker-controlled',
    },
  );
  assert.equal(result, 'fixed');
  assert.equal(calls, 1);
  assert.equal(Object.isFrozen(receivedContext), true);
  assert.equal('endpoint' in receivedContext, false);
  assert.equal('path' in receivedContext, false);
  assert.equal('secretRef' in receivedContext, false);
});
