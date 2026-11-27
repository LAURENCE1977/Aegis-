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
| Ollama | AEGIS_MODEL_PROVIDER=ollama | AEGIS_OLLAMA_BASE_URL, AEGIS_OLLAMA_API_KEY, AEGIS_OLLAMA_MODEL | OpenAI-compatible chat-completions SSE through an authenticated HTTPS gateway | No; fail closed |
| Magnitude | AEGIS_MODEL_PROVIDER=magnitude | AEGIS_MAGNITUDE_BASE_URL, AEGIS_MAGNITUDE_API_KEY, AEGIS_MAGNITUDE_MODEL | Magnitude OpenAI-compatible inference SSE | No; fail closed |

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

## Ollama local inference adapter

Ollama runs separately from Cloudflare Pages. The AEGIS adapter targets the OpenAI-compatible `POST /v1/chat/completions` endpoint through a separately secured HTTPS gateway.

- Configure `AEGIS_OLLAMA_BASE_URL` as the gateway HTTPS origin only; AEGIS appends the fixed chat-completions path.
- Configure `AEGIS_OLLAMA_API_KEY` as a server-side bearer credential that the gateway itself validates. A normal local Ollama listener does not enforce this credential by default.
- Configure `AEGIS_OLLAMA_MODEL` explicitly using the model tag available on the Ollama host.
- The adapter rejects HTTP, local-only hostnames, credentials, custom ports, paths, query strings and fragments. It never accepts a destination from the browser.
- Requests use bounded AEGIS messages, a 60-second timeout, redirect rejection, SSE validation and generic upstream errors.
- Provider-originated tool calling is disabled. AEGIS Sentinel remains the independent permission authority.
- No automatic paid fallback occurs if the Ollama host or gateway is unavailable.

Do not expose Ollama's unauthenticated port directly to the public internet. A Cloudflare Tunnel or equivalent private ingress may be used, but it must terminate behind an authentication layer that validates the configured bearer key. A tunnel alone is not authentication. Cloudflare Pages cannot reach Ollama on a user's `localhost`, and a browser on an iPad/phone cannot assume access to another device's loopback interface.

The host must run Ollama and have the selected model downloaded. Model availability, hardware fit, latency and quality must be benchmarked on that host before choosing a default.

## Magnitude local inference adapter

Magnitude is a separately hosted local inference engine. Its OpenAI-compatible API uses the fixed `/inference/v1/chat/completions` route (not the standard `/v1/chat/completions` path).

- Configure `AEGIS_MAGNITUDE_BASE_URL` as the HTTPS origin of the Magnitude server or a secured HTTPS ingress in front of it. AEGIS appends the fixed `/inference/v1/chat/completions` path.
- Configure `AEGIS_MAGNITUDE_API_KEY` as the Magnitude network access key (`network.apiKey`). Magnitude network access must be enabled and `network.requireApiKey` must remain true.
- Configure `AEGIS_MAGNITUDE_MODEL` with the exact model ID returned by `GET /inference/v1/models`. Display names are not interchangeable with model IDs.
- If Magnitude's `network.allowedHosts` is configured, include the hostname Magnitude receives in the HTTP Host header for the AEGIS ingress.
- The adapter accepts only a public HTTPS origin without credentials, custom path, query, fragment or non-standard port. It never accepts a destination from the browser.
- Requests use bounded AEGIS messages, a 60-second timeout, redirect rejection, SSE validation and generic upstream errors.
- Provider-originated tool calling is disabled. Magnitude's API may support tools in some contexts, but AEGIS does not delegate its Sentinel permission decisions to model output.
- Keep Magnitude's listener private behind a secured HTTPS ingress (for example, an authenticated reverse proxy or carefully configured private tunnel). Do not expose an unauthenticated inference service to the public internet.
- Magnitude model downloads, management endpoints and browser UI are not exposed through this adapter; it only calls the inference endpoint. No automatic paid fallback occurs if the host is unavailable.

Magnitude's own service and models run on a separate desktop/server host. The current compatibility guide excludes phone/mobile GPUs, so do not plan to run the inference engine directly on an iPhone or Android handset. Benchmark model fit, latency, quality and host operating cost before selecting it as a default.

## Next provider adapters

- Additional providers only after endpoint, auth, rate limit, model IDs, streaming format, error mapping, cost and data handling are verified.

## Verification

Provider tests must assert request endpoint, headers, payload transformation, timeout, redirect policy, response type and that secrets are never returned. AG-UI integration tests must prove that each provider's event shape produces text deltas and a terminal event. A mocked success response alone is not proof of provider interoperability.
