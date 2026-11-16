# AEGIS Sentinel D1 composition root

## Purpose

`createSentinelDependencies` is the trusted server-side composition root that binds the existing persistent capability repositories to `runSentinelInvocation`. It is deliberately a library module, not an HTTP endpoint.

## Store bindings

The factory accepts one D1-compatible database binding and composes:

- `loadCapabilityGrant` for exact principal/capability/version/resource grants.
- `loadConnection` for exact principal/provider connections.
- `loadApproval` for approved, unused, unexpired exact invocation approvals.
- `consumeApproval` for atomic one-time consumption of the same approval binding.
- `recordCapabilityAudit` for append-only, redacted invocation events.

A trusted clock is injected for deterministic tests. The factory fails during construction if the database, clock or adapter registry is missing or malformed.

## Adapter boundary

Adapters are supplied by trusted server-side code as a fixed map keyed by `capabilityId:actionId`. The factory copies this map and rejects entries unless the key identifies an approved manifest and a declared action in the trusted capability registry.

At execution time:
- Dispatch uses only the exact registered capability/action pair.
- Manifest URLs, endpoint values, interface paths, user input and agent-provided tool names are never interpreted as destinations.
- Unknown adapter keys fail closed.
- The adapter receives a frozen, minimal context. It contains no vault secret, secret reference, arbitrary endpoint or path.
- The factory does not resolve credentials. A future authenticated adapter must resolve a secret only after Sentinel policy approval, using the exact owner/provider connection and the vault's principal/connection binding.

## First built-in adapter

`createBuiltinAdapterRegistry` currently supplies one local-only adapter: `aegis-module-catalogue:list`. It returns the descriptive module catalogue, rejects all non-empty input, and performs no network, filesystem, secret or process operations. The adapter is tested both directly and through the Sentinel composition root. A single owner-authenticated route now exposes only this empty-input read-only action; it is not a general capability endpoint.

## Current limitations

A source-level owner-authenticated `POST /api/sentinel/invoke` route exists, but it is not deployed or operational until the AEGIS D1 binding and migrations are provisioned. It accepts exactly `aegis-module-catalogue:list` on resource `aegis:modules` with empty input, derives the digest server-side, requires an active exact grant, and returns output only after the success audit is recorded. It exposes no arbitrary adapter, URL, provider, shell, browser or write operation. There is no production D1 database or deployed invocation service.

## Required next steps before enabling execution

1. Validate migrations 0001–0005 in an isolated, disposable D1 database and add migration/integration coverage.
2. Finish local migration verification, then provision the AEGIS D1 binding only after owner approval. The owner-only grant API is source-integrated; browser input never supplies the owner identity or grant scopes. Connection lifecycle operations still need an owner-authenticated interface.
3. Implement one narrowly scoped, read-only first-party adapter with bounded input/output and fixed host allowlisting.
4. Add outbound network controls: no redirects to unapproved hosts, private/link-local/loopback addresses or DNS rebinding; enforce request size, timeout, rate and response-size limits.
5. Keep the fixed read-only route under tests; verify that outcome-audit failure never returns adapter output.
6. Add a separately reviewed non-production deployment only after local D1 migrations and binding configuration are verified.

Write, delete, arbitrary shell, arbitrary HTTP, arbitrary MCP, browser automation and self-modifying tool execution remain disabled.
