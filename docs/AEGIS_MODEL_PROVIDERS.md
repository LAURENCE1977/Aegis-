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
- The live request path still selects the configured provider through `AEGIS_MODEL_PROVIDER`. It does **not yet** select a model through `listEligibleModels`; catalogue eligibility, model ID enforcement, metadata freshness, context/output limits and task compatibility are not yet enforced by live AG-UI routing.
- No model pricing, context limit or tool capability should be inferred from an unverified model ID. Missing or stale facts remain unknown and must block decisions that depend on them.

### Evidence sources and refresh policy

Use provider-owned documentation as the evidence source, record the exact URL and verification timestamp, and recheck before a catalogue record is eligible. Documentation is not a live account entitlement check: a provider's model being documented does not prove that a particular AEGIS account has access.

- [Cloudflare Workers AI model catalogue](https://developers.cloudflare.com/workers-ai/models/)
- [Cloudflare Workers AI model details and limits](https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/)
- [Cloudflare Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- [Anthropic model lifecycle and deprecations](https://docs.anthropic.com/en/docs/about-claude/model-deprecations)
- [Alibaba Model Studio model catalogue API](https://help.aliyun.com/en/model-studio/list-models)
- [Alibaba Model Studio pricing](https://help.aliyun.com/en/model-studio/model-pricing)

Pricing is region-, tier- and feature-dependent for some providers. The registry must not flatten tiered or conditional prices into a misleading single cost. If a model has tiered pricing, unsupported cache/batch pricing, or region-dependent pricing that the current cost planner cannot represent, cost stays unknown for routing purposes.

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
