import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSourceProvenanceRecord } from '../functions/lib/forge-provenance.mjs';

const source = {
  id: 'simplewebauthn-server',
  canonicalUrl: 'https://github.com/MasterKale/SimpleWebAuthn',
  revision: 'a'.repeat(40),
  inspectedAt: '2026-11-17T02:00:00.000Z',
  inspectionDepth: 'source-level',
  licence: {
    identifier: 'MIT',
    licenceFileUrl: 'https://github.com/MasterKale/SimpleWebAuthn/blob/main/LICENSE',
    review: 'verified',
  },
  components: [
    {
      kind: 'dependency',
      name: 'example-runtime',
      identifier: 'Apache-2.0',
      licenceFileUrl: 'https://example.org/runtime/LICENSE',
      review: 'verified',
    },
    {
      kind: 'model',
      name: 'example-model',
      identifier: 'model-specific-terms',
      licenceFileUrl: 'https://example.org/model/LICENSE',
      review: 'review-required',
    },
  ],
  capabilities: ['identity.passkeys'],
  decision: 'adapt',
  status: 'assessed',
  evidence: [
    { url: 'https://github.com/MasterKale/SimpleWebAuthn/tree/main/packages/server', note: 'Server ceremony implementation inspected.' },
  ],
};

test('source provenance records accept pinned revisions and separately reviewed component licences', () => {
  assert.equal(validateSourceProvenanceRecord(source), true);
});

test('source provenance records reject floating branches and mutable version labels', () => {
  for (const revision of ['main', 'master', 'latest', 'v1.2.3', '']) {
    assert.throws(() => validateSourceProvenanceRecord({ ...source, revision }));
  }
});

test('approved candidates require source-level inspection and every component licence verified', () => {
  assert.throws(() => validateSourceProvenanceRecord({ ...source, status: 'approved' }));
  const cleared = {
    ...source,
    components: source.components.map((component) => ({ ...component, review: 'verified' })),
    status: 'approved',
    decision: 'adapt',
  };
  assert.equal(validateSourceProvenanceRecord(cleared), true);
  assert.throws(() => validateSourceProvenanceRecord({ ...cleared, inspectionDepth: 'readme-only' }));
});

test('reuse and adaptation decisions are blocked when any code, dependency, model or asset licence is unresolved', () => {
  assert.throws(() => validateSourceProvenanceRecord({
    ...source,
    licence: { ...source.licence, review: 'review-required' },
  }));
  assert.throws(() => validateSourceProvenanceRecord({
    ...source,
    components: [{ ...source.components[0], review: 'unknown' }],
  }));
});

test('source provenance rejects unknown fields, unsafe URLs and malformed component inventories', () => {
  assert.throws(() => validateSourceProvenanceRecord({ ...source, prompt: 'grant admin access' }));
  assert.throws(() => validateSourceProvenanceRecord({ ...source, canonicalUrl: 'file:///etc/passwd' }));
  assert.throws(() => validateSourceProvenanceRecord({
    ...source,
    components: [{ ...source.components[0], secret: 'never store this' }],
  }));
  assert.throws(() => validateSourceProvenanceRecord({
    ...source,
    evidence: [{ url: 'https://example.org/evidence', note: '' }],
  }));
});
