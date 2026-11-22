# AEGIS model provider adapters

## Design boundary

The browser calls the authenticated AG-UI endpoint. Provider selection, credentials, endpoint construction and request shaping happen only in the server-side model adapter. The browser never receives provider keys.

Keep the interface provider-neutral where possible, but use a small native adapter for providers whose streaming wire formats differ. Do not make the default UI depend on a single vendor SDK.

## Current adapters

| Provider | Runtime selection | Server-side secret/config | Streaming format | Governed tools |
|---|---|---|---|---|
| Cloudflare Workers AI | default or AEGIS_MODEL_PROVIDER=workers-ai | env.AI binding | Workers AI text stream | No |
| Anthropic | AEGIS_MODEL_PROVIDER=anthropic | Active owner vault connection (preferred), otherwise ANTHROPIC_API_KEY; AEGIS_ANTHROPIC_MODEL | Anthropic Messages SSE, text deltas translated to AG-UI | No; fail closed |
| Alibaba Qwen | AEGIS_MODEL_PROVIDER=alibaba-qwen | Active owner vault connection (preferred), otherwise AEGIS_QWEN_API_KEY; workspace ID, region and model | OpenAI-compatible SSE | One bounded tool round only when explicitly enabled and Sentinel/D1 are ready |\n| APInex | AEGIS_MODEL_PROVIDER=apinex | Active owner vault connection; APINEX_API_KEY is never browser-visible; AEGIS_APINEX_MODEL | Fixed APInex Chat Completions endpoint; OpenAI-compatible SSE | Disabled in the first adapter |

## Encrypted provider connection resolution

The authenticated AG-UI gateway resolves selected Anthropic, Alibaba Qwen or APInex credentials from the encrypted provider vault when an active owner connection exists.

- The provider ID is selected only by server-side `AEGIS_MODEL_PROVIDER`; browser request fields cannot select a provider or a vault reference.
- Resolution is bound to the fixed owner principal, exact provider ID, active non-expired connection and exact `<provider>:inference:chat` scope.
- The secret is decrypted only in server-side code and passed directly into the selected provider adapter. It is never returned to the browser, inserted into the prompt, or written to audit events.
- An active vault connection takes precedence over the legacy runtime key. If the connection exists but cannot be resolved or decrypted, the request fails closed; it does not silently fall back to the legacy key.
- If no provider connection has ever been created, the previous server-side environment-key configuration remains available for compatibility. If a connection record exists but is revoked or expired, legacy environment-key fallback is disabled for that provider; the owner must create a new active vault connection.
- The credential resolver supports Anthropic, Alibaba Qwen and APInex for live inference. Other provider IDs shown in the connection catalogue may be securely storable without being live inference adapters.
- The vault keyring and active key version must be configured as server-side Worker secrets. A missing or invalid keyring prevents vault resolution.

## Paid inference approval and token accounting

The AG-UI gateway applies a fail-closed paid-inference policy to Anthropic, Alibaba Qwen and APInex:

- The owner must explicitly set `AEGIS_PAID_INFERENCE_APPROVED=true`; having an API key is not approval.
- The owner must configure a finite `AEGIS_PAID_INFERENCE_MAX_TOKENS_PER_RUN` ceiling. The current supported maximum is 100,000 tokens.
- The deployment-level switch is only a feature gate; each paid dispatch also requires a separate owner decision in the authenticated Approvals inbox. A key or deployment flag alone never grants per-run consent.
- The pending approval is bound server-side to the exact thread/run, provider, model, estimated token reservation, maximum token ceiling and a digest of the prepared prompt and server-selected tools. Prompt contents and the digest are not exposed in the inbox.
- Pending approvals expire after 10 minutes. The existing owner-only approve/deny API records the decision; after approval, the browser resumes the same request and the server atomically consumes the exact decision once before reserving quota or contacting the provider.
- A partial unique D1 index prevents concurrent duplicate active approvals. Replays, changed prompts, changed models/providers, changed token estimates/ceilings, denied decisions and expired decisions fail closed.
- AEGIS requires D1 and one fresh, verified, active quota window matching the selected provider and model.
- It estimates a conservative reservation and reserves quota before the paid provider is contacted. If policy, storage, quota or reservation fails, the provider is not called.
- Complete, provider-matched usage is settled against the reservation. Qwen tool-round usage is aggregated across the initial and follow-up provider requests.
- Incomplete, cancelled, mismatched or over-reservation usage is not settled or presented as a complete total; the reservation remains open for reconciliation.
- A separate retry-safety change assigns each received paid dispatch attempt a distinct opaque reservation identity, preventing a repeated thread/run ID from reusing an earlier open reservation.

