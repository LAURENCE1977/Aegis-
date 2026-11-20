# AEGIS model provider adapters

## Design boundary

The browser calls the authenticated AG-UI endpoint. Provider selection, credentials, endpoint construction and request shaping happen only in the server-side model adapter. The browser never receives provider keys.

Keep the interface provider-neutral where possible, but use a small native adapter for providers whose streaming wire formats differ. Do not make the default UI depend on a single vendor SDK.

## Current adapters

| Provider | Runtime selection | Server-side secret/config | Streaming format | Governed tools |
|---|---|---|---|---|
| Cloudflare Workers AI | default or AEGIS_MODEL_PROVIDER=workers-ai | env.AI binding | Workers AI text stream | No |
| Anthropic | AEGIS_MODEL_PROVIDER=anthropic | ANTHROPIC_API_KEY, AEGIS_ANTHROPIC_MODEL | Anthropic Messages SSE, text deltas translated to AG-UI | No; fail closed |
| Alibaba Qwen | AEGIS_MODEL_PROVIDER=alibaba-qwen | AEGIS_QWEN_API_KEY, workspace ID, region and model | OpenAI-compatible SSE | One bounded tool round only when explicitly enabled and Sentinel/D1 are ready |

## Provider registry rollout status

The registry rollout is deliberately staged and is not yet complete:

- PR #116 changes missing input/output pricing from numeric zero to `null`. A confirmed zero remains zero. Do not use unknown prices in cost ranking or describe them as free.
- PR #117 adds a server-owned adapter allowlist: `workers-ai`, `anthropic` and `alibaba-qwen`.
- PR #118 makes the runtime provider adapter selection consult the same canonical allowlist before dispatch. This prevents the registry and runtime from drifting into separate adapter allowlists.
- PR #119 adds mandatory per-model evidence provenance (`sourceUrl` and canonical `verifiedAt`) and independently rejects stale/future model evidence in `listEligibleModels`, even when the provider record itself is fresh. It still does not invent model catalogue entries or wire model selection into the live request path.
- PR #123 adds an optional server-side registry gate to the shared `createModelStream` adapter. When `AEGIS_PROVIDER_REGISTRY_JSON` is configured, the selected adapter and exact configured native model ID must match an enabled registry entry with fresh provider/model evidence and `chat` task support. Malformed registry data or an unmatched/stale/disabled model fails closed before provider access. When the variable is absent, existing explicit provider configuration remains backwards-compatible.
- The live request path still uses the explicit server-side `AEGIS_MODEL_PROVIDER` selection. When `AEGIS_PROVIDER_REGISTRY_JSON` is present, PR #123 additionally requires the exact configured native model ID to be eligible through `listEligibleModels` for the `chat` task, and enforces the registry's output/context limits. When the optional registry variable is absent, legacy provider selection remains in compatibility mode and is not yet registry-governed.
- PR #121 routes the legacy JSON `functions/api/ask.js` endpoint through `createModelStream`, so it now honours the configured Workers AI, Anthropic or Qwen adapter and returns the existing `{ response: text }` JSON shape. The bounded SSE reader accepts the three adapter event formats, rejects provider error events and caps frame, stream and output sizes. Regression tests cover each provider path. This is a draft stacked on the provider-registry provenance branch; do not describe it as production-live until its dependency chain is merged and deployed.
- `providerModelId` is an optional, separately validated native identifier in the registry schema and is returned by `listEligibleModels` without replacing the internal catalogue `id`. It is mandatory for an exact live adapter/model match whenever the optional registry gate is enabled; no production catalogue has yet been populated.
- No model pricing, context limit or tool capability should be inferred from an unverified model ID. Missing or stale facts remain unknown and must block decisions that depend on them.

### Evidence sources and refresh policy

Use provider-owned documentation as the evidence source for each individual model, record the exact HTTPS source URL and canonical UTC verification timestamp on that model, and recheck before it is eligible. Provider-level terms evidence is recorded separately. Eligibility requires both provider-level and model-level verification to be within the configured freshness window. Documentation is not a live account entitlement check: a provider's model being documented does not prove that a particular AEGIS account has access.

- [Cloudflare Workers AI model catalogue](https://developers.cloudflare.com/workers-ai/models/)
- [Cloudflare Workers AI model details and limits](https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/)
- [Cloudflare Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- [Anthropic model lifecycle and deprecations](https://docs.anthropic.com/en/docs/about-claude/model-deprecations)
- [Alibaba Model Studio model catalogue API](https://help.aliyun.com/en/model-studio/list-models)
- [Alibaba Model Studio pricing](https://help.aliyun.com/en/model-studio/model-pricing)

Pricing is region-, tier- and feature-dependent for some providers. The registry must not flatten tiered or conditional prices into a misleading single cost. If a model has tiered pricing, unsupported cache/batch pricing, or region-dependent pricing that the current cost planner cannot represent, cost stays unknown for routing purposes.

## Optional live registry gate (PR #123)

The provider registry can be supplied to the server runtime as the non-secret configuration variable `AEGIS_PROVIDER_REGISTRY_JSON` (version 1 JSON). It contains only AEGIS-owned provider/model metadata; it must never contain API keys, endpoints, browser input or credentials. The adapter rejects malformed/oversized configuration (maximum 16 KiB), and does not fall back to legacy routing when a registry value is present but invalid.

When configured, every call through the shared model adapter:
- requires an exact match for the server-selected adapter and configured native provider model ID;
- requires the provider to be enabled and both provider/model evidence timestamps to be no more than 24 hours old and not in the future;
- requires the model to declare the `chat` task;
- caps output at the lower of the existing 1,024-token application limit and the verified model output limit;
- applies a conservative input-context guard using the UTF-8 byte length of the serialized messages plus per-message framing headroom. This intentionally may reject some inputs earlier than a provider-specific tokenizer would; it does not claim exact billed-token accounting.

Unknown input/output prices remain `null` and are not interpreted as zero or used to rank models. The gate does not discover models, verify account entitlements, select among multiple models, or create a verified catalogue. AEGIS currently has no configured production registry source or populated owner-verified model catalogue. With no registry variable configured, legacy explicit provider selection continues unchanged until the catalogue is reviewed and the owner enables the gate.

The registry applies through the shared adapter used by AG-UI and the legacy JSON `/api/ask` route. `tests/ag-ui-api.test.mjs` verifies that an unregistered model is rejected on the actual AG-UI request path before provider access. GitHub Actions run [44730328797](https://github.com/LAURENCE1977/Aegis-/actions/runs/44730328797) passed 458 Node.js tests and the isolated D1/Forge verification steps. No runtime variable, provider credential or deployment was changed by PR #123.

## Anthropic Messages adapter

- Fixed endpoint: https://api.anthropic.com/v1/messages; no custom URL or browser-supplied endpoint.
- Uses Authorization: Bearer with the server-side API key, anthropic-version: 2023-06-01, JSON and SSE accept headers.
- Requires an explicit AEGIS_ANTHROPIC_MODEL; no model is silently selected and no cost tier is assumed.
- Moves system-role content into Anthropic's top-level system field and sends only user/assistant messages in the conversation array.
- Uses bounded message sizes, a 60-second request timeout, redirect rejection and SSE content-type validation.
- Parses only content_block_delta events whose delta type is text_delta; unknown event types are ignored and provider error events become generic user-safe errors.
- Does not expose Anthropic tool use yet. Tool calls must be separately modelled through the AEGIS server-owned tool registry and Sentinel, not accepted directly from a provider response.

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
