# Composio Bridge — AEGIS Integration Hub foundation

## Purpose

AEGIS can use Composio as a provider-neutral directory and authenticated execution broker for connected services. Composio retains provider credentials; AEGIS stores only its own Composio project API key as an encrypted Cloudflare runtime secret and an opaque Composio user/entity ID.

Official API references:
- https://docs.composio.dev/reference/v3/api-reference/connected-accounts
- https://docs.composio.dev/reference/v3/api-reference/tools
- https://docs.composio.dev/reference/v3/authentication

## Implemented in this slice

- Server-only Composio API adapter with a fixed Composio API origin.
- Read-only connected-account listing scoped to one configured Composio user ID.
- Safe metadata projection: only connection ID, toolkit slug and status leave the adapter. Provider credential/state fields are discarded.
- A small, explicit allowlist of read-only tool slugs and strict per-tool input validation in the adapter.
- Before any allowlisted tool execution, the adapter re-lists accounts and requires the exact selected connection to be ACTIVE and to match the expected toolkit.
- Redirects are rejected, requests have a bounded timeout, responses are size-limited and provider error bodies are not returned.
- Owner-authenticated, no-store GET /api/integrations reports connection metadata only.
- The endpoint reports executionEnabled: false. The adapter's execution method is not exposed to browser or agent callers in this slice.

## Required encrypted runtime configuration

Configure these only as Cloudflare Pages encrypted secrets/variables for the AEGIS Preview environment first:
- COMPOSIO_API_KEY — a Composio project API key, not an organization-wide key.
- COMPOSIO_USER_ID — the stable Composio entity/user ID used for the AEGIS owner.

Do not put either value in source control, browser code, ordinary variables, logs, chat messages or screenshots. Do not reuse a provider API key here. The AEGIS API adapter sends x-api-key only from the server runtime.

The Composio project must be the same project that owns the connected accounts intended for AEGIS. Existing ChatGPT/Composio connector sessions are not automatically inherited by a separately hosted AEGIS application. AEGIS must be explicitly configured with the matching Composio project API key and user ID. Do not assume that dashboard-created connections are visible to an unrelated Composio project.

## Current security boundary

This is a connection-status bridge, not yet a general-purpose tool router. No public endpoint can execute Composio tools. The internal adapter has a narrow read-only allowlist for future Sentinel integration, but it must not be wired into a route or agent until:
1. Composio connection records are reconciled with AEGIS's persistent connection registry.
2. Exact capability manifests, owner grants, Sentinel checks, atomic rate limits and durable invocation audit cover each tool.
3. Connection ownership and toolkit identity are checked server-side.
4. Tool schemas and toolkit versions are pinned and contract-tested.
5. An owner-reviewed preview demonstrates the full flow without writes or paid actions.

Never expose Composio's arbitrary tool catalogue as an executable tool to an agent. Never accept a provider URL, arbitrary tool slug, connection ID or scope from an untrusted model prompt without server-side allowlist and policy validation.

## Activation and verification

1. Add the two encrypted values to the AEGIS Pages Preview environment.
2. Deploy the feature branch preview through the existing GitHub → Cloudflare Pages integration.
3. Sign into the preview and open GET /api/integrations through the authenticated application session.
4. Verify only expected connection IDs, toolkit slugs and statuses appear. No secret values or raw provider state should be returned.
5. Do not add production secrets, merge, or enable tool execution until the owner explicitly approves the next stage.

If either configuration value is absent or the Composio API is unavailable, the endpoint fails closed with a generic 503 response.