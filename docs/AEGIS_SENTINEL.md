# AEGIS Sentinel

**Status:** First enforcement library slice under review in PR #23. Not deployed and not yet wired to a provider adapter or invocation API.

## Purpose

Sentinel is the final AEGIS policy gate between an agent's proposal and an adapter's side effect. Agents can request capabilities; they cannot grant themselves access, mint approvals, alter operation bindings or bypass Sentinel.

## Invocation sequence

1. Resolve the exact capability ID and immutable registered manifest version.
2. Resolve the requested action from that manifest.
3. Canonicalize the complete operation input and compute its SHA-256 digest on the server. Callers must not supply the digest.
4. Evaluate the manifest, principal, action, resource, active grant, required scopes, connection ownership/status, budget and approval state. Unknown or mismatched state is denied.
5. For human-always actions, load the approval record from AEGIS storage and compare its binding with the current operation.
6. Atomically consume the approval using a conditional database update immediately before handing control to an adapter.
7. Only then may a separately governed invocation runtime call the adapter and record its outcome.

## First implementation slice

functions/lib/sentinel.mjs provides deterministic canonical JSON hashing with complexity/size limits and authorizeSentinelInvocation. It delegates policy evaluation to the existing pure evaluator and approval consumption to the existing atomic D1 primitive. getApprovalRequest provides the server-side approval lookup.

The gate returns a decision and digest for internal use. It does not execute tools, fetch URLs, run shell/code, resolve secrets, or perform external writes. The digest is never accepted from a browser or agent.

## Security boundaries and remaining work

- A successful gate decision is not itself a provider execution. The caller must keep the adapter unreachable until Sentinel returns allowed: true.
- The adapter must receive the exact same normalized operation that was hashed; do not reconstruct or mutate arguments after authorization.
- The operation summary shown to the owner must be derived server-side from validated action data and must not conceal material parameters.
- Grant/connection retrieval must be server-authoritative and revalidated at invocation time. Current gate accepts those snapshots as internal inputs; persistent grant and connection lifecycle are not yet integrated.
- The next slice must add an append-only invocation decision/audit record and a single controlled invocation boundary, still with no arbitrary shell or generic URL execution.
- Add explicit cancellation, timeout, idempotency and uncertain-outcome reconciliation before enabling retryable external writes.
- Approval consumption is one-time. If an adapter fails after consumption, do not silently re-use the approval; require a new review or a specifically designed safe recovery protocol.
- No broad write capability may be enabled until real D1 integration tests prove atomic consume/replay behavior and the approval UI shows the exact operation.

## Verification

The PR adds focused tests for stable digests, invalid JSON inputs, missing grants, exact grants, one-time approval consumption, replay denial, changed-payload denial and missing approval denial. CI status must be checked against the exact PR head before describing these tests as passing. No production deployment or D1 migration application is included.
