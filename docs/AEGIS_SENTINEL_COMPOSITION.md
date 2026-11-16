# AEGIS Sentinel composition and execution boundaries

## Purpose

`createSentinelDependencies` is the trusted server-side composition root that binds the persistent capability repositories to `runSentinelInvocation`. It is a library module; only the explicitly listed Pages Functions expose it to an authenticated owner.

## Persistent stores

The factory composes one D1-compatible binding with:

- Exact principal/capability/version/resource grant loading.
- Principal/provider connection loading.
- Exact approved, unused and unexpired approval loading.
- Atomic one-time approval consumption.
- Append-only, redacted invocation audit writes.

A trusted clock is injected for deterministic tests. Construction fails if the database, clock or adapter registry is missing or malformed.

## Adapter boundary

Adapters are supplied by trusted server-side code as a copied fixed map keyed by `capabilityId:actionId`. Registration is rejected unless the key maps to an approved capability and declared action in the trusted registry.

At execution time:

- Dispatch uses only the exact registered capability/action pair.
- Manifest URLs, interface paths, request fields and agent-provided tool names are never interpreted as adapter destinations.
- Unknown adapter keys fail closed.
- Handlers receive a frozen minimal context with principal, capability/version, action, exact resource, granted scopes, connection ID and input digest.
- No vault secret or secret reference is passed to adapters by the composition root.
- No arbitrary shell, browser, MCP, HTTP, write, delete or self-modifying adapter is registered.

## Built-in adapters

### AEGIS module catalogue

`aegis-module-catalogue:list` returns descriptive module metadata locally. It accepts only an empty object and has no network, filesystem, process or secret access. It is exposed through the restricted owner invocation route below.

### Public GitHub repository metadata

`aegis-github-public-discovery:discover` is implemented in the adapter registry but is **not yet exposed by a Sentinel route**.

Its current protections are:

- Exactly one `sourceUrl` input field.
- Canonical HTTPS `github.com/{owner}/{repository}` URLs only.
- API requests pinned to `https://api.github.com`; no user-supplied endpoint.
- Redirects rejected.
- Five-second request timeout.
- Streamed response limit of 64 KiB.
- Public repository metadata only; private repositories and source-file reads are not included.

The atomic per-principal/action rate limiter is now mandatory in Sentinel and is backed by D1 migration 0006. Before exposing this adapter, wire and test the exact-resource grant path for `github:repo:{owner}/{repository}` and add the owner-facing route. The existing Forge manual discovery route is separate from agent/tool adapter execution.

## Owner-facing routes

### `POST /api/sentinel/invoke`

This route exposes exactly one action: the empty-input, local read-only module catalogue. It requires a valid owner session, same-origin request, configured D1 binding and an active exact grant for principal `owner`, capability `aegis-module-catalogue`, action `list`, resource `aegis:modules`.

The input digest is computed server-side. The route calls `runSentinelInvocation` through the trusted composition root and returns the audited invocation ID, safe output and audit status. It cannot select another adapter, provider, URL, MCP server, shell command, browser action, write or delete operation.

The Security Centre provides a manual button. It does not auto-run or create permissions.

### `/api/grants`

The owner-only grant API lists bounded grant history, creates grants from approved capability/action selections and revokes active grants. Principal, creator, version and scopes are derived server-side. The browser cannot submit arbitrary scopes or another principal.

## D1 migration verification

GitHub Actions uses a separate `wrangler.d1-test.toml` and explicit `--local` commands to apply capability migrations 0001–0006 to a disposable local D1 database. CI smoke-inserts into the five capability tables and verifies:

- The active-grant unique index rejects duplicate active grants.
- The invocation-audit UPDATE trigger rejects mutation.
- The invocation-audit DELETE trigger rejects deletion.
- The rate-limit bucket accepts only the configured number of atomic reservations.

This is local test evidence only. No remote or production D1 database has been provisioned or migrated.

## Current limitations and next steps

- The preview environment has no configured authentication secrets, so the owner-only Security Centre cannot be entered there.
- No production D1 binding, vault keyring or provider connection has been provisioned.
- The public GitHub adapter is implemented but not reachable through a Sentinel route; rate limiting and exact-resource invocation wiring remain outstanding.
- Connection lifecycle and encrypted-secret entry/revocation routes remain to be built and reviewed.
- The route and adapter stack needs a non-production end-to-end deployment only after source review, local D1 checks and explicit configuration.

Do not enable generic tool routing. Keep arbitrary HTTP, MCP, browser automation, shell execution, write/delete operations and self-modifying tools disabled.
