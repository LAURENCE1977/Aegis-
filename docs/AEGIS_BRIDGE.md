# AEGIS Bridge — initial MCP server

## Status

The initial AEGIS Bridge server is an authenticated, stateless, read-only MCP endpoint exposed at `POST /mcp`. It implements the MCP `2026-07-28` Streamable HTTP request shape for discovery and a deliberately small set of tools.

This is a first compatibility slice, not the completed ChatGPT ↔ AEGIS connection. OAuth 2.1 authorisation, client registration/metadata, scoped per-tool grants, durable job submission, resources/prompts, subscriptions and external connector management are not implemented yet.

## Supported protocol operations

- `server/discover` — reports the supported protocol version, server identity and tool capability.
- `tools/list` — lists the stable initial tool catalogue.
- `tools/call` — invokes one of the read-only tools below.

Initial tools:
- `aegis_get_status` — reports implemented and planned AEGIS capabilities.
- `aegis_list_modules` — returns the descriptive module registry.
- `aegis_list_skills` — returns the skill registry and provenance.

No write, deployment, credential, shell, code execution or arbitrary repository tools are exposed. Module/skill declarations do not grant permissions.

## Authentication

The endpoint accepts either:
1. A bearer token matching the encrypted Cloudflare secret `AEGIS_MCP_TOKEN` (minimum 32 characters), or
2. A valid existing AEGIS browser session cookie signed with `AEGIS_SESSION_SECRET`.

For a remote MCP client, configure a unique high-entropy `AEGIS_MCP_TOKEN` directly as a Cloudflare Pages encrypted secret for the relevant environment. Never put the token in source control, browser code, logs, screenshots or chat. Rotate it if exposed.

The static bearer secret is an interim private integration credential. It is **not** an OAuth 2.1 authorisation server and does not provide per-client identity, scopes, dynamic revocation or per-tool grants. Do not distribute one shared token broadly. OAuth 2.1/PKCE and scoped credentials are a required next phase before broad multi-client or third-party exposure.

## Transport and security behavior

- Uses the current stateless Streamable HTTP protocol revision `2026-07-28`.
- Requires `MCP-Protocol-Version`, `Mcp-Method`, and for `tools/call`, `Mcp-Name` headers.
- Requires both `application/json` and `text/event-stream` in `Accept`.
- Validates protocol version metadata against the HTTP header.
- Rejects a present, invalid or cross-origin `Origin` header.
- Requires authentication before parsing or dispatching tool requests.
- Enforces a 64 KiB request-body limit.
- Returns no-store JSON responses and does not enable permissive CORS.
- Does not implement legacy `initialize` handshakes, MCP sessions, GET streams, or client notifications over this modern HTTP transport revision.

The server permits requests without an `Origin` header because server-to-server MCP clients commonly omit it; bearer authentication remains mandatory unless a valid AEGIS session is supplied.

## Endpoint example

```http
POST /mcp
Content-Type: application/json
Accept: application/json, text/event-stream
MCP-Protocol-Version: 2026-07-28
Mcp-Method: server/discover
Authorization: Bearer <configured-token>

{
  "jsonrpc": "2.0",
  "id": "discover-1",
  "method": "server/discover",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientInfo": {
        "name": "example-client",
        "version": "1.0.0"
      },
      "io.modelcontextprotocol/clientCapabilities": {}
    }
  }
}
```

For `tools/call`, also send `Mcp-Name` with the exact tool name and include the same name in `params.name`.

## Verification

The behavior is covered by `tests/bridge.test.mjs`. The repository CI workflow runs `node --test tests/*.test.mjs` on Node.js 22 for feature branches and pull requests. A passing CI run and a successful Cloudflare preview are required before calling this implementation verified.

## Next phases

1. Add OAuth 2.1/PKCE authorization and per-client credential lifecycle.
2. Add explicit scopes and an auditable approval/grant model.
3. Add stable, attributed resources for project status and approved knowledge.
4. Add durable job submit/status/result tools only after the job runtime exists.
5. Add controlled outbound MCP client connectors and provider adapters.
6. Add interoperability tests against official MCP SDK clients and current protocol conformance tooling.
