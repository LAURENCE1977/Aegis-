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
- Optional: Anthropic Messages API using the fixed `https://api.anthropic.com/v1/messages` endpoint, server-side `ANTHROPIC_API_KEY` and explicit `AEGIS_ANTHROPIC_MODEL`.
- Optional: Alibaba Qwen using a fixed regional endpoint, validated workspace/region and server-side `AEGIS_QWEN_API_KEY`.
- Provider requests reject redirects, use a timeout and require SSE streaming responses. Anthropic named `content_block_delta` text events are translated into the same AG-UI text lifecycle.
- The current provider adapters are an initial slice, not the finished provider-agnostic gateway. Custom OpenAI-compatible endpoints, Ollama/LM Studio local endpoints and additional providers remain future adapters.
- Anthropic tool calling is deliberately disabled in this adapter; the governed tool loop currently supports only the explicitly opted-in Qwen model.

## Governed model tools

Tool calling is disabled unless the owner explicitly configures `AEGIS_AGENT_TOOLS_ENABLED=true`, selects the tested `qwen3.8-flash` model, supplies valid Qwen credentials/region and provides AEGIS D1. The default Workers AI path remains text-only.

When enabled, the server supplies exactly two fixed read-only tool definitions: local module catalogue and public GitHub repository metadata. The model cannot define tools, choose principals, resources, adapters, endpoints or permissions. One tool call per run is permitted. Resource identity is derived server-side and the invocation passes through exact capability grants, atomic rate limits, Sentinel audit and the fixed adapter registry. Recursive tool calls are not allowed.

No private GitHub access, source-file reading, shell, browser automation, MCP, writes or deletes are enabled by this tool loop. Retrieved metadata is untrusted reference data, never instructions or permissions.

## Deployment status

Source and tests only. The route has not been deployed or connected to a production provider binding/secret. To use Anthropic, the owner must add `ANTHROPIC_API_KEY` as a Cloudflare Pages/Worker runtime secret and set `AEGIS_MODEL_PROVIDER=anthropic` plus an explicitly chosen `AEGIS_ANTHROPIC_MODEL`. A GitHub Actions repository secret is not automatically available to the Worker runtime. Tool calling remains inactive until the owner deliberately configures the Qwen feature flag, provider credentials and D1 binding.
