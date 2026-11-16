# AEGIS atomic capability rate limiting

## Contract

Migration `0006_invocation_limits.sql` adds `capability_invocation_limits`, keyed by principal, capability, action and UTC minute bucket.

`reserveCapabilityInvocation` performs a conditional SQLite UPSERT:

- First request in a bucket inserts count 1.
- A later request increments only while the current count is below the manifest's `requestsPerMinute`.
- Once the configured limit is reached, the statement returns no row and the invocation is denied.
- The conditional update executes inside D1, so concurrent Workers contend on the same unique key rather than racing through a read-then-write check.
- Old buckets are pruned after 24 hours.

## Sentinel integration

Rate-limit reservation is a mandatory Sentinel dependency. It occurs after the exact grant/connection/approval policy check and before the policy-allowed audit event, approval consumption or adapter execution.

- Exhausted budget: `RATE_LIMITED`, HTTP 429.
- Rate-limit D1 failure: `RATE_LIMIT_STORE_UNAVAILABLE`, HTTP 503.
- Both cases fail closed and attempt to write a redacted denial audit event.
- The adapter is never called when reservation fails.

## Verification

Node tests cover configured limits, principal/capability/action isolation, minute windows, retention cleanup, invalid inputs and store failure. The local D1 CI job applies migrations 0001–0006 and runs a real SQLite upsert smoke test: three reservations against a limit of two leave the count at exactly two.

All D1 verification is local and disposable. No remote D1 resource is changed.
