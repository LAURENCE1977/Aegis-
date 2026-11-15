import { constantTimeEqual, isAuthorized } from './auth.mjs';
import { listModules } from './modules.mjs';
import { listSkills } from './skills.mjs';

export const MCP_PROTOCOL_VERSION = '2026-07-28';
export const AEGIS_BRIDGE_VERSION = '0.1.0';
const MAX_BODY_BYTES = 64 * 1024;
const SERVER_META_KEY = 'io.modelcontextprotocol/serverInfo';
const PROTOCOL_META_KEY = 'io.modelcontextprotocol/protocolVersion';
const CLIENT_CAPABILITIES_META_KEY = 'io.modelcontextprotocol/clientCapabilities';

const TOOLS = Object.freeze([
  {
    name: 'aegis_get_status',
    title: 'Get AEGIS status',
    description: 'Read the current AEGIS prototype capabilities and implementation boundaries. This tool does not perform actions.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'aegis_list_modules',
    title: 'List AEGIS modules',
    description: 'List declared AEGIS modules and their descriptive capabilities. Registry entries do not grant permissions.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'aegis_list_skills',
    title: 'List AEGIS skills',
    description: 'List the AEGIS engineering skill registry, including source provenance and guidance-only status.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
]);

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
}

function rpcError(id, code, message, data) {
  const error = { code, message };
  if (data !== undefined) error.data = data;
  return { jsonrpc: '2.0', id: id ?? null, error };
}

function requestMetaIsValid(params) {
  const meta = params?._meta;
  return Boolean(
    meta &&
    typeof meta === 'object' &&
    meta[PROTOCOL_META_KEY] === MCP_PROTOCOL_VERSION &&
    meta[CLIENT_CAPABILITIES_META_KEY] &&
    typeof meta[CLIENT_CAPABILITIES_META_KEY] === 'object' &&
    !Array.isArray(meta[CLIENT_CAPABILITIES_META_KEY])
  );
}

function originIsAllowed(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return true; // Server-to-server MCP clients commonly omit Origin.
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

async function isBridgeAuthorized(request, env) {
  const expected = env?.AEGIS_MCP_TOKEN;
  const authorization = request.headers.get('Authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (
    typeof expected === 'string' &&
    expected.length >= 32 &&
    match &&
    constantTimeEqual(match[1], expected)
  ) return true;

  return isAuthorized(request, env);
}

function statusSnapshot() {
  return {
    name: 'AEGIS',
    bridge: { status: 'available', version: AEGIS_BRIDGE_VERSION, protocol: MCP_PROTOCOL_VERSION },
    application: 'Cloudflare Pages prototype',
    implemented: [
      'authenticated chat and memory endpoints',
      'read-only module and skills registries',
      'read-only GitHub repository metadata discovery',
      'stateless MCP discovery and read-only tools',
    ],
    planned: [
      'OAuth 2.1 authorisation server',
      'durable background job runner',
      'persistent engineering knowledge store',
      'general MCP and API connector manager',
      'provider/model router',
      'production Forge sandbox',
    ],
    permissions: 'The initial MCP toolset is read-only and grants no write or execution permissions.',
  };
}

function toolResult(id, value) {
  return {
    jsonrpc: '2.0',
    id,
    result: {
      resultType: 'complete',
      content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
      structuredContent: value,
      isError: false,
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
        [SERVER_META_KEY]: {
          name: 'AEGIS Bridge',
          version: AEGIS_BRIDGE_VERSION,
        },
      },
      instructions: 'AEGIS Bridge currently exposes authenticated, read-only project status, module and skill registry tools. It does not execute code or grant write permissions.',
      ttlMs: 300000,
      cacheScope: 'private',
    },
  };
}

function toolsListResult(id) {
  return {
    jsonrpc: '2.0',
    id,
    result: {
      resultType: 'complete',
      tools: TOOLS,
      ttlMs: 300000,
      cacheScope: 'private',
    },
  };
}

