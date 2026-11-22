# AEGIS Provider Gateway — Protocol Boundaries

Reviewed: 22 November 2026

## Decision

Build **one provider gateway with multiple small protocol adapters**, not one giant adapter that assumes every provider implements the same API.

"OpenAI-compatible" is a useful interoperability target, but it is not a guarantee that every endpoint, parameter, event shape, tool feature or model capability is identical.

The current shared transport in `functions/lib/openai-compatible-stream.mjs` deliberately implements only the streaming Chat Completions request shape. It is not a Responses API client, a universal model SDK, or proof that all compatible endpoints support every feature.

## Primary-source protocol distinctions

OpenAI's current migration guide recommends the Responses API for new projects while retaining Chat Completions support. The two APIs have materially different request, response and streaming shapes:

- Chat Completions sends `messages` and returns `choices`; streaming emits incremental `delta` chunks.
- Responses uses typed `input` and `output` items, including message, reasoning, function-call and function-result items.
- Responses streaming uses typed events such as `response.created`, `response.output_text.delta`, `response.completed` and `error`; a Chat Completions chunk parser cannot safely be reused unchanged.
- Function definitions and tool-call/result correlation differ. Responses uses `call_id` and typed function-call items.
- Conversation state is also different: Chat Completions is commonly managed by the caller, while Responses can use previous response IDs or Conversations.

Official sources:
- https://developers.openai.com/api/docs/guides/migrate-to-responses
- https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create
- https://developers.openai.com/api/docs/guides/streaming-responses

LM Studio also exposes both OpenAI-compatible endpoints and its own native REST API:
- https://lmstudio.ai/docs/developer/openai-compat
- https://lmstudio.ai/docs/developer/rest

## What the inspected AEGIS code currently does

On the provider feature branch:
- `functions/lib/model-provider.mjs` validates bounded message/tool shapes, resolves server-side provider configuration and selects a provider by server environment.
- `functions/lib/openai-compatible-stream.mjs` centralises the Chat Completions HTTP transport: HTTPS endpoint validation, bearer authentication, redirect rejection, timeout, bounded model/message shape, SSE response validation and generic upstream errors.
- `functions/api/ag-ui.js` calls `createModelStream()` and translates supported provider stream chunks into AG-UI events.
- The AG-UI stream parser currently understands the Workers AI response text shape, OpenAI Chat Completions `choices[0].delta.content`, and Anthropic Messages `content_block_delta` text events. It does not yet implement typed Responses API events.
- Provider tool calls are handled as proposals in AEGIS's server-side flow. The provider transport itself never executes a tool.

This code is on an unmerged feature branch. The current `main` README still describes the model router as under development; do not present this branch work as production-live.

## Recommended gateway architecture

1. **Provider profile (server-authored):** provider ID, fixed or explicitly allowlisted endpoint, secret reference, model ID, protocol ID, capability evidence, cost/quota metadata, data-handling notes and health state.
2. **Protocol adapter:** Chat Completions, Responses, Anthropic Messages, or a provider-native adapter where the semantics genuinely differ.
3. **Policy gate:** Infinity Zero cost mode, verified quota, model suitability, endpoint safety, privacy policy and Sentinel permissions.
4. **Normalized internal events:** text delta, tool-call proposal, usage observation, finish, cancellation and provider error.
5. **AG-UI boundary:** translate normalized events into the UI protocol. Do not let provider-specific chunks leak into the front end.
6. **Evidence loop:** contract tests per provider/model/protocol; measure correctness, streaming behavior, cancellation, latency, cost and failure handling.

## Capability matrix — never infer support from a compatible URL

For every provider/model, record and test:
- chat completions request/response shape;
- Responses API support (separately);
- streaming event format and terminal events;
- function/tool call request and response shape;
- cancellation and timeout behavior;
- usage and cost reporting;
- vision, audio and structured-output support;
- model ID and context limits;
- retention/privacy terms and regional constraints.

A model catalogue or README can provide hints, not proof. A capability is enabled only after the exact provider/model combination passes its contract tests and policy checks.

## Security and cost invariants

- Browser requests never choose arbitrary provider URLs or send provider secrets.
- Redirects are rejected; credentials remain server-side.
- Endpoint validation is not a substitute for network egress controls or DNS-rebinding protection. Local model hosts require a private authenticated gateway; never expose a raw local inference port.
- Tool calls are proposals, not authority. All tool execution remains in AEGIS's own registry and Sentinel-controlled flow.
- Unknown or missing cost/quota metadata is not free. Infinity Zero free-only mode stops instead of silently using paid inference.
- Do not count tokens, neurons, compute time, power or cash as interchangeable units.

## Implementation sequence

- **Now:** shared Chat Completions transport and tests; Qwen uses the shared helper.
- **Next:** migrate OpenRouter, AxForge, Ollama and Magnitude transport code onto the helper when their branches are reconciled.
- **Then:** implement a separate Responses adapter and typed event normalizer only where an actual provider/model requires it.
- **Later:** add LM Studio as a server-authored local endpoint profile through an authenticated private gateway, once a supported host machine exists.