Cloudflare Workers AI / Neurons remain on their separate accounting path; their units are not mixed with provider token quotas. These paid-accounting and exact-run approval changes are present on draft PRs #188–#190. PR #190 adds the per-run owner-consent workflow on top of PR #189. They are not merged to `main` or production-live.

Automatic provider routing and provider failover are not implemented. Provider selection remains server-side through `AEGIS_MODEL_PROVIDER`; browser request fields cannot select a provider.

## Anthropic Messages adapter

- Fixed endpoint: https://api.anthropic.com/v1/messages; no custom URL or browser-supplied endpoint.
- Uses Authorization: Bearer with the server-side API key, anthropic-version: 2023-06-01, JSON and SSE accept headers.
- Requires an explicit AEGIS_ANTHROPIC_MODEL; no model is silently selected and no cost tier is assumed.
- Moves system-role content into Anthropic's top-level system field and sends only user/assistant messages in the conversation array.
- Uses bounded message sizes, a 60-second request timeout, redirect rejection and SSE content-type validation.
- Parses only content_block_delta events whose delta type is text_delta; unknown event types are ignored and provider error events become generic user-safe errors.
- Does not expose Anthropic tool use yet. Tool calls must be separately modelled through the AEGIS server-owned tool registry and Sentinel, not accepted directly from a provider response.


## APInex Chat Completions adapter

**Implementation status:** Added on draft PR #195; not merged to `main` and not production-live. The adapter is covered by the Node.js suite and has a successful Cloudflare Pages preview build. No APInex key has been stored and no live APInex request has been made.

- Fixed endpoint: `https://api.apinex.bond/v1/chat/completions`; no caller-supplied base URL, endpoint or redirect target.
- Uses a server-side Bearer key resolved from the owner vault under provider ID `apinex` and scope `apinex:inference:chat`.
- Requires the exact server-side `AEGIS_APINEX_MODEL` identifier. Namespaced IDs such as `free/deepseek-v4.1-flash` are accepted with strict path-segment validation; arbitrary hosts and traversal-like model IDs are rejected.
- Uses OpenAI-compatible SSE with a 60-second timeout, redirect rejection, response-body checks and `text/event-stream` validation.
- Requests a bounded 1,024-token output and usage reporting. If complete provider usage is absent or inconsistent, the existing usage ledger leaves the reservation open for reconciliation rather than inventing a final total.
- Tool calling is disabled. The AG-UI route does not pass its tool definitions to APInex. Provider-returned tool calls are not executed.
- APInex may include `reasoning_content`; the AG-UI text parser emits only supported text deltas and does not expose the reasoning field.
- APInex is treated as metered external inference, including when the selected model is advertised as free. Every run requires the existing explicit owner paid-inference feature gate, a finite token ceiling, exact-run approval, and a matching active D1 quota window. This conservative policy remains until account-specific free-tier eligibility and billing behavior have been verified.
- No automatic paid-model fallback, provider failover or model substitution is allowed.
- Do not route health data, secrets, credentials or confidential repository content to APInex.

