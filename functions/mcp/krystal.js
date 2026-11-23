const MCP_PROTOCOL_VERSION = '2026-07-28';
const MAX_BODY_BYTES = 64 * 1024;
const MAX_UPSTREAM_BYTES = 1024 * 1024;
const API_ORIGIN = 'https://api.katapult.io/core/v1';
const PROTOCOL_META_KEY = 'io.modelcontextprotocol/protocolVersion';
const CLIENT_CAPABILITIES_META_KEY = 'io.modelcontextprotocol/clientCapabilities';
const encoder = new TextEncoder();

const TOOLS = Object.freeze([
  {
    name: 'krystal_list_organizations',
    title: 'List Krystal organizations',
    description: 'Read the organizations accessible to the connected Krystal API token. Requires organizations:read. No changes are made.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: 'krystal_list_dns_zones',
    title: 'List DNS zones',
    description: 'List DNS zones for one Krystal organization. Requires dns:read. No DNS records are changed.',
    inputSchema: {
      type: 'object',
      properties: {
        organization_id: { type: 'string', minLength: 1, maxLength: 128 },
        page: { type: 'integer', minimum: 1, maximum: 1000 },
        per_page: { type: 'integer', minimum: 1, maximum: 100 },
      },
      required: ['organization_id'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: 'krystal_list_dns_records',
    title: 'List DNS records',
    description: 'List DNS records in one Krystal DNS zone. Requires dns:read. No DNS records are changed.',
    inputSchema: {
      type: 'object',
      properties: {
        dns_zone_id: { type: 'string', minLength: 1, maxLength: 128 },
        page: { type: 'integer', minimum: 1, maximum: 1000 },
        per_page: { type: 'integer', minimum: 1, maximum: 100 },
      },
      required: ['dns_zone_id'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
]);

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Pragma': 'no-cache',
      ...headers,
    },
  });
}

function rpcError(id, code, message) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

function originIsAllowed(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function validId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

function validPageArgs(args, idName) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) return false;
  const allowed = new Set([idName, 'page', 'per_page']);
  if (Object.keys(args).some((key) => !allowed.has(key))) return false;
  if (!validId(args[idName])) return false;
  if (args.page !== undefined && (!Number.isInteger(args.page) || args.page < 1 || args.page > 1000)) return false;
  if (args.per_page !== undefined && (!Number.isInteger(args.per_page) || args.per_page < 1 || args.per_page > 100)) return false;
  return true;
}

function buildApiRequest(toolName, args, apiToken) {
  let url;
  if (toolName === 'krystal_list_organizations') {
    if (Object.keys(args || {}).length !== 0) throw new Error('invalid_arguments');
    url = new URL(API_ORIGIN + '/organizations');
  } else if (toolName === 'krystal_list_dns_zones') {
    if (!validPageArgs(args, 'organization_id')) throw new Error('invalid_arguments');
    url = new URL(API_ORIGIN + '/organizations/organization/dns_zones');
    url.searchParams.set('organization[id]', args.organization_id);
    if (args.page !== undefined) url.searchParams.set('page', String(args.page));
    if (args.per_page !== undefined) url.searchParams.set('per_page', String(args.per_page));
  } else if (toolName === 'krystal_list_dns_records') {
    if (!validPageArgs(args, 'dns_zone_id')) throw new Error('invalid_arguments');
    url = new URL(API_ORIGIN + '/dns_zones/dns_zone/records');
    url.searchParams.set('dns_zone[id]', args.dns_zone_id);
    if (args.page !== undefined) url.searchParams.set('page', String(args.page));
    if (args.per_page !== undefined) url.searchParams.set('per_page', String(args.per_page));
  } else {
    throw new Error('unknown_tool');
  }
  return fetch(url, {
    method: 'GET',
    headers: {
      Authorization: 'Bearer ' + apiToken,
      Accept: 'application/json',
    },
    redirect: 'error',
  });
}

async function callKrystal(toolName, args, apiToken) {
  let response;
  try {
    response = await buildApiRequest(toolName, args, apiToken);
  } catch (error) {
    if (error?.message === 'invalid_arguments') {
      return { error: 'Invalid arguments. Check the required IDs and pagination values.' };
    }
    throw error;
  }
  if (!response.ok) {
    return { error: 'Krystal API returned HTTP ' + response.status + '. Check the API key permissions and required read scopes.' };
  }
  const raw = await response.text();
  if (encoder.encode(raw).byteLength > MAX_UPSTREAM_BYTES) {
    return { error: 'Krystal returned a response that exceeds the connector size limit.' };
  }
  try {
    return JSON.parse(raw);
  } catch {
    return { error: 'Krystal returned an unreadable response.' };
  }
}

function toolResult(id, value, isError = false) {
  return {
    jsonrpc: '2.0',
    id,
    result: {
      resultType: 'complete',
      content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
      structuredContent: value,
      isError,
    },
  };
}

