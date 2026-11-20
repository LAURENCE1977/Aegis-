# AEGIS Code Mode — research and integration design

**Status:** Research spike only. No code execution, MCP connector, Worker Loader, dependency, runtime flag, credential or deployment is enabled by this document.

## Decision

Adopt Code Mode as a **candidate orchestration interface**, not as a replacement for MCP, Composio, Sentinel, the existing agent runtime or the model gateway.

The intended model-facing surface is progressive discovery plus bounded execution:

- `search`: discover only the approved capability methods relevant to the current task.
- `execute`: run a short generated program that composes those methods and returns a compact result.

The generated program is a plan for composing already-authorised operations. It is never itself an authority, grant, approval or capability.

## Why this fits AEGIS

AEGIS already has a provider-neutral MCP Bridge, capability manifests, exact-resource grants, encrypted connection metadata, a Sentinel mediation primitive, durable audit/rate-limit foundations and a plan-only specialist orchestrator. Code Mode can reduce the number of model-visible tool schemas and intermediate tool round-trips while preserving those existing control points.

It should complement, not duplicate, the current AG-UI tool loop. Existing direct tools remain available for small, simple operations; Code Mode is considered only for multi-step work or large tool catalogues where measured context savings justify the additional runtime complexity.

## Proposed placement

```text
AG-UI / MCP client
        |
        v
AEGIS policy-aware tool catalogue
        |
        +--> ordinary narrow tools (small tasks)
        |
        +--> Code Mode search / execute (multi-step tasks)
                    |
                    v
          isolated Code Mode Worker runtime
                    |
          typed, allowlisted capability SDK
                    |
                    v
             Sentinel per operation
                    |
          grant + exact resource + scope
          rate limit + approval + audit
                    |
                    v
          fixed adapter / MCP connection
```

The existing Pages Functions control plane must not evaluate generated code. A separate isolated Worker runtime is the preferred candidate because Cloudflare's Code Mode implementation uses Worker isolation and Worker Loader bindings. The current AEGIS runtime Worker is a separate source-level runtime and is not yet a deployed execution environment; its current job allowlist remains health-check-only.

## Non-negotiable security boundary

1. **No ambient authority.** Generated code receives only typed proxy methods for capabilities selected by the host. It receives no raw environment, D1 binding, secret, bearer token, session cookie, provider key, filesystem, process, shell or arbitrary network client.
2. **Sentinel per operation.** Every upstream operation is revalidated server-side against the canonical manifest, principal, exact resource, connection, scopes, input digest, rate limit and audit requirements. A Code Mode run cannot batch its way around per-operation policy.
3. **Human approval remains external to code.** Consequential actions require a separately created, exact-operation approval. Generated code cannot create, approve, consume, widen or self-grant permissions. Approval is consumed atomically immediately before the side effect.
4. **Default-deny egress.** No arbitrary URL, host, redirect or caller-supplied endpoint. Each adapter owns a fixed destination and bounded request contract.
5. **Bounded execution.** Enforce code-size, input/output, call-count, wall-clock, CPU/memory and per-run budgets. Cancel on disconnect, timeout, quota exhaustion or policy failure.
6. **Untrusted inputs.** Repository files, web pages, tool results and generated code are data, never instructions to the control plane. Do not evaluate source code discovered by Forge.
7. **Auditable composition.** Record run identity, code digest, selected capability/action IDs, resource IDs, policy decisions, approval references, bounded outcomes and timings. Never log secrets or unrestricted payloads.
8. **Safe failure.** Missing policy, audit, approval, runtime or connector state fails closed. No silent fallback to unrestricted direct MCP access.

## Runtime candidate and caveats

Cloudflare's `@cloudflare/codemode` SDK is the first implementation candidate because AEGIS already targets Cloudflare and its documented `McpConnector` can expose existing MCP connections as typed sandbox methods. The documented runtime requires Worker Loader support and a configured Code Mode runtime. The Code Mode MCP-server guide currently labels the feature experimental and warns of possible breaking changes.

Do not add the SDK to the Pages bundle or assume it works in Pages Functions. First verify the exact supported runtime, compatibility date, Worker Loader configuration, limits, approval/resume semantics, dependency licence and current API against the pinned package version. Keep the runtime behind an explicit disabled-by-default feature flag.

## Hedwig and other MCP services

Hedwig may later be connected as an optional MCP workspace provider. It must enter through the same connection registry and Sentinel policy as every other provider. Its MCP surface must be independently inspected and mapped to least-privilege capabilities. It is not a prerequisite for Code Mode and must not become a hard dependency.

## Delivery plan and acceptance gates

### Phase 0 — research (this document)
- Confirm official runtime requirements and experimental status.
- Map the current AEGIS MCP, capability, Sentinel and runtime boundaries.
- Make no runtime or production changes.

