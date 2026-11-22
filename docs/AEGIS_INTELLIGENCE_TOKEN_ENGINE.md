# AEGIS Intelligence & Token Engine

## Current implementation status (2026-11-22)

- PR #175 strengthens the existing route selector: free-only is the default; unknown-cost models are excluded; paid routes require explicit allow-paid mode and provider approval. The PR is tested but remains unmerged.
- PR #176 adds the first D1 usage ledger foundation: explicit token-versus-Neuron quota windows, idempotent reservations, bounded settlement/release and append-only events. It is stacked on PR #175 and remains unmerged.
- The ledger is not yet connected to the live model adapter. No model call is currently governed by these new reservations, and no quota window is active until trusted server-side configuration creates and verifies it.
- Cloudflare Workers AI Neurons are compute units, not tokens. Never compare or add Neurons and tokens in the same quota bucket.


## Status

The first provider-independent planning slice is implemented in `functions/lib/intelligence-engine.mjs` on PR #33. It is a pure library and is not yet wired into chat, AG-UI, the durable agent queue or a provider adapter. No model calls are routed through it yet.

## Current functions

- `estimateTokenCount(text)`: conservative UTF-8 byte-length heuristic (one token per four bytes, rounded up). This is for budgeting only, not an exact tokenizer. Actual provider usage must replace estimates when usage metadata is returned.
- `selectModelRoute(...)`: selects a model from a trusted server-side catalogue using task compatibility, context window, output limit, estimated cost, priority and provider quota/availability.
- `fitMessagesToContext(messages, maxInputTokens)`: keeps the system instruction and newest complete messages that fit a supplied input budget. It never slices a message mid-text and fails if the system instruction or newest message cannot fit.

## Design boundaries

- The model catalogue is trusted configuration, not data that can supply arbitrary URLs or executable adapter code.
- Provider state and remaining-token quotas must come from trusted server-side health/quota observations. If provider state is supplied, missing, disabled or unknown providers are ineligible.
- No provider credentials, headers, endpoint URLs or secret values are returned by the planner.
- Provider adapters remain responsible for fixed/allowlisted endpoints, authentication, redirect rejection, deadlines, response validation and Sentinel policy.
- Model context windows are provider/model-specific. A million-token route is only possible when a real provider model advertises and supports that context size and the adapter can transmit it; the planner does not create that capacity.
- Token estimates are approximate. The engine must reconcile them against provider-reported usage whenever available.

## What this does not do yet

- No free-model catalogue ingestion or provider verification.
- The D1 ledger foundation exists on PR #176, but it is not yet connected to live inference. No live usage is currently reserved, reconciled or enforced across model calls.
- No automatic retry/failover execution.
- No new model providers, credentials or API calls.
- No integration with the existing Workers AI / Qwen streaming adapter.
- No D1 migration, deployment or production change.

## Next implementation stages

1. **Trusted model/provider registry:** versioned provider and model metadata, evidence/provenance, verified context/output limits, licence/terms and last-checked time. External catalogues may suggest candidates but may not define arbitrary endpoints.
2. **Runtime accounting integration:** connect the D1 quota-window ledger to trusted provider adapters; reconcile actual usage, handle provider errors and establish verified daily/monthly quota windows before enabling enforcement.
3. **Adapter integration:** route the existing Workers AI and Qwen paths through the policy engine without changing current default behavior until verified.
4. **Free-tier discovery:** ingest public catalogue data as untrusted candidates, verify each provider against official docs/terms and keep quotas explicitly time-stamped.
5. **Failover and local inference:** bounded retries, circuit breakers and optional local model adapters where the host/device can support them.

## Verification

PR #33 uses Node.js built-in tests. The first test-only commit intentionally produced a failing CI run (RED). The implementation commit then passed the repository's full Node.js 22 suite: GitHub Actions run 43754887238, 0 failures. The library currently has six focused tests covering estimation, routing, quota exhaustion, context rejection, context fitting and malformed inputs.
