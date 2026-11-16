# Sentinel exact approval lookup

## Contract
`loadApproval(db, binding, now)` returns the newest approved, unconsumed and unexpired approval for the exact tuple:
- principal ID
- capability ID and version
- action ID
- resource ID
- canonical input digest

It returns `null` when there is no exact live match. The stored operation summary and connection ID are returned from the persisted row; callers must not replace them with caller-supplied values.

## Sentinel sequence
1. Load the approved capability manifest from the trusted registry.
2. Load the active principal-scoped grant and, when required, the principal/provider connection.
3. Load an approval for the exact invocation binding.
4. Run the pure policy decision, including exact connection ID matching.
5. Persist the pre-execution audit event.
6. Atomically consume the exact approval with `consumeApproval` immediately before any side effect.
7. Execute only a fixed server-side adapter and record a redacted outcome.

The loader is a lookup, not an authorization decision. It does not consume approvals and must not be exposed as an unauthenticated endpoint. The policy and atomic consume remain mandatory.

## Verification and limits
Node.js 22 tests cover foreign principals, changed digests, consumed/replayed approvals and exact operation binding. This library is not yet wired into a live Worker composition root. No provider call or D1 deployment is enabled.
