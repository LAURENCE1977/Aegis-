import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateCapabilityManifest,
  listCapabilityManifests,
  getCapabilityManifest,
  isCapabilityGranted,
} from '../functions/lib/capability-registry.mjs';

const manifest = {
  id: 'aegis-github-public-discovery',
  version: '0.1.0',
  name: 'Public GitHub repository discovery',
  description: 'Read public GitHub repository metadata without fetching or executing source code.',
  provider: { id: 'aegis-core', kind: 'builtin' },
  interface: { kind: 'internal', method: 'POST', path: '/api/forge/discover' },
  actions: [{
    id: 'discover',
    capability: 'source.discover',
    effect: 'read',
    risk: 'low',
    approval: 'none',
    requiredScopes: ['github:public-metadata:read'],
  }],
  data: {
    classification: 'public',
    reads: ['public GitHub repository metadata'],
    writes: [],
  },
  network: { egressHosts: ['api.github.com'] },
  auth: { mode: 'session' },
  limits: { requestsPerMinute: 30, timeoutMs: 5000, maxRequestBytes: 4096 },
  provenance: {
    sourceUrl: 'https://github.com/LAURENCE1977/Aegis-',
    revision: '2e590313628f26c8a31646e608ff515f13b53cee',
  },
  licence: { identifier: 'first-party', review: 'not-applicable' },
  status: 'approved',
};

test('capability manifest accepts a bounded, attributed, read-only internal capability', () => {
  assert.equal(validateCapabilityManifest(manifest), true);
});

test('write and execute actions require explicit human approval', () => {
  for (const effect of ['write', 'execute']) {
    assert.throws(() => validateCapabilityManifest({
      ...manifest,
      actions: [{ ...manifest.actions[0], effect, approval: 'none' }],
    }), /human approval/i);
  }
});

test('high and critical risk actions require explicit human approval', () => {
  for (const risk of ['high', 'critical']) {
    assert.throws(() => validateCapabilityManifest({
      ...manifest,
      actions: [{ ...manifest.actions[0], risk, approval: 'none' }],
    }), /human approval/i);
  }
});

test('approved capabilities require a completed licence/provenance review', () => {
  assert.throws(() => validateCapabilityManifest({
    ...manifest,
    licence: { identifier: 'unknown', review: 'review-required' },
  }), /licence/i);
});

test('secret references are identifiers, never secret values', () => {
  assert.equal(validateCapabilityManifest({
    ...manifest,
    auth: { mode: 'secret-reference', secretRef: 'secret://cloudflare/AEGIS_JOB_TOKEN' },
  }), true);
  assert.throws(() => validateCapabilityManifest({
    ...manifest,
    auth: { mode: 'secret-reference', secretRef: 'this-is-a-secret-value-not-a-reference' },
  }), /secret reference/i);
});

test('network egress rejects wildcard hosts, IP literals and invalid hostnames', () => {
  for (const host of ['*.example.com', '127.0.0.1', 'localhost', 'https://api.github.com']) {
    assert.throws(() => validateCapabilityManifest({
      ...manifest,
      network: { egressHosts: [host] },
    }), /egress/i);
  }
});

test('internal interface paths must be same-origin route paths, not arbitrary URLs', () => {
  for (const path of ['https://attacker.example/run', '//attacker.example/run', '/api/../admin']) {
    assert.throws(() => validateCapabilityManifest({
      ...manifest,
      interface: { kind: 'internal', method: 'POST', path },
    }), /interface/i);
  }
});

test('duplicate action identifiers and scopes are rejected', () => {
  assert.throws(() => validateCapabilityManifest({
    ...manifest,
    actions: [manifest.actions[0], manifest.actions[0]],
  }), /duplicate/i);
  assert.throws(() => validateCapabilityManifest({
    ...manifest,
    actions: [{ ...manifest.actions[0], requiredScopes: ['scope:read', 'scope:read'] }],
  }), /duplicate/i);
});

test('built-in registry returns defensive copies and stable identifiers', () => {
  const first = listCapabilityManifests();
  assert.ok(first.length >= 1);
  first[0].actions[0].requiredScopes.push('tampered:scope');
  assert.equal(listCapabilityManifests()[0].actions[0].requiredScopes.includes('tampered:scope'), false);
  assert.ok(getCapabilityManifest('aegis-github-public-discovery'));
  assert.equal(getCapabilityManifest('../unknown'), null);
});

test('approved registry metadata does not itself grant capability permissions', () => {
  assert.equal(isCapabilityGranted('aegis-github-public-discovery', 'source.discover'), false);
  assert.equal(isCapabilityGranted('aegis-github-public-discovery', 'source.write'), false);
});


test('registers Composio pull request reads as a separate exact-resource capability', () => {
  const pull = getCapabilityManifest('aegis-composio-github-pull-request-readonly');
  assert.ok(pull);
  assert.equal(validateCapabilityManifest(pull), true);
  assert.equal(pull.actions[0].id, 'get-pull-request');
  assert.equal(pull.actions[0].effect, 'read');
  assert.equal(pull.actions[0].requiredScopes[0], 'github:pull-request:read');
  assert.equal(pull.interface.path, '/api/sentinel/composio-github-pull-request');
  assert.deepEqual(pull.data.writes, []);
});


test('registers bounded read-only workflow run metadata as its own capability', () => {
  const workflows = getCapabilityManifest('aegis-composio-github-workflow-readonly');
  assert.ok(workflows);
  assert.equal(validateCapabilityManifest(workflows), true);
  assert.equal(workflows.actions[0].id, 'list-workflow-runs');
  assert.equal(workflows.actions[0].effect, 'read');
  assert.equal(workflows.actions[0].requiredScopes[0], 'github:workflow:read');
  assert.equal(workflows.interface.path, '/api/sentinel/composio-github-workflows');
  assert.deepEqual(workflows.data.writes, []);
});
