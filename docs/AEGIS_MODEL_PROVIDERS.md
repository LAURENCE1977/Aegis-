# AEGIS model provider adapters

## Design boundary

The browser calls the authenticated AG-UI endpoint. Provider selection, credentials, endpoint construction and request shaping happen only in the server-side model adapter. The browser never receives provider keys.

Keep the interface provider-neutral where possible, but use a small native adapter for providers whose streaming wire formats differ. Do not make the default UI depend on a single vendor SDK.

## Current adapters

| Provider | Runtime selection | Server-side secret/config | Streaming format | Governed tools |
|---|---|---|---|---|
| Cloudflare Workers AI | default or AEGIS_MODEL_PROVIDER=workers-ai | env.AI binding | Workers AI text stream | No |
| Anthropic | AEGIS_MODEL_PROVIDER=anthropic | ANTHROPIC_API_KEY, AEGIS_ANTHROPIC_MODEL | Anthropic Messages SSE, text deltas translated to AG-UI | No; fail closed |
| Alibaba Qwen | AEGIS_MODEL_PROVIDER=alibaba-qwen | AEGIS_QWEN_API_KEY, workspace ID, region and model | OpenAI-compatible SSE | One bounded tool round only when explicitly enabled and Sentinel/D1 are ready |\n| BitNet.cpp | AEGIS_MODEL_PROVIDER=bitnet | AEGIS_BITNET_BASE_URL, AEGIS_BITNET_API_KEY, AEGIS_BITNET_MODEL | OpenAI-compatible chat-completions SSE via an authenticated HTTPS gateway | No; fail closed |

## Anthropic Messages adapter

- Fixed endpoint: https://api.anthropic.com/v1/messages; no custom URL or browser-supplied endpoint.
- Uses Authorization: Bearer with the server-side API key, anthropic-version: 2023-06-01, JSON and SSE accept headers.
- Requires an explicit AEGIS_ANTHROPIC_MODEL; no model is silently selected and no cost tier is assumed.
- Moves system-role content into Anthropic's top-level system field and sends only user/assistant messages in the conversation array.
- Uses bounded message sizes, a 60-second request timeout, redirect rejection and SSE content-type validation.
- Parses only content_block_delta events whose delta type is text_delta; unknown event types are ignored and provider error events become generic user-safe errors.
- Does not expose Anthropic tool use yet. Tool calls must be separately modelled through the AEGIS server-owned tool registry and Sentinel, not accepted directly from a provider response.

## BitNet.cpp local inference adapter

BitNet.cpp is a separately hosted local-inference runtime, not a Cloudflare Pages workload. The AEGIS adapter talks to an OpenAI-compatible `POST /v1/chat/completions` endpoint exposed by an authenticated HTTPS gateway in front of the BitNet host.

- Configure `AEGIS_BITNET_BASE_URL` as the HTTPS origin of the gateway (origin only; no path, query, fragment or embedded credentials).
- Configure `AEGIS_BITNET_API_KEY` as a server-side bearer credential enforced by that gateway. The upstream BitNet/llama.cpp server does not become authenticated merely because AEGIS sends this header; the gateway must validate it.
- Configure `AEGIS_BITNET_MODEL` explicitly to the model alias loaded by the server, or a namespaced model identifier.
- The adapter constructs the fixed `/v1/chat/completions` path, requires HTTPS and a DNS hostname, rejects local-only hostnames, and never accepts a destination from the browser.
- Requests use bounded AEGIS messages, a 60-second timeout, redirect rejection, streaming SSE and generic upstream errors.
- Tool/function calling is disabled. BitNet output cannot grant permissions or approve actions; Sentinel remains the independent authority.
- No automatic fallback to a paid provider occurs if BitNet is unavailable.

The official BitNet.cpp `run_inference_server.py` launcher defaults to binding `127.0.0.1:8080`. Keep that inference listener private. If AEGIS is hosted on Cloudflare, expose it only through a separately secured HTTPS gateway/tunnel that enforces the configured bearer credential; do not expose the raw unauthenticated inference port to the public internet.

BitNet runtime setup and model downloads happen on the host machine, not in Cloudflare Pages. The BitNet project documents its own compiler/build requirements and supported model/kernel combinations; validate the selected CPU architecture, quantization and model before provisioning a host.

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
