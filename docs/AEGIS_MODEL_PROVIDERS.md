# AEGIS model provider adapters

## Design boundary

The browser calls the authenticated AG-UI endpoint. Provider selection, credentials, endpoint construction and request shaping happen only in the server-side model adapter. The browser never receives provider keys.

Keep the interface provider-neutral where possible, but use a small native adapter for providers whose streaming wire formats differ. Do not make the default UI depend on a single vendor SDK.

## Current adapters

| Provider | Runtime selection | Server-side secret/config | Streaming format | Governed tools |
|---|---|---|---|---|
| Cloudflare Workers AI | default or AEGIS_MODEL_PROVIDER=workers-ai | env.AI binding | Workers AI text stream | No |
| Anthropic | AEGIS_MODEL_PROVIDER=anthropic | Active owner vault connection (preferred), otherwise ANTHROPIC_API_KEY; AEGIS_ANTHROPIC_MODEL | Anthropic Messages SSE, text deltas translated to AG-UI | No; fail closed |
| Alibaba Qwen | AEGIS_MODEL_PROVIDER=alibaba-qwen | Active owner vault connection (preferred), otherwise AEGIS_QWEN_API_KEY; workspace ID, region and model | OpenAI-compatible SSE | One bounded tool round only when explicitly enabled and Sentinel/D1 are ready |

## Encrypted provider connection resolution

The authenticated AG-UI gateway now resolves the selected Anthropic or Alibaba Qwen credential from the encrypted provider vault when an active owner connection exists.

- The provider ID is selected only by server-side `AEGIS_MODEL_PROVIDER`; browser request fields cannot select a provider or a vault reference.
- Resolution is bound to the fixed owner principal, exact provider ID, active non-expired connection and exact `<provider>:inference:chat` scope.
- The secret is decrypted only in server-side code and passed directly into the selected provider adapter. It is never returned to the browser, inserted into the prompt, or written to audit events.
- An active vault connection takes precedence over the legacy runtime key. If the connection exists but cannot be resolved or decrypted, the request fails closed; it does not silently fall back to the legacy key.
- If no provider connection has ever been created, the previous server-side environment-key configuration remains available for compatibility. If a connection record exists but is revoked or expired, legacy environment-key fallback is disabled for that provider; the owner must create a new active vault connection.
- The credential resolver currently supports only Anthropic and Alibaba Qwen because these are the only adapters present in this branch. Other provider IDs shown in the connection catalogue are securely storable, but are not live inference adapters yet.
- The vault keyring and active key version must be configured as server-side Worker secrets. A missing or invalid keyring prevents vault resolution.

This integration does not yet connect model requests to the durable usage ledger or automatic provider routing. There is no automatic provider failover, and no provider is selected from browser input.

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
