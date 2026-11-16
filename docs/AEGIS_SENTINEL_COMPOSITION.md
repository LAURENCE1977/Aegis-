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

`createBuiltinAdapterRegistry` currently supplies one local-only adapter: `aegis-module-catalogue:list`. It returns the descriptive module catalogue, rejects all non-empty input, and performs no network, filesystem, secret or process operations. The adapter is tested both directly and through the Sentinel composition root. It remains unreachable from a public invocation route until the D1 and route prerequisites below are met.

## Current limitations

This is not yet wired to a public route or a deployed Worker. The current capability registry includes descriptive capabilities, but there is not yet a production adapter implementation or a live D1 database. No user or agent can invoke this composition root through the deployed site.

## Required next steps before enabling execution

1. Validate migrations 0001–0005 in an isolated, disposable D1 database and add migration/integration coverage.
2. Add owner-authenticated grant and connection lifecycle operations. Browser input must never supply the owner identity, scopes beyond an approved allowlist, vault references or secret values.
3. Implement one narrowly scoped, read-only first-party adapter with bounded input/output and fixed host allowlisting.
4. Add outbound network controls: no redirects to unapproved hosts, private/link-local/loopback addresses or DNS rebinding; enforce request size, timeout, rate and response-size limits.
5. Test the full request → authentication → exact grant → policy → pre-execution audit → adapter → outcome audit path.
6. Only then consider a non-production route and a separately reviewed deployment.

Write, delete, arbitrary shell, arbitrary HTTP, arbitrary MCP, browser automation and self-modifying tool execution remain disabled.
