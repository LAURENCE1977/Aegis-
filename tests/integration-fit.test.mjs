import test from 'node:test';
import assert from 'node:assert/strict';
import { rankIntegrations } from '../functions/lib/integration-fit.mjs';

const now = '2026-11-22T20:00:00.000Z';
const readyApi = {
  id: 'api-docs', name: 'Docs API', kind: 'api', status: 'ready',
  authStatus: 'connected', securityStatus: 'verified',
  verifiedAt: '2026-11-22T19:00:00.000Z',
  tasks: ['research', 'chat'], effects: ['read'],
  requiredScopes: ['docs:read'], grantedScopes: ['docs:read'],
  costPer1kTokens: 0.01, latencyMs: 250,
};

test('ranks eligible API and MCP candidates for the requested task and action', () => {
  const mcp = { ...readyApi, id: 'mcp-docs', name: 'Docs MCP', kind: 'mcp', latencyMs: 100 };
  const result = rankIntegrations({ task: 'research', effect: 'read', candidates: [readyApi, mcp], now });
  assert.equal(result.mode, 'metadata-only');
  assert.equal(result.executionPerformed, false);
  assert.equal(result.recommendations[0].id, 'mcp-docs');
  assert.equal(result.recommendations[0].eligible, true);
});

test('fails closed when authentication, security review or admission is incomplete', () => {
  const candidates = [
    { ...readyApi, id: 'auth-missing', authStatus: 'missing' },
    { ...readyApi, id: 'security-review', securityStatus: 'review' },
    { ...readyApi, id: 'not-ready', status: 'candidate' },
  ];
  const result = rankIntegrations({ task: 'research', candidates, now });
  assert.ok(result.recommendations.every(item => !item.eligible && item.score === null));
});

test('excludes stale and future-dated capability evidence', () => {
  const candidates = [
    { ...readyApi, id: 'stale', verifiedAt: '2026-11-01T00:00:00.000Z' },
    { ...readyApi, id: 'future', verifiedAt: '2026-11-23T00:00:00.000Z' },
  ];
  const result = rankIntegrations({ task: 'research', candidates, now });
  assert.ok(result.recommendations.every(item => !item.eligible));
});

test('requires declared task, effect and every requested scope', () => {
  const candidates = [
    { ...readyApi, id: 'wrong-task', tasks: ['chat'] },
    { ...readyApi, id: 'wrong-effect', effects: ['read'] },
    { ...readyApi, id: 'missing-scope', grantedScopes: [] },
  ];
  const result = rankIntegrations({ task: 'coding', effect: 'execute', candidates, now });
  assert.ok(result.recommendations.every(item => !item.eligible));
});

test('does not let cost or latency compensate for a failed security gate', () => {
  const unsafe = {
    ...readyApi, id: 'unsafe-cheap', securityStatus: 'failed',
    costPer1kTokens: 0, latencyMs: 1,
  };
  const result = rankIntegrations({ task: 'research', candidates: [unsafe, readyApi], now });
  assert.equal(result.recommendations[0].id, 'api-docs');
  assert.equal(result.recommendations[1].eligible, false);
});

test('rejects duplicate IDs, invalid task names and malformed candidates', () => {
  assert.throws(() => rankIntegrations({ task: 'magic', candidates: [], now }));
  assert.throws(() => rankIntegrations({ task: 'research', candidates: [readyApi, readyApi], now }), /duplicate/i);
  assert.throws(() => rankIntegrations({ task: 'research', candidates: [{ ...readyApi, kind: 'plugin' }], now }));
});

test('does not mutate supplied candidate metadata', () => {
  const input = { ...readyApi, tasks: [...readyApi.tasks], effects: [...readyApi.effects] };
  const before = structuredClone(input);
  rankIntegrations({ task: 'research', candidates: [input], now });
  assert.deepEqual(input, before);
});
