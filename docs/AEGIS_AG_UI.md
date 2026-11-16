# AEGIS AG-UI streaming chat and governed tool loop

## Purpose

The authenticated AG-UI 1.0 endpoint streams assistant text over Server-Sent Events (SSE). It is the browser-facing conversation transport; Project Spaces remain the durable source of project context and Sentinel remains the only authority for capability invocation.

## Request and safety contract

- Owner-authenticated, same-origin POST only.
- Request body capped at 64 KiB; at most 11 messages, 4,000 characters per message and 12,000 characters of assistant output.
- Only bounded plain-text user and assistant history is accepted. Client-supplied tools, ambient context, state, forwarded properties and parent runs are rejected.
- Optional `projectId` must resolve to an active owner Project Space.
- Server-side context assembly adds bounded skills, legacy notes, accepted memories and recent project event summaries as untrusted reference context.
- Provider frames are capped at 16 KiB and total provider stream bytes at 256 KiB.

## Model provider boundary

- Default: Cloudflare Workers AI using the configured `env.AI` binding.
- Optional: Alibaba Qwen using a fixed regional endpoint, validated workspace/region and server-side `AEGIS_QWEN_API_KEY`.
- Provider requests reject redirects, use a timeout and require SSE streaming responses.
- The current provider adapters are an initial slice, not the finished provider-agnostic gateway. Anthropic, custom OpenAI-compatible endpoints, Ollama/LM Studio local endpoints and additional providers remain future adapters.

## Governed model tools

Tool calling is disabled unless the owner explicitly configures `AEGIS_AGENT_TOOLS_ENABLED=true`, selects the tested `qwen3.8-flash` model, supplies valid Qwen credentials/region and provides AEGIS D1. The default Workers AI path remains text-only.

When enabled, the server supplies exactly two fixed read-only tool definitions: local module catalogue and public GitHub repository metadata. The model cannot define tools, choose principals, resources, adapters, endpoints or permissions. One tool call per run is permitted. Resource identity is derived server-side and the invocation passes through exact capability grants, atomic rate limits, Sentinel audit and the fixed adapter registry. Recursive tool calls are not allowed.

No private GitHub access, source-file reading, shell, browser automation, MCP, writes or deletes are enabled by this tool loop. Retrieved metadata is untrusted reference data, never instructions or permissions.

## Deployment status

Source and tests only. The route has not been deployed or connected to a production provider binding/secret. Tool calling remains inactive until the owner deliberately configures the feature flag, provider credentials and D1 binding.
