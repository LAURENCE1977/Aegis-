# LM Studio — AEGIS Adaptation Assessment

Reviewed: 22 November 2026

**Decision:** adopt the protocol pattern; defer runtime integration until AEGIS has a verified provider-execution gateway and a user-controlled host machine.

This is an architecture assessment, not an integration claim. No LM Studio package, daemon, model, API token, network tunnel or MCP server has been installed or connected to AEGIS.

## Sources inspected

Official documentation:
- API overview: https://lmstudio.ai/docs/developer/rest
- OpenAI-compatible endpoints: https://lmstudio.ai/docs/developer/openai-compat
- API authentication: https://lmstudio.ai/docs/developer/core/authentication
- Server settings: https://lmstudio.ai/docs/developer/core/server/settings
- Model catalogue: https://lmstudio.ai/docs/developer/rest/list
- Headless service (`llmster`): https://lmstudio.ai/docs/developer/core/headless
- System requirements: https://lmstudio.ai/docs/app/system-requirements
- Official repositories: https://github.com/lmstudio-ai
- TypeScript SDK: https://github.com/lmstudio-ai/lmstudio-js
- CLI: https://github.com/lmstudio-ai/lms
- Documentation source: https://github.com/lmstudio-ai/docs

External architecture cross-check:
- `orthogonalhq/nous-core` issue #316 describes composing local LM Studio, vLLM and llama.cpp endpoints from a shared OpenAI protocol instead of adding bespoke provider classes: https://github.com/orthogonalhq/nous-core/issues/316. Treat this as a design reference, not an authority or dependency.

## What the source actually provides

LM Studio exposes:
- OpenAI-compatible `/v1/chat/completions`, `/v1/responses`, `/v1/models` and embeddings endpoints.
- A native `/api/v1/*` REST API with stateful chat, model listing/loading/unloading/downloading, and API-token authentication.
- Model metadata including loaded state, context limits, quantisation, vision and tool-use capability hints.
- A headless `llmster` service for supported host machines.

The native API can also invoke MCP integrations. That capability must not become a shortcut around AEGIS's Sentinel approval boundary.

## AEGIS codebase findings

The inspected AEGIS README describes the live repository as an early Cloudflare Pages prototype and explicitly says the full provider router is still being developed.

The inspected Infinity Zero feature branch contains:
- `functions/lib/provider-registry.mjs`: a strict, versioned model/provider metadata validator.
- `functions/lib/intelligence-engine.mjs`: deterministic task/cost/quota-based route selection and message fitting.

Those files are policy/catalogue foundations, not a live network adapter. The route selector is not proof that AEGIS can yet send a request to an arbitrary provider. Therefore LM Studio should not be added as a pretend working provider entry until a real provider-execution boundary exists.

## Recommended integration shape

1. Build one generic, server-side OpenAI-compatible HTTP adapter in the provider gateway. Do not add an LM Studio-only SDK dependency for ordinary chat.
2. Treat LM Studio as an endpoint profile:
   - Base URL: private authenticated endpoint ending in `/v1`.
   - Model: exact model identifier reported by that LM Studio server.
   - Credential: server-side secret reference, never browser-supplied or stored in public configuration.
3. Start with text-only chat and explicit timeouts, bounded request/response sizes, streaming parser tests, cancellation and clear provider error mapping.
4. Add optional model discovery using `GET /v1/models`; add richer native `/api/v1/models` capability inspection only after the generic adapter is working.
5. Treat discovered model metadata as untrusted hints. Probe supported features and keep tool/vision/reasoning capability disabled until verified.
6. Route any tool calls through AEGIS's own registered tools and Sentinel approval flow. Do not forward arbitrary LM Studio MCP integrations or remote MCP URLs.
7. Keep provider choice opt-in. A local endpoint failure must not silently fall back to a paid cloud model when Infinity Zero is in free-only mode.

## Security and networking

- LM Studio's API server does not require authentication by default. Enable API-token authentication before allowing any network access.
- Do not expose port 1234 directly to the public internet.
- A tunnel is transport, not identity: remote access needs authenticated, private networking and a narrowly scoped server-side credential.
- Do not accept arbitrary base URLs from browser requests. Store endpoint profiles server-side and block loopback, link-local, private-network and metadata-service destinations unless a dedicated, authenticated local-host connector explicitly authorises them. Apply DNS/IP validation and redirect rejection at connection time to resist SSRF and rebinding.
- Keep LM Studio's MCP integration capability disabled for AEGIS requests until it can be mediated through Sentinel.
- Local inference may avoid per-token API charges, but it still consumes hardware, memory, electricity and host availability. Do not label it economically or operationally cost-free.

## Device and deployment reality

LM Studio officially supports macOS, Windows and Linux, not iPadOS or Android. AEGIS running on Cloudflare Pages cannot reach a model server on a user's private machine merely because both are visible in the browser. A separate supported host and a deliberately secured network path are required.

No suitable always-on Windows/Linux host has been confirmed for this project. Therefore the integration should remain dormant and optional until the user has a host machine. The web-first AEGIS app must continue to work without LM Studio.

## Test plan before activation

- Unit tests for endpoint profile validation, allowed protocols/hosts, model ID, credential reference and free-only route policy.
- Contract tests against a local mock OpenAI-compatible server for normal JSON, SSE chunking, malformed frames, timeouts, cancellation, HTTP errors and oversized responses.
- Security tests for redirects, DNS rebinding/private IPs, userinfo in URLs, unexpected ports, missing authentication and secret redaction.
- Compatibility tests for `/v1/models`, chat completions and Responses separately; never assume all endpoints behave identically.
- No live host, secret, MCP integration or paid fallback required for the test suite.

## Decision

**Adapt, don't copy.** Reuse AEGIS's generic provider gateway and Infinity Zero policy. Treat LM Studio as one compatible local endpoint, with native model-management features as an optional later extension. No code from LM Studio or other third-party repositories is copied by this assessment.


## Additional official repository inspection

The official `lmstudio-ai/lmstudio-js` README describes a TypeScript SDK that supports browser and Node-compatible environments, local model inference, tool definitions, model load/unload, configuration and embeddings. Its root `package.json` identifies the package as MIT-licensed. This is useful if AEGIS later needs LM Studio-specific model-management operations, but ordinary chat still fits the generic OpenAI-compatible adapter.

The official `lmstudio-ai/lms` README documents server start/stop, model listing, load/unload and status commands. Its root package manifest and LICENSE also identify MIT. Keep this CLI as a host-side operations tool, not as AEGIS's remote execution interface.

**Important security finding:** the `lms` README documents an LM Link agentic-use switch. It explicitly warns that connected agents can read and modify files and run commands with the host user's permissions. AEGIS must not enable that broad agentic-use mode as an integration shortcut. It conflicts with AEGIS's narrow capability model, Sentinel approval and no-arbitrary-shell rule. If remote control is ever needed, build a separate, typed, allowlisted companion agent with per-action grants, audit, cancellation and no shell access.

The SDK's browser support does not make a browser-side API token safe. AEGIS must keep any LM Studio API token server-side and provide a private authenticated path to the host; do not embed the token in the web app or browser storage.
