# AEGIS Intelligence & Token Engine

## Status

The first provider-independent planning slice is implemented in `functions/lib/intelligence-engine.mjs` on PR #33. It is a pure library and is not yet wired into chat, AG-UI, the durable agent queue or a provider adapter. No model calls are routed through it yet.

## Current functions

- `estimateTokenCount(text)`: conservative UTF-8 byte-length heuristic (one token per four bytes, rounded up). This is for budgeting only, not an exact tokenizer. Actual provider usage must replace estimates when usage metadata is returned.
- `selectModelRoute(...)`: selects a model from a trusted server-side catalogue using task compatibility, context window, output limit, estimated cost, priority and provider quota/availability.
- `fitMessagesToContext(messages, maxInputTokens)`: keeps the system instruction and newest complete messages that fit a supplied input budget. It never slices a message mid-text and fails if the system instruction or newest message cannot fit.

## Free-only routing guard

`selectModelRoute` accepts optional `maxInputCost` and `maxOutputCost` constraints. When either cap is supplied, a model must have verified values for both input and output pricing to remain eligible. Setting both caps to `0` therefore selects only explicitly zero-cost models; missing price metadata is never treated as proof of free usage. Without a cost cap, an unpriced model may remain eligible, but its `estimatedCost` is returned as `null` and it ranks behind models with known prices.

This is a policy/planning safeguard only. It does not verify provider invoices, enforce a durable spend ledger, or activate automatic failover. The planner is still not wired into AG-UI or the live model adapter.

## Design boundaries

- The model catalogue is trusted configuration, not data that can supply arbitrary URLs or executable adapter code.
- Provider state and remaining-token quotas must come from trusted server-side health/quota observations. If provider state is supplied, missing, disabled or unknown providers are ineligible.
- No provider credentials, headers, endpoint URLs or secret values are returned by the planner.
- Provider adapters remain responsible for fixed/allowlisted endpoints, authentication, redirect rejection, deadlines, response validation and Sentinel policy.
- Model context windows are provider/model-specific. A million-token route is only possible when a real provider model advertises and supports that context size and the adapter can transmit it; the planner does not create that capacity.
- Token estimates are approximate. The engine must reconcile them against provider-reported usage whenever available.

## What this does not do yet

- No free-model catalogue ingestion or provider verification.
- No persistent token ledger, quota reservation, usage reconciliation, spend cap or cross-request budget enforcement.
- No automatic retry/failover execution.
- No new model providers, credentials or API calls.
- No integration with the existing Workers AI / Qwen streaming adapter.
- No D1 migration, deployment or production change.

## Next implementation stages

1. **Trusted model/provider registry:** versioned provider and model metadata, evidence/provenance, verified context/output limits, licence/terms and last-checked time. External catalogues may suggest candidates but may not define arbitrary endpoints.
2. **Durable token accounting:** D1 usage ledger with owner/project/provider/model attribution, estimated vs actual usage, idempotency, reservation/reconciliation, daily/monthly ceilings and append-only audit.
3. **Adapter integration:** route the existing Workers AI and Qwen paths through the policy engine without changing current default behavior until verified.
4. **Free-tier discovery:** ingest public catalogue data as untrusted candidates, verify each provider against official docs/terms and keep quotas explicitly time-stamped.
5. **Failover and local inference:** bounded retries, circuit breakers and optional local model adapters where the host/device can support them.

## Verification

PR #33 uses Node.js built-in tests. The first test-only commit intentionally produced a failing CI run (RED). The implementation commit then passed the repository's full Node.js 22 suite: GitHub Actions run 43754887238, 0 failures. The library currently has six focused tests covering estimation, routing, quota exhaustion, context rejection, context fitting and malformed inputs.
