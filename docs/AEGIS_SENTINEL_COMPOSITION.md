# AEGIS Sentinel composition and execution boundaries

## Purpose

`createSentinelDependencies` is the trusted server-side composition root that binds the persistent capability repositories to `runSentinelInvocation`. Only the explicitly listed Pages Functions expose it to an authenticated owner.

## Persistent stores

The factory composes one D1-compatible binding with exact grant, connection and approval lookups, atomic approval consumption, atomic rate-limit reservation and append-only redacted invocation audit writes.

## Adapter boundary

Adapters are supplied by trusted server-side code as a copied fixed map keyed by `capabilityId:actionId`. Registration is rejected unless the key maps to an approved capability and declared action in the trusted registry.

- Dispatch uses only the exact registered capability/action pair.
- Manifest URLs, interface paths, request fields and agent-provided tool names are never interpreted as adapter destinations.
- Unknown adapter keys fail closed.
- Handlers receive a frozen minimal context.
- No vault secret or secret reference is passed by the composition root.
- Arbitrary shell, browser, MCP, HTTP, write, delete and self-modifying adapters remain disabled.

## Built-in adapters

### AEGIS module catalogue

`aegis-module-catalogue:list` returns descriptive module metadata locally. It accepts only an empty object and has no network, filesystem, process or secret access.

### Public GitHub repository metadata

`aegis-github-public-discovery:discover` returns public repository metadata only.

- Exactly one `sourceUrl` input field.
- Canonical HTTPS `github.com/{owner}/{repository}` URLs only.
- The route derives the exact resource ID as `github:public:{owner}/{repository}`; the caller cannot choose the grant target.
- API requests are pinned to `https://api.github.com`; redirects are rejected.
- Five-second timeout and 64 KiB streamed response limit.
- Private repositories and source-file reads are not included.
- Atomic per-principal/action rate limit: 30 requests per minute from the capability manifest.

## Owner-facing routes

### `POST /api/sentinel/invoke`

Exposes only the empty-input local module catalogue. Requires an owner session, same-origin request, configured D1 and an active exact grant for `aegis:modules`.

### `POST /api/sentinel/github-discover`

Exposes only the fixed public GitHub metadata adapter. Requires an owner session, same-origin request, configured D1 and an active grant for the exact repository resource `github:public:{owner}/{repository}`.

The input digest and resource identity are computed server-side. Sentinel performs policy, atomic rate-limit reservation, audit and fixed adapter dispatch. Exhausted budgets return 429; rate-limit store failure returns 503. The Forge panel has an explicit manual button; it does not auto-run or create grants.

The existing Forge source-inspection workflow is a separate user-initiated read-only feature. It does not run code or expose arbitrary agent tool routing.

### `/api/grants`

The owner-only grant API lists bounded grant history, creates grants from approved capability/action selections and revokes active grants. Principal, creator, version and scopes are derived server-side.

## D1 migration verification

GitHub Actions uses a separate `wrangler.d1-test.toml` and explicit `--local` commands to apply migrations 0001–0006 to a disposable local D1 database. CI smoke-inserts into the capability tables, verifies the active-grant unique index, append-only audit triggers, and performs three rate-limit upserts against a limit of two.

This is local test evidence only. No remote or production D1 database has been provisioned or migrated.

## Current limitations

- The preview environment has no configured authentication secrets, so owner-only Security Centre routes cannot be entered there.
- No production D1 binding, vault keyring or provider connection has been provisioned.
- No private GitHub access, OAuth connection, source execution, MCP, browser automation, shell, write or delete adapter is exposed.
- The generic agent-to-tool router is not enabled; the two Sentinel routes are fixed, narrow capabilities only.
- A non-production deployment and full operational verification remain outstanding.

Keep generic tool routing disabled until every new adapter has its own exact manifest, grants, rate limits, egress policy and integration tests.
