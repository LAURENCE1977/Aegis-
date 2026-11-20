import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareCodeModeRun, CODE_MODE_LIMITS } from '../functions/lib/code-mode-contract.mjs';

function syntheticManifest(overrides = {}) {
  return {
    id: 'synthetic-read',
    version: '1.0.0',
    status: 'approved',
    provider: { id: 'aegis-core', kind: 'builtin' },
    interface: { kind: 'internal', method: 'GET', path: '/synthetic/read' },
    actions: [{
      id: 'read',
      capability: 'synthetic.read',
      effect: 'read',
      risk: 'low',
      approval: 'none',
      requiredScopes: ['synthetic:data:read'],
    }],
    data: { classification: 'internal', reads: ['synthetic fixture'], writes: [] },
    network: { egressHosts: [] },
    ...overrides,
  };
}

function request(overrides = {}) {
  return {
    enabled: true,
    runId: 'run_123',
    code: 'const result = await aegis.synthetic_read({}); return result;',
    methods: [{ capabilityId: 'synthetic-read', actionId: 'read' }],
    resolveCapability: (id) => id === 'synthetic-read' ? syntheticManifest() : null,
    ...overrides,
  };
}

test('keeps Code Mode disabled unless the trusted feature flag is exactly enabled', () => {
  let lookups = 0;
  const result = prepareCodeModeRun(request({
    enabled: 'true',
    resolveCapability: () => { lookups += 1; return syntheticManifest(); },
  }));
  assert.deepEqual(result, { ok: false, reasonCode: 'CODE_MODE_DISABLED' });
  assert.equal(lookups, 0);
});

test('prepares a bounded envelope using only a server-resolved synthetic read method', () => {
  const result = prepareCodeModeRun(request());
  assert.equal(result.ok, true);
  assert.equal(result.envelope.runId, 'run_123');
  assert.equal(result.envelope.code, request().code);
  assert.deepEqual(result.envelope.methods, [{
    capabilityId: 'synthetic-read',
    actionId: 'read',
    method: 'synthetic.read',
  }]);
  assert.deepEqual(result.envelope.limits, CODE_MODE_LIMITS);
  assert.equal(JSON.stringify(result.envelope).includes('/synthetic/read'), false);
  assert.equal(JSON.stringify(result.envelope).includes('aegis-core'), false);
});

test('does not expose a capability that can write, execute, or require approval', () => {
  for (const action of [
    { effect: 'write', risk: 'low', approval: 'human-always' },
    { effect: 'execute', risk: 'low', approval: 'human-always' },
    { effect: 'read', risk: 'high', approval: 'human-always' },
    { effect: 'read', risk: 'low', approval: 'human-always' },
  ]) {
    const result = prepareCodeModeRun(request({
      resolveCapability: () => syntheticManifest({
        actions: [{ id: 'read', capability: 'synthetic.read', ...action }],
      }),
    }));
    assert.deepEqual(result, { ok: false, reasonCode: 'METHOD_NOT_READ_ONLY' });
  }
});

test('rejects unapproved, restricted, external and egress-enabled capabilities', () => {
  const variants = [
    syntheticManifest({ status: 'candidate' }),
    syntheticManifest({ data: { classification: 'restricted', reads: [], writes: [] } }),
    syntheticManifest({ provider: { id: 'remote', kind: 'external' } }),
    syntheticManifest({ interface: { kind: 'mcp', method: 'POST', endpoint: 'https://example.com/mcp' } }),
    syntheticManifest({ network: { egressHosts: ['example.com'] } }),
    syntheticManifest({ data: { classification: 'internal', reads: ['fixture'], writes: ['fixture'] } }),
  ];
  for (const manifest of variants) {
    const result = prepareCodeModeRun(request({ resolveCapability: () => manifest }));
    assert.deepEqual(result, { ok: false, reasonCode: 'CAPABILITY_NOT_SANDBOX_ELIGIBLE' });
  }
});

test('rejects unknown methods and registry lookup failures without throwing', () => {
  assert.deepEqual(prepareCodeModeRun(request({
    methods: [{ capabilityId: 'missing', actionId: 'read' }],
  })), { ok: false, reasonCode: 'CAPABILITY_NOT_REGISTERED' });
  assert.deepEqual(prepareCodeModeRun(request({
    resolveCapability: () => { throw new Error('registry unavailable'); },
  })), { ok: false, reasonCode: 'CAPABILITY_LOOKUP_FAILED' });
  assert.deepEqual(prepareCodeModeRun(request({
    methods: [{ capabilityId: 'synthetic-read', actionId: 'missing' }],
  })), { ok: false, reasonCode: 'ACTION_NOT_FOUND' });
});

test('rejects duplicate, malformed and excessive method selections', () => {
  const method = { capabilityId: 'synthetic-read', actionId: 'read' };
  for (const methods of [
    [],
    [method, method],
    [{ capabilityId: '../secret', actionId: 'read' }],
    Array.from({ length: CODE_MODE_LIMITS.maxMethods + 1 }, () => method),
  ]) {
    const result = prepareCodeModeRun(request({ methods }));
    assert.equal(result.ok, false);
  }
});

test('bounds generated source and validates the run identifier', () => {
  assert.deepEqual(prepareCodeModeRun(request({
    code: 'x'.repeat(CODE_MODE_LIMITS.maxCodeBytes + 1),
  })), { ok: false, reasonCode: 'CODE_TOO_LARGE' });
  assert.deepEqual(prepareCodeModeRun(request({ runId: '../bad' })), {
    ok: false, reasonCode: 'INVALID_RUN_ID',
  });
  assert.deepEqual(prepareCodeModeRun(request({ code: '\u0000bad' })), {
    ok: false, reasonCode: 'INVALID_CODE',
  });
});

test('does not accept caller-supplied execution budgets or capability metadata', () => {
  const result = prepareCodeModeRun(request({
    limits: { maxCalls: 999999 },
    methods: [{
      capabilityId: 'synthetic-read',
      actionId: 'read',
      endpoint: 'https://attacker.example',
      approval: 'granted',
    }],
  }));
  assert.equal(result.ok, false);
  assert.equal(result.reasonCode, 'INVALID_METHOD_SELECTION');
});
