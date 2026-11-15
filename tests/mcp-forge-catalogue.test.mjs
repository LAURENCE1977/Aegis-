import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateMcpServerRecord,
  createMcpServerCatalogue,
} from '../functions/lib/mcp-forge-catalogue.mjs';

const record = {
  id: 'example-readonly-server',
  name: 'Example Read-only Server',
  description: 'A reviewed candidate MCP server for public documentation lookup.',
  sourceUrl: 'https://github.com/example/read-only-mcp',
  revision: '0123456789abcdef0123456789abcdef01234567',
  licence: { identifier: 'MIT', review: 'verified' },
  transport: 'streamable-http',
  runtime: 'remote',
  auth: 'oauth2',
  egressHosts: ['api.example.com'],
  actions: [{
    id: 'search',
    description: 'Search public documentation',
    effect: 'read',
    risk: 'low',
    approvalPolicy: 'none',
    requiredScopes: ['docs:public:read'],
  }],
  status: 'candidate',
};

test('accepts a bounded MCP candidate with pinned provenance and declared effects', () => {
  assert.equal(validateMcpServerRecord(record), true);
});

test('rejects non-HTTPS source URLs, embedded credentials and unpinned revisions', () => {
  for (const patch of [
    { sourceUrl: 'http://github.com/example/server' },
    { sourceUrl: 'https://user:password@example.com/server' },
    { revision: 'main' },
  ]) {
    assert.throws(() => validateMcpServerRecord({ ...record, ...patch }));
  }
});

test('rejects wildcard, localhost and IP-literal egress destinations', () => {
  for (const host of ['*.example.com', 'localhost', '127.0.0.1', '10.0.0.1']) {
    assert.throws(() => validateMcpServerRecord({ ...record, egressHosts: [host] }));
  }
});

test('rejects undeclared effects, invalid risk and write actions without mandatory approval', () => {
  assert.throws(() => validateMcpServerRecord({
    ...record,
    actions: [{ ...record.actions[0], effect: 'unknown' }],
  }));
  assert.throws(() => validateMcpServerRecord({
    ...record,
    actions: [{ ...record.actions[0], effect: 'write', risk: 'medium' }],
  }));
});

test('rejects executable transports without an explicit runtime declaration', () => {
  assert.throws(() => validateMcpServerRecord({ ...record, transport: 'stdio', runtime: '' }));
});

test('catalogue rejects duplicate IDs and returns defensive copies', () => {
  const catalogue = createMcpServerCatalogue([record]);
  assert.throws(() => createMcpServerCatalogue([record, record]), /duplicate/i);
  const listed = catalogue.list();
  listed[0].actions[0].requiredScopes.push('tampered:scope');
  assert.equal(catalogue.get(record.id).actions[0].requiredScopes.includes('tampered:scope'), false);
});

test('catalogue search matches name, description, source and action metadata', () => {
  const catalogue = createMcpServerCatalogue([record]);
  assert.equal(catalogue.search('documentation').length, 1);
  assert.equal(catalogue.search('github').length, 1);
  assert.equal(catalogue.search('payments').length, 0);
});

test('catalogue cannot promote candidates to approved or execute them', () => {
  const catalogue = createMcpServerCatalogue([record]);
  assert.equal(catalogue.get(record.id).status, 'candidate');
  assert.equal(typeof catalogue.execute, 'undefined');
  assert.throws(() => validateMcpServerRecord({ ...record, status: 'approved' }), /admission/i);
});

test('rejects oversized metadata and duplicate action identifiers', () => {
  assert.throws(() => validateMcpServerRecord({ ...record, description: 'x'.repeat(3000) }));
  assert.throws(() => validateMcpServerRecord({
    ...record,
    actions: [record.actions[0], record.actions[0]],
  }), /duplicate/i);
});
