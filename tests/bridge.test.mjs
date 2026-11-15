import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/mcp.js';

const token = 'test-only-mcp-token-with-at-least-32-characters';
const env = { AEGIS_MCP_TOKEN: token };

function mcpRequest(body, { version = '2026-07-28', method = body.method, name, authorization = 'Bearer ' + token, origin } = {}) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    'MCP-Protocol-Version': version,
    'Mcp-Method': method,
    Authorization: authorization,
  };
  if (name) headers['Mcp-Name'] = name;
  if (origin) headers.Origin = origin;
  return new Request('https://aegis.example/mcp', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

function meta() {
  return {
    'io.modelcontextprotocol/protocolVersion': '2026-07-28',
    'io.modelcontextprotocol/clientInfo': { name: 'aegis-bridge-tests', version: '1.0.0' },
    'io.modelcontextprotocol/clientCapabilities': {},
  };
}

test('MCP endpoint fails closed when no bridge credential is configured', async () => {
  const response = await onRequestPost({
    request: mcpRequest({ jsonrpc: '2.0', id: 1, method: 'server/discover', params: { _meta: meta() } }),
    env: {},
  });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('MCP endpoint rejects missing or invalid bearer credentials', async () => {
  const response = await onRequestPost({
    request: mcpRequest({ jsonrpc: '2.0', id: 1, method: 'server/discover', params: { _meta: meta() } }, { authorization: 'Bearer invalid-token' }),
    env,
  });
  assert.equal(response.status, 401);
});

test('MCP endpoint rejects a hostile Origin before processing JSON-RPC', async () => {
  const response = await onRequestPost({
    request: mcpRequest({ jsonrpc: '2.0', id: 1, method: 'server/discover', params: { _meta: meta() } }, { origin: 'https://attacker.example' }),
    env,
  });
  assert.equal(response.status, 403);
});

test('server/discover advertises the supported stateless MCP protocol and server identity', async () => {
  const response = await onRequestPost({
    request: mcpRequest({ jsonrpc: '2.0', id: 'discover-1', method: 'server/discover', params: { _meta: meta() } }),
    env,
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('Content-Type') || '', /application\/json/);
  const body = await response.json();
  assert.equal(body.id, 'discover-1');
  assert.deepEqual(body.result.supportedVersions, ['2026-07-28']);
  assert.ok(body.result.capabilities.tools);
  assert.equal(body.result._meta['io.modelcontextprotocol/serverInfo'].name, 'AEGIS Bridge');
});

test('tools/list exposes only the initial read-only AEGIS tools', async () => {
  const requestBody = { jsonrpc: '2.0', id: 2, method: 'tools/list', params: { _meta: meta() } };
  const response = await onRequestPost({ request: mcpRequest(requestBody), env });
  assert.equal(response.status, 200);
  const body = await response.json();
  const names = body.result.tools.map((tool) => tool.name);
  assert.deepEqual(names, ['aegis_get_status', 'aegis_list_modules', 'aegis_list_skills']);
  assert.ok(body.result.tools.every((tool) => tool.annotations?.readOnlyHint === true));
});

test('tools/call returns skill registry data as structured and readable content', async () => {
  const requestBody = {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: { name: 'aegis_list_skills', arguments: {}, _meta: meta() },
  };
  const response = await onRequestPost({ request: mcpRequest(requestBody, { name: 'aegis_list_skills' }), env });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.result.isError, false);
  assert.match(body.result.content[0].text, /brainstorming/);
  assert.ok(Array.isArray(body.result.structuredContent.skills));
});

test('tools/call rejects unknown tools with a JSON-RPC method error', async () => {
  const requestBody = {
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/call',
    params: { name: 'run_arbitrary_code', arguments: {}, _meta: meta() },
  };
  const response = await onRequestPost({ request: mcpRequest(requestBody, { name: 'run_arbitrary_code' }), env });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.error.code, -32601);
});

test('MCP endpoint rejects a protocol header/body version mismatch', async () => {
  const requestBody = { jsonrpc: '2.0', id: 5, method: 'server/discover', params: { _meta: meta() } };
  const response = await onRequestPost({
    request: mcpRequest(requestBody, { version: '2025-11-25' }),
    env,
  });
  assert.equal(response.status, 400);
});

test('MCP endpoint rejects missing protocol metadata', async () => {
  const requestBody = { jsonrpc: '2.0', id: 6, method: 'server/discover', params: {} };
  const response = await onRequestPost({ request: mcpRequest(requestBody), env });
  assert.equal(response.status, 400);
});

test('MCP Streamable HTTP rejects client notifications that are not supported by this transport revision', async () => {
  const requestBody = {
    jsonrpc: '2.0',
    method: 'notifications/cancelled',
    params: { requestId: 99, _meta: meta() },
  };
  const response = await onRequestPost({ request: mcpRequest(requestBody), env });
  assert.equal(response.status, 400);
});

test('MCP endpoint rejects oversized requests', async () => {
  const requestBody = {
    jsonrpc: '2.0',
    id: 7,
    method: 'server/discover',
    params: { _meta: meta(), padding: 'x'.repeat(70_000) },
  };
  const response = await onRequestPost({ request: mcpRequest(requestBody), env });
  assert.equal(response.status, 413);
});


test('MCP endpoint rejects a Mcp-Method header that differs from the JSON-RPC method', async () => {
  const requestBody = { jsonrpc: '2.0', id: 8, method: 'server/discover', params: { _meta: meta() } };
  const response = await onRequestPost({
    request: mcpRequest(requestBody, { method: 'tools/list' }),
    env,
  });
  assert.equal(response.status, 400);
});

test('tools/call requires a matching Mcp-Name header', async () => {
  const requestBody = {
    jsonrpc: '2.0',
    id: 9,
    method: 'tools/call',
    params: { name: 'aegis_list_skills', arguments: {}, _meta: meta() },
  };
  const response = await onRequestPost({ request: mcpRequest(requestBody), env });
  assert.equal(response.status, 400);
});

test('MCP endpoint requires both JSON and event-stream in Accept', async () => {
  const request = mcpRequest({
    jsonrpc: '2.0', id: 10, method: 'server/discover', params: { _meta: meta() },
  });
  const headers = new Headers(request.headers);
  headers.set('Accept', 'application/json');
  const response = await onRequestPost({
    request: new Request(request.url, { method: 'POST', headers, body: await request.text() }),
    env,
  });
  assert.equal(response.status, 406);
});

test('MCP endpoint rejects non-JSON content types', async () => {
  const request = mcpRequest({
    jsonrpc: '2.0', id: 11, method: 'server/discover', params: { _meta: meta() },
  });
  const headers = new Headers(request.headers);
  headers.set('Content-Type', 'text/plain');
  const response = await onRequestPost({
    request: new Request(request.url, { method: 'POST', headers, body: await request.text() }),
    env,
  });
  assert.equal(response.status, 415);
});

test('MCP endpoint permits an authenticated AEGIS browser session as an alternative credential', async () => {
  const { createSessionToken } = await import('../functions/lib/auth.mjs');
  const sessionSecret = 'test-only-session-secret-for-mcp-bridge-32chars';
  const sessionToken = await createSessionToken(sessionSecret);
  const requestBody = { jsonrpc: '2.0', id: 12, method: 'server/discover', params: { _meta: meta() } };
  const request = mcpRequest(requestBody, {
    authorization: '',
  });
  const headers = new Headers(request.headers);
  headers.delete('Authorization');
  headers.set('Cookie', '__Host-aegis_session=' + sessionToken);
  const response = await onRequestPost({
    request: new Request(request.url, { method: 'POST', headers, body: JSON.stringify(requestBody) }),
    env: { AEGIS_SESSION_SECRET: sessionSecret },
  });
  assert.equal(response.status, 200);
});
