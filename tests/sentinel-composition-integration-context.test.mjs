import test from 'node:test';
import assert from 'node:assert/strict';
import { createSentinelDependencies } from '../functions/lib/sentinel-composition.mjs';

function fakeDb() {
  return {
    prepare() {
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

test('composition exposes the owner-scoped integration inventory loader to Sentinel', () => {
  const dependencies = createSentinelDependencies({
    db: fakeDb(),
    adapters: {
      'aegis-github-public-discovery:discover': async () => ({ ok: true }),
    },
  });

  assert.equal(typeof dependencies.loadIntegrationToolContext, 'function');
});

test('fixed adapters receive integration identity metadata but never credential material', async () => {
  let received;
  const dependencies = createSentinelDependencies({
    db: fakeDb(),
    adapters: {
      'aegis-github-public-discovery:discover': async (_input, context) => {
        received = context;
        return { ok: true };
      },
    },
  });

  await dependencies.execute({}, {
    invocationId: 'integration-context-1',
    principalId: 'owner-1',
    capabilityId: 'aegis-github-public-discovery',
    capabilityVersion: '0.1.0',
    actionId: 'discover',
    resourceId: 'github:public:LAURENCE1977/Aegis-',
    scopes: ['github:public-metadata:read'],
    connectionId: null,
    integrationId: 'composio-github',
    integrationConnectionId: 'integration-connection-1',
    integrationToolSlug: 'GITHUB_GET_REPO',
    inputDigest: 'sha256:' + 'a'.repeat(64),
    secretRef: 'secret://must-not-cross-boundary',
    apiKey: 'must-not-cross-boundary',
  });

  assert.deepEqual(received, {
    invocationId: 'integration-context-1',
    principalId: 'owner-1',
    capabilityId: 'aegis-github-public-discovery',
    capabilityVersion: '0.1.0',
    actionId: 'discover',
    resourceId: 'github:public:LAURENCE1977/Aegis-',
    scopes: ['github:public-metadata:read'],
    connectionId: null,
    integrationId: 'composio-github',
    integrationConnectionId: 'integration-connection-1',
    integrationToolSlug: 'GITHUB_GET_REPO',
    inputDigest: 'sha256:' + 'a'.repeat(64),
  });
  assert.equal(Object.isFrozen(received), true);
  assert.equal(Object.isFrozen(received.scopes), true);
});