Official protocol references: [APInex Chat Completions](https://apinex.bond/developers/models/chat) and [APInex model catalogue](https://apinex.bond/models).

### Free-tier eligibility is a separate future gate

APInex's public pricing page advertises a daily allowance for free-category models, and its free-model guide distinguishes daily-free-eligible entries from subscription-only entries. The guide describes weighted allowance consumption and an authenticated `GET /v1/subscription` status containing fields such as `allowed`, `tokens_remaining` and `resets_at_utc`.

The current AEGIS adapter does **not** yet perform that preflight or verify model-level `allowFree` eligibility. Therefore it deliberately treats every APInex dispatch as metered and requires the paid-inference approval/quota path, even when the configured ID begins with `free/`. This is a safety hold, not a claim that the free models necessarily cost money.

A later free-tier optimisation should be implemented separately and test-first:
- Authenticate a read-only subscription/allowance check using the same vault-resolved key.
- Verify the exact model's current daily-free eligibility from trusted current catalogue metadata; a `free/` prefix alone is insufficient.
- Enforce the account's remaining weighted allowance and reset time, plus AEGIS's own finite per-run/daily cap.
- Fail closed on missing, stale, contradictory or unavailable eligibility data.
- Never fall back to a paid model or use subscription-only free-category models without an active subscription.
- Reconcile actual usage after the response; do not assume model IDs or advertised allowances remain stable.

References: [APInex pricing](https://apinex.bond/pricing), [APInex free-model allowance guide](https://apinex.bond/guides/free-llm-api-keys-for-developers-complete-list).

### Activation gates


**Current infrastructure blocker (read-only audit, 2026-11-22):** The correct Cloudflare account for the AEGIS Pages project currently lists zero D1 databases, and the `aegis` Pages production configuration has no D1 binding. The encrypted provider vault and paid-token ledger therefore cannot be enabled in that environment yet. No database or binding has been created. Owner approval is required before provisioning D1 or changing production configuration.

1. Merge the provider implementation only after review of PR #195 and its parent branch.
2. Confirm the production/preview D1 migrations, vault keyring and active key version are configured for the intended environment.
3. Owner creates an APInex account and obtains an APInex key directly from APInex. Never paste it into chat or commit it.
4. Store the key using the authenticated AEGIS provider-connection screen/API, which encrypts it in the provider vault.
5. Configure the exact model ID and owner-approved token ceiling in the server environment. Do not enable paid inference merely because a key exists.
6. Add a verified provider/model quota window and test first with a small, non-sensitive prompt after explicit per-run approval.
7. Confirm actual APInex usage and billing before any broader use. No sensitive-data use without a separate privacy and contractual review.

## Runtime configuration

To activate Anthropic after the code is deployed:

1. Add ANTHROPIC_API_KEY as a Cloudflare Pages/Worker runtime secret for the correct environment.
2. Set AEGIS_MODEL_PROVIDER=anthropic.
3. Set AEGIS_ANTHROPIC_MODEL to a model ID available to that API key.
4. Deploy the Worker/Pages build and verify an authenticated AG-UI request with a small test prompt.

A GitHub Actions repository secret named ANTHROPIC_API_KEY is only available to GitHub Actions workflows. It is not automatically passed to Cloudflare runtime bindings. Never put the key in index.html, a public build variable, a commit, test fixture, or chat message.

## Next provider adapters

- OpenAI-compatible endpoint adapter: fixed/allowlisted server-side base URL, provider/model registry, bounded SSE parser and no browser-controlled destinations.
- Local Ollama/LM Studio: private network/local gateway adapter, explicit reachability and CORS/network constraints; do not assume an iPad browser can reach a host service.
- Additional providers only after endpoint, auth, rate limit, model IDs, streaming format, error mapping, cost and data handling are verified.

## Verification

Provider tests must assert request endpoint, headers, payload transformation, timeout, redirect policy, response type and that secrets are never returned. AG-UI integration tests must prove that each provider's event shape produces text deltas and a terminal event. A mocked success response alone is not proof of provider interoperability.
