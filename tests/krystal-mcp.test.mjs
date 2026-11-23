import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/mcp/krystal.js';

const token = 'krystal-test-token-never-used-outside-tests';
const version = '2026-07-28';

function meta() {
  return {
    'io.modelcontextprotocol/protocolVersion': version,
    'io.modelcontextprotocol/clientInfo': { name: 'krystal-connector-tests', version: '1.0.0' },
    'io.modelcontextprotocol/clientCapabilities': {},
  };
}

function request(method, id, params = {}, name) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    Authorization: 'Bearer ' + token,
    'MCP-Protocol-Version': version,
    'Mcp-Method': method,
  };
  if (name) headers['Mcp-Name'] = name;
  return new Request('https://aegis.example/mcp/krystal', {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params: { ...params, _meta: meta() } }),
  });
}

function mockFetch(handler) {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  return () => { globalThis.fetch = original; };
}

test('Krystal MCP endpoint requires a bearer API key and never falls back to AEGIS-wide credentials', async () => {
  const req = request('tools/list', 1);
  const headers = new Headers(req.headers);
  headers.delete('Authorization');
  const restore = mockFetch(() => { throw new Error('fetch must not run'); });
  try {
    const response = await onRequestPost({ request: new Request(req.url, { method: 'POST', headers, body: await req.text() }), env: {} });
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  } finally { restore(); }
});

test('Krystal MCP endpoint exposes only the three read-only account and DNS tools', async () => {
  const response = await onRequestPost({ request: request('tools/list', 2), env: {} });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.result.tools.map((tool) => tool.name), [
    'krystal_list_organizations',
    'krystal_list_dns_zones',
    'krystal_list_dns_records',
  ]);
  assert.ok(body.result.tools.every((tool) => tool.annotations.readOnlyHint === true));
});

test('organization listing sends the supplied key as a bearer token to the fixed Krystal API origin', async () => {
  let observed;
  const restore = mockFetch(async (url, options) => {
    observed = { url: String(url), authorization: new Headers(options.headers).get('Authorization'), method: options.method };
    return Response.json({ organizations: [{ id: 'org_1', name: 'Test org' }] });
  });
  try {
    const response = await onRequestPost({
      request: request('tools/call', 3, { name: 'krystal_list_organizations', arguments: {} }, 'krystal_list_organizations'),
      env: {},
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.result.structuredContent.organizations[0].id, 'org_1');
    assert.equal(observed.url, 'https://api.katapult.io/core/v1/organizations');
    assert.equal(observed.authorization, 'Bearer ' + token);
    assert.equal(observed.method, 'GET');
  } finally { restore(); }
});

test('DNS zone listing requires an organization ID and uses a read-only GET request', async () => {
  let observed;
  const restore = mockFetch(async (url, options) => {
    observed = { url: String(url), method: options.method };
    return Response.json({ dns_zones: [{ id: 'zone_1', name: 'example.test' }] });
  });
  try {
    const response = await onRequestPost({
      request: request('tools/call', 4, { name: 'krystal_list_dns_zones', arguments: { organization_id: 'org_1', page: 1 } }, 'krystal_list_dns_zones'),
      env: {},
    });
    assert.equal(response.status, 200);
    assert.match(observed.url, /^https:\/\/api\.katapult\.io\/core\/v1\/organizations\/organization\/dns_zones\?/);
    assert.match(observed.url, /organization%5Bid%5D=org_1/);
    assert.equal(observed.method, 'GET');
  } finally { restore(); }
});

test('DNS record listing requires a zone ID and uses a read-only GET request', async () => {
  let observed;
  const restore = mockFetch(async (url, options) => {
    observed = { url: String(url), method: options.method };
    return Response.json({ dns_records: [{ id: 'record_1', type: 'A' }] });
  });
  try {
    const response = await onRequestPost({
      request: request('tools/call', 5, { name: 'krystal_list_dns_records', arguments: { dns_zone_id: 'zone_1', page: 1 } }, 'krystal_list_dns_records'),
      env: {},
    });
    assert.equal(response.status, 200);
    assert.match(observed.url, /^https:\/\/api\.katapult\.io\/core\/v1\/dns_zones\/dns_zone\/records\?/);
    assert.match(observed.url, /dns_zone%5Bid%5D=zone_1/);
    assert.equal(observed.method, 'GET');
  } finally { restore(); }
});

test('Krystal MCP rejects unknown tools and malformed identifiers without making an API request', async () => {
  let called = false;
  const restore = mockFetch(() => { called = true; throw new Error('unexpected network request'); });
  try {
    const unknown = await onRequestPost({
      request: request('tools/call', 6, { name: 'krystal_delete_dns_record', arguments: {} }, 'krystal_delete_dns_record'),
      env: {},
    });
    assert.equal((await unknown.json()).error.code, -32601);
    const invalid = await onRequestPost({
      request: request('tools/call', 7, { name: 'krystal_list_dns_zones', arguments: { organization_id: '../other' } }, 'krystal_list_dns_zones'),
      env: {},
    });
    assert.equal((await invalid.json()).result.isError, true);
    assert.equal(called, false);
  } finally { restore(); }
});

test('Krystal upstream errors are sanitised and do not echo the API key', async () => {
  const restore = mockFetch(async () => new Response('secret upstream detail', { status: 403 }));
  try {
    const response = await onRequestPost({
      request: request('tools/call', 8, { name: 'krystal_list_organizations', arguments: {} }, 'krystal_list_organizations'),
      env: {},
    });
    const body = await response.json();
    assert.equal(body.result.isError, true);
    assert.doesNotMatch(body.result.content[0].text, /secret upstream detail|krystal-test-token/);
  } finally { restore(); }
});
