import test from 'node:test';
import assert from 'node:assert/strict';
import { createSentinelDependencies } from '../functions/lib/sentinel-composition.mjs';
import { createBuiltinAdapterRegistry } from '../functions/lib/sentinel-adapters.mjs';
import { getCapabilityManifest } from '../functions/lib/capability-registry.mjs';
import { runSentinelInvocation } from '../functions/lib/sentinel.mjs';

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
            first: async () => sql.includes('INSERT INTO capability_invocation_limits') ? { request_count: 1 } : null,
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
  assert.equal(typeof dependencies.reserveRateLimit, 'function');
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
      grantId: 'grant-01',
      approvalId: 'approval-01',
      taskId: 'task-01',
      sessionId: 'session-01',
      parentSessionId: 'session-parent',
      workerId: 'worker-01',
    },
  );
  assert.equal(result, 'fixed');
  assert.equal(calls, 1);
  assert.equal(Object.isFrozen(receivedContext), true);
  assert.equal('endpoint' in receivedContext, false);
  assert.equal('path' in receivedContext, false);
  assert.equal('secretRef' in receivedContext, false);
  assert.equal(receivedContext.grantId, 'grant-01');
  assert.equal(receivedContext.approvalId, 'approval-01');
  assert.equal(receivedContext.taskId, 'task-01');
  assert.equal(receivedContext.sessionId, 'session-01');
  assert.equal(receivedContext.parentSessionId, 'session-parent');
  assert.equal(receivedContext.workerId, 'worker-01');
});
test('composes the built-in module catalogue through the trusted Sentinel adapter registry', async () => {
  const dependencies = createSentinelDependencies({
    db: fakeDb(),
    adapters: createBuiltinAdapterRegistry(),
  });
  const result = await dependencies.execute({}, {
    capabilityId: 'aegis-module-catalogue',
    actionId: 'list',
    invocationId: 'catalogue-1',
    principalId: 'owner',
    capabilityVersion: '0.1.0',
    resourceId: 'aegis:modules',
    scopes: ['aegis:module-catalogue:read'],
    inputDigest: 'sha256:' + 'a'.repeat(64),
    connectionId: null,
  });
  assert.equal(result.total, result.modules.length);
  assert.ok(result.modules.some((module) => module.id === 'forge'));
});
test('runs the read-only module catalogue end-to-end through real policy and D1 store adapters', async () => {
  const now = Date.parse('2026-11-16T02:00:00Z');
  const manifest = getCapabilityManifest('aegis-module-catalogue');
  const auditRows = [];
  const grantRow = {
    id: 'grant-1',
    principal_id: 'owner',
    capability_id: manifest.id,
    capability_version: manifest.version,
    resource_id: 'aegis:modules',
    scopes_json: JSON.stringify(['aegis:module-catalogue:read']),
    status: 'active',
    created_by: 'owner',
    created_at: new Date(now - 1000).toISOString(),
    expires_at: new Date(now + 60_000).toISOString(),
    revoked_at: null,
  };
  const db = {
    prepare(sql) {
      return {
        bind(...values) {
          return {
            first: async () => {
              if (sql.includes('FROM capability_grants')) return grantRow;
              if (sql.includes('INSERT INTO capability_invocation_limits')) return { request_count: 1 };
              return null;
            },
            all: async () => ({ results: [] }),
            run: async () => {
              if (sql.includes('INSERT INTO capability_invocation_audit')) {
                auditRows.push(values);
              }
              return { meta: { changes: 1 } };
            },
          };
        },
      };
    },
  };
  const dependencies = createSentinelDependencies({
    db,
    clock: () => now,
    adapters: createBuiltinAdapterRegistry(),
  });
  const result = await runSentinelInvocation({
    invocationId: 'module-list-1',
    principalId: 'owner',
    manifest,
    actionId: 'list',
    resourceId: 'aegis:modules',
    inputDigest: 'sha256:' + 'b'.repeat(64),
    input: {},
    now,
  }, dependencies);

  assert.equal(result.allowed, true);
  assert.equal(result.reasonCode, 'SUCCESS');
  assert.ok(result.output.modules.some((module) => module.id === 'forge'));
  assert.equal(auditRows.length, 3);
});
