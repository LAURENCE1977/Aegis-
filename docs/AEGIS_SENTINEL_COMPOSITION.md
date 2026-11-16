# AEGIS Sentinel D1 composition root

## Purpose

`createSentinelDependencies` binds the persistent capability repositories to the single Sentinel mediation function. It is a server-side library, not an HTTP endpoint. Browser clients, model output and specialist plans must never construct or supply this dependency object.

## Persistent stores

The composition root wires:

- exact principal/capability/version/resource grant lookup;
- principal/provider connection lookup;
- approved, unconsumed, unexpired exact-operation approval lookup;
- atomic one-time approval consumption;
- append-only redacted invocation audit;
- trusted capability manifest lookup.

A trusted clock is injectable for deterministic tests. The adapter registry is fixed by server-side code and checked at construction against approved capability manifests and declared actions.

## Adapter boundary

Adapters are registered by the exact `capabilityId:actionId` pair. Manifest URLs, request endpoints, interface paths, model output and user-provided tool names are never used as adapter destinations. Unknown adapter keys fail closed. Adapters receive a frozen minimal context containing invocation identity, principal, capability/action, resource, granted scopes, connection ID and payload digest. No secret value or vault reference is passed in that context.

The first built-in adapter is `aegis-module-catalogue:list`. It reads the local descriptive module catalogue, accepts only an empty input object and performs no network, filesystem, secret or process operations.

## Payload and approval binding

The trusted caller must validate the exact input against the adapter's schema, canonicalize and digest that validated payload with `digestCanonicalInput`, and pass the same unchanged payload and digest to `runSentinelInvocation`. It must never accept a digest from the browser, model or agent. Sentinel then checks the exact grant, connection and approval, records the pre-execution audit, atomically consumes a human-always approval, and only then invokes the fixed adapter.

## Explicitly not implemented

- No public invocation route or agent-to-tool bridge.
- No automatic secret resolution or credential exposure.
- No arbitrary HTTP, MCP, browser, shell, filesystem or computer-use adapter.
- No production D1 migration or Worker deployment.
- No paid provider or external side-effect execution.

Before adding an external adapter, implement its strict input/output schema, secret resolution after authorization, host and egress allowlists, DNS rebinding/SSRF protections, timeout and response-size caps, cancellation, idempotency and outcome audit. Consequential actions remain human-approved. A plan, capability manifest or connection record is never itself permission to execute.