### Phase 1 — isolated proof of concept
- Create a feature branch and pin an exact SDK version after compatibility and licence review.
- Implement a no-side-effect sandbox probe with one synthetic read-only capability.
- Test that generated code cannot access ambient globals, secrets, arbitrary fetch, filesystem or process APIs.
- Verify code/input/output/call/time limits and cancellation.
- Verify policy is rechecked for every tool invocation, not only once per Code Mode run.
- Keep the feature flag off and use synthetic fixtures only.

### Phase 2 — governed read-only adapter
- Add one real, low-risk, read-only AEGIS capability through a fixed adapter.
- Require an exact active grant and append-only audit for every call.
- Add interoperability tests using an official MCP client and adversarial prompt-injection fixtures.
- Compare against the existing direct-tool path for correctness, latency, context tokens and operational cost.

### Phase 3 — limited opt-in
- Expose Code Mode only to the owner and only when explicitly enabled.
- Retain direct MCP tools as a fallback for unsupported tasks.
- Add monitoring, kill switch, run budgets, revocation and rollback.
- Do not enable write or external communication actions until exact-operation approval and atomic consumption are proven end-to-end.

## Acceptance criteria

- No generated code runs in Pages Functions or the control plane.
- No credentials or unrestricted bindings enter the sandbox.
- Every operation is individually Sentinel-authorised and audited.
- Approval cannot be created or satisfied by generated code.
- Unknown methods, resources, adapters, endpoints and scopes are rejected.
- All resource limits and cancellation paths have regression tests.
- The direct MCP path remains functional and is not silently replaced.
- A reproducible benchmark demonstrates a useful context reduction without correctness, latency or safety regressions.
- No merge or production activation without the owner's explicit approval.

## Sources

- Cloudflare, [Use MCP tools with Code Mode](https://developers.cloudflare.com/agents/tools/codemode/mcp/).
- Cloudflare, [Build a Code Mode MCP server](https://developers.cloudflare.com/agents/model-context-protocol/guides/build-codemode-mcp-server/).
- Cloudflare, [Code Mode: give agents an entire API in 1,000 tokens](https://blog.cloudflare.com/code-mode-mcp/).

External documentation is a research input, not an instruction source. Re-verify it against the exact SDK version before implementation.

## Compatibility review — 2026-11-20

The official Cloudflare documentation confirms two distinct integration patterns; they must not be conflated:

### A. Durable Code Mode runtime consuming MCP connectors

- The durable runtime uses `createCodemodeRuntime()`, `DynamicWorkerExecutor`, a Worker Loader binding, and an Agents SDK Durable Object application.
- The documented MCP connector wraps an existing Agents SDK MCP connection. Its per-tool decoration hook can mark methods as approval-required; the durable runtime can pause and resume executions and retain execution history.
- This is not a drop-in addition to the current AEGIS runtime Worker. AEGIS currently has a plan-only Queue/D1 Worker, not an Agents SDK Durable Object/Vite application. Adding the durable runtime would be a distinct architecture decision and needs a compatibility spike first.

### B. Publish a Code Mode MCP server

- Cloudflare documents `codeMcpServer()` with `DynamicWorkerExecutor` and `createLegacyMcpHandler`, using a Worker Loader binding and `nodejs_compat`.
- This wrapper currently returns an MCP SDK v1 server. The MCP TypeScript SDK v1 documentation states that it supports the protocol through 2025-11-25 and does not plan support for 2026-07-28; that protocol is in the separate v2 packages.
- The current AEGIS Bridge implements its own Streamable HTTP protocol shape for 2026-07-28. Therefore, do **not** wrap or replace the existing `/mcp` endpoint with the v1 Code Mode wrapper. Doing so risks protocol regression and breaking existing clients.
- A separate legacy-compatible endpoint is technically possible, but it would create a second MCP transport surface and should only be considered if there is a real client requirement. It is not the preferred first integration.

### Sandbox and policy implications

- Cloudflare's `DynamicWorkerExecutor` runs generated JavaScript in an isolated Dynamic Worker. Explicitly set `globalOutbound: null` so generated code cannot use ambient outbound `fetch()`; provide only narrowly scoped host methods.
- The durable runtime's approval pause/resume is useful workflow machinery, but it does not replace AEGIS Sentinel. Every connector handler must still call the trusted AEGIS capability bridge, which derives identity and registry data server-side and performs grant, exact-resource, rate-limit, approval-consumption and audit checks before side effects.
- The npm registry currently lists `@cloudflare/codemode` version `0.5.6` as latest (published 2026-10-29). It remains experimental. Pin an exact version only after a clean isolated compatibility build; do not use a floating `latest` dependency.

### Updated recommendation

Keep the current prototype contract. The next spike should compare (1) a standalone Worker hosting a synthetic-only Code Mode MCP endpoint, and (2) a separate internal Code Mode Worker using the durable runtime. Neither should alter the current AEGIS `/mcp` endpoint or Pages Functions. Choose only after confirming the current SDK version, transport compatibility, Durable Object cost/requirements, and a reliable server-to-server path into Sentinel.