async function dispatch(requestBody) {
  const { id, method, params = {} } = requestBody;
  if (!requestMetaIsValid(params)) {
    return { status: 400, body: rpcError(id, -32600, 'Missing or invalid MCP request metadata.') };
  }

  if (method === 'server/discover') return { status: 200, body: discoverResult(id) };
  if (method === 'tools/list') return { status: 200, body: toolsListResult(id) };

  if (method === 'tools/call') {
    if (typeof params.name !== 'string' || !params.name) {
      return { status: 200, body: rpcError(id, -32602, 'A tool name is required.') };
    }
    if (params.arguments !== undefined &&
        (!params.arguments || typeof params.arguments !== 'object' || Array.isArray(params.arguments) ||
         Object.keys(params.arguments).length > 0)) {
      return { status: 200, body: rpcError(id, -32602, 'This read-only tool accepts no arguments.') };
    }

    let value;
    switch (params.name) {
      case 'aegis_get_status':
        value = statusSnapshot();
        break;
      case 'aegis_list_modules':
        value = { modules: listModules() };
        break;
      case 'aegis_list_skills':
        value = { skills: listSkills() };
        break;
      default:
        return { status: 200, body: rpcError(id, -32601, 'Unknown tool: ' + params.name) };
    }
    return { status: 200, body: toolResult(id, value) };
  }

  return { status: 404, body: rpcError(id, -32601, 'Method not found: ' + method) };
}

export async function handleMcpRequest(request, env) {
  if (!env || (
    !(typeof env.AEGIS_MCP_TOKEN === 'string' && env.AEGIS_MCP_TOKEN.length >= 32) &&
    !(typeof env.AEGIS_SESSION_SECRET === 'string' && env.AEGIS_SESSION_SECRET.length >= 32)
  )) {
    return json({ error: 'AEGIS Bridge authentication is not configured.' }, 503);
  }

  if (!originIsAllowed(request)) return json({ error: 'Origin is not allowed.' }, 403);
  if (!(await isBridgeAuthorized(request, env))) {
    return json({ error: 'Authentication required.' }, 401, { 'WWW-Authenticate': 'Bearer' });
  }

  const contentType = request.headers.get('Content-Type') || '';
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
    return json({ error: 'Content-Type must be application/json.' }, 415);
  }
  const accept = request.headers.get('Accept') || '';
  if (!accept.includes('application/json') || !accept.includes('text/event-stream')) {
    return json({ error: 'Accept must include application/json and text/event-stream.' }, 406);
  }

  const declaredLength = Number(request.headers.get('Content-Length') || 0);
  if (declaredLength > MAX_BODY_BYTES) return json({ error: 'Request body is too large.' }, 413);
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return json({ error: 'Request body is too large.' }, 413);
  }

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(rpcError(null, -32700, 'Parse error.'), 400);
  }

  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      body.jsonrpc !== '2.0' || typeof body.method !== 'string' ||
      !Object.prototype.hasOwnProperty.call(body, 'id') ||
      !(typeof body.id === 'string' || (typeof body.id === 'number' && Number.isFinite(body.id)))) {
    return json(rpcError(body?.id, -32600, 'Invalid JSON-RPC request.'), 400);
  }

  const headerMethod = request.headers.get('Mcp-Method');
  if (!headerMethod || headerMethod !== body.method) {
    return json(rpcError(body.id, -32600, 'Mcp-Method header does not match the JSON-RPC method.'), 400);
  }

  const protocolHeader = request.headers.get('MCP-Protocol-Version');
  const protocolInBody = body.params?._meta?.[PROTOCOL_META_KEY];
  if (!protocolHeader || protocolHeader !== protocolInBody) {
    return json(rpcError(body.id, -32600, 'MCP-Protocol-Version header does not match request metadata.'), 400);
  }
  if (protocolHeader !== MCP_PROTOCOL_VERSION) {
    return json(rpcError(body.id, -32001, 'Unsupported protocol version.', {
      supportedVersions: [MCP_PROTOCOL_VERSION],
    }), 400);
  }

  if (body.method === 'tools/call') {
    const nameHeader = request.headers.get('Mcp-Name');
    if (!nameHeader || nameHeader !== body.params?.name) {
      return json(rpcError(body.id, -32600, 'Mcp-Name header does not match the requested tool.'), 400);
    }
  }

  const result = await dispatch(body);
  return json(result.body, result.status);
}