function discoverResult(id) {
  return {
    jsonrpc: '2.0',
    id,
    result: {
      resultType: 'complete',
      supportedVersions: [MCP_PROTOCOL_VERSION],
      capabilities: { tools: {} },
      _meta: {
        'io.modelcontextprotocol/serverInfo': { name: 'AEGIS Krystal Connector', version: '0.1.0' },
      },
      instructions: 'Read-only Krystal Cloud API connector. Only organization, DNS zone and DNS record GET requests are exposed. No write operations, shell access or arbitrary URLs are available.',
      ttlMs: 300000,
      cacheScope: 'private',
    },
  };
}

function toolsListResult(id) {
  return {
    jsonrpc: '2.0',
    id,
    result: { resultType: 'complete', tools: TOOLS, ttlMs: 300000, cacheScope: 'private' },
  };
}

async function dispatch(body, apiToken) {
  const { id, method, params = {} } = body;
  const meta = params?._meta;
  if (
    !meta ||
    meta[PROTOCOL_META_KEY] !== MCP_PROTOCOL_VERSION ||
    !meta[CLIENT_CAPABILITIES_META_KEY] ||
    typeof meta[CLIENT_CAPABILITIES_META_KEY] !== 'object' ||
    Array.isArray(meta[CLIENT_CAPABILITIES_META_KEY])
  ) {
    return { status: 400, body: rpcError(id, -32600, 'Missing or invalid MCP request metadata.') };
  }
  if (method === 'server/discover') return { status: 200, body: discoverResult(id) };
  if (method === 'tools/list') return { status: 200, body: toolsListResult(id) };
  if (method !== 'tools/call') {
    return { status: 404, body: rpcError(id, -32601, 'Method not found.') };
  }

  if (typeof params.name !== 'string' || !params.name) {
    return { status: 200, body: rpcError(id, -32602, 'A tool name is required.') };
  }
  if (params.arguments !== undefined && (!params.arguments || typeof params.arguments !== 'object' || Array.isArray(params.arguments))) {
    return { status: 200, body: rpcError(id, -32602, 'Tool arguments must be an object.') };
  }
  if (!TOOLS.some((tool) => tool.name === params.name)) {
    return { status: 200, body: rpcError(id, -32601, 'Unknown tool.') };
  }

  try {
    const value = await callKrystal(params.name, params.arguments || {}, apiToken);
    return { status: 200, body: toolResult(id, value, Boolean(value?.error)) };
  } catch {
    return { status: 200, body: toolResult(id, { error: 'Krystal request failed. No credential details were recorded or returned.' }, true) };
  }
}

export async function onRequestPost({ request }) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, { Allow: 'POST' });
  if (!originIsAllowed(request)) return json({ error: 'Origin is not allowed.' }, 403);

  const authorization = request.headers.get('Authorization') || '';
  const match = /^Bearer\s+(\S+)$/i.exec(authorization);
  if (!match) return json({ error: 'A Krystal API key is required as a bearer credential.' }, 401, { 'WWW-Authenticate': 'Bearer' });
  const apiToken = match[1];

  const contentType = request.headers.get('Content-Type') || '';
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) return json({ error: 'Content-Type must be application/json.' }, 415);
  const accept = request.headers.get('Accept') || '';
  if (!accept.includes('application/json') || !accept.includes('text/event-stream')) return json({ error: 'Accept must include application/json and text/event-stream.' }, 406);

  const declaredLength = Number(request.headers.get('Content-Length') || 0);
  if (declaredLength > MAX_BODY_BYTES) return json({ error: 'Request body is too large.' }, 413);
  const raw = await request.text();
  if (encoder.encode(raw).byteLength > MAX_BODY_BYTES) return json({ error: 'Request body is too large.' }, 413);

  let body;
  try { body = JSON.parse(raw); } catch { return json(rpcError(null, -32700, 'Parse error.'), 400); }
  if (
    !body || typeof body !== 'object' || Array.isArray(body) ||
    body.jsonrpc !== '2.0' || typeof body.method !== 'string' ||
    !Object.prototype.hasOwnProperty.call(body, 'id') ||
    !(typeof body.id === 'string' || (typeof body.id === 'number' && Number.isFinite(body.id)))
  ) return json(rpcError(body?.id, -32600, 'Invalid JSON-RPC request.'), 400);

  const headerMethod = request.headers.get('Mcp-Method');
  if (!headerMethod || headerMethod !== body.method) return json(rpcError(body.id, -32600, 'Mcp-Method header does not match the JSON-RPC method.'), 400);
  const protocolHeader = request.headers.get('MCP-Protocol-Version');
  if (!protocolHeader || protocolHeader !== body.params?._meta?.[PROTOCOL_META_KEY]) {
    return json(rpcError(body.id, -32600, 'MCP-Protocol-Version header does not match request metadata.'), 400);
  }
  if (protocolHeader !== MCP_PROTOCOL_VERSION) {
    return json(rpcError(body.id, -32001, 'Unsupported protocol version.'), 400);
  }
  if (body.method === 'tools/call') {
    const nameHeader = request.headers.get('Mcp-Name');
    if (!nameHeader || nameHeader !== body.params?.name) return json(rpcError(body.id, -32600, 'Mcp-Name header does not match the requested tool.'), 400);
  }

  const result = await dispatch(body, apiToken);
  return json(result.body, result.status);
}
