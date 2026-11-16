# AEGIS AG-UI streaming chat

## Purpose

The AG-UI endpoint provides a bounded server-side streaming chat path for the browser. It emits AG-UI 1.0 text lifecycle events over Server-Sent Events (SSE), allowing the UI to render assistant text as it arrives.

## Request and safety contract

- Owner-authenticated and same-origin POST only.
- Request body capped at 64 KiB; at most 11 messages, 4,000 characters per message and 12,000 characters of assistant output.
- Only plain-text user and assistant history is accepted. Client-supplied tools, ambient context, state, forwarded properties and parent runs are rejected.
- Optional `projectId` must resolve to an active owner Project Space.
- Server-side `buildAskMessages` adds bounded skills, legacy notes, accepted memory and recent project event summaries as untrusted reference context.
- No tool calls, MCP, browser, shell, file writes or external actions are exposed by this endpoint.

## Model providers in this slice

- Default: Cloudflare Workers AI using the configured `env.AI` binding.
- Optional: Alibaba Qwen using a fixed regional endpoint, validated workspace/region and server-side `AEGIS_QWEN_API_KEY`.
- Provider requests reject redirects, use a timeout and require SSE streaming responses.

This is an initial adapter boundary, not the finished provider-agnostic gateway. Anthropic, OpenAI-compatible custom endpoints, Ollama/LM Studio local endpoints and additional provider adapters are not enabled by this slice. No provider key is added to the repository or configured by this change.

## Deployment status

Source and tests only. The AG-UI route and model adapter have not been deployed or connected to a production provider binding/secret.
