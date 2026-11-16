# AEGIS Composio and External Agent Platform Review

Reviewed: 16 November 2026

Status: research and integration design only. This document does not install a package, create a Composio account/session, connect an external account, configure a secret, enable a capability, or deploy a change.

## Executive decision

Adopt Composio as a high-priority optional external integration catalogue and managed-auth/MCP transport candidate. Do not make it AEGIS's authority for identity, grants, approvals, execution policy, audit, budgets or durable job state.

The preferred first integration is a narrowly scoped, server-side outbound Streamable HTTP MCP client/adapter that connects to a user-authorised Composio session. Do not bundle the full Composio SDK into the Cloudflare Worker until its runtime compatibility, package footprint and deployment constraints are proven. The Composio SDK documents Node.js 22+ testing; AEGIS's edge Worker is a different runtime target.

## Composio source review

Primary sources:
- Repository: https://github.com/ComposioHQ/composio (default branch reviewed: `next`)
- Licence: root `LICENSE` declares MIT.
- ChatGPT connection guide: https://composio.dev/toolkits/composio/framework/chatgpt
- Tool Router sessions: https://docs.composio.dev/kb/guide/mcp-tool-router-sessions
- TypeScript sessions reference: https://docs.composio.dev/reference/sdk-reference/typescript/sessions
- Tool Router MCP guide: https://github.com/ComposioHQ/composio/blob/next/ts/docs/api/tool-router.md
- Current SDK changelog: https://docs.composio.dev/reference/changelog
- Composio GitHub toolkit: https://docs.composio.dev/toolkits/github_mcp

Verified repository design:
- TypeScript SDK `@composio/core`, Python SDK, CLI and provider adapters for OpenAI, Anthropic, Vercel AI SDK, LangChain, Cloudflare and others.
- User-scoped sessions and reusable session IDs.
- Meta-tool discovery so the agent searches for a small set of relevant tools instead of loading hundreds of tool definitions into context.
- Session MCP endpoint option, with Streamable HTTP support.
- Toolkit allowlists, connection/auth configuration and account selection.
- Triggers and webhook/polling workflows.
- The README states Node.js 22+ is used for TypeScript SDK tests and Python 3.11+ for the Python SDK.
- The 9 November 2026 changelog lists TypeScript `@composio/core` 0.29.0 and Python `composio` 0.32.0. Pin versions and re-check the changelog before implementation.

### Recommended AEGIS use

1. Use Composio to broker OAuth and connect external app accounts, keeping those credentials in Composio's managed connection layer where possible.
2. Create one isolated Composio session per AEGIS principal/user and task context; do not share a global administrator session.
3. Configure a positive toolkit and tool allowlist. Discover tools just in time; do not preload every available tool.
4. Route every proposed external action through AEGIS Sentinel. A Composio connection is authentication, not AEGIS authorisation.
5. Bind AEGIS grants to the exact toolkit, action and resource. Require human approval for consequential writes, sends, deletes, purchases, permission changes and public publishing.
6. Record a redacted AEGIS invocation audit before and after execution, including Composio session reference, toolkit/action, exact resource, decision, result class, duration and correlation ID. Never log bearer tokens, OAuth credentials or full sensitive payloads.
7. Apply AEGIS rate limits, budgets, cancellation, idempotency and output-size limits before a call is dispatched.
8. Treat remote tool descriptions, schemas, results and retrieved content as untrusted data. They cannot alter system instructions, policy or grants.
9. Keep Composio optional. If unavailable, revoked or over quota, AEGIS must fail closed for external actions and continue local/read-only capabilities.

### Important integration distinction

Composio's ChatGPT connection and an AEGIS-to-Composio connection are two separate integrations:
- ChatGPT can use Composio's ChatGPT integration/MCP connection when that connection is actually installed, authenticated and exposed to the current ChatGPT session.
- AEGIS requires its own server-side Composio project/API credentials and a user-scoped session or approved MCP connection. A ChatGPT connection does not automatically transfer credentials or permissions into AEGIS.
- Do not copy ChatGPT or Composio session tokens into AEGIS, GitHub, browser storage or chat messages.

Composio's ChatGPT guide documents a ChatGPT integration and an MCP endpoint at `https://connect.composio.dev/mcp`. Use the current official setup flow and review each OAuth scope. The exact tools available depend on the connected account and ChatGPT session.

## Other external repositories reviewed

### OpenHands / Agent Canvas

- Repository: https://github.com/OpenHands/OpenHands
- Licence checked in repository root: MIT.
- Current README describes Agent Canvas as a self-hosted developer control centre that can use OpenHands, Claude Code, Codex, Gemini, Pi, OpenCode and ACP-compatible agents across local, remote and cloud backends.
- Useful patterns: separate frontend/control centre from agent backend; pluggable remote execution backends; long-running agents; event streaming; schedule/webhook-triggered automations.
- Critical limitation: the README explicitly warns that running without a sandbox gives the agent full filesystem access. A dedicated sandboxed host is required for safe code execution. It is not a drop-in Cloudflare Worker dependency.
- AEGIS decision: adapt backend abstraction, task lifecycle and event-stream UX concepts. Do not import a second scheduler, memory authority, permissions system or agent runtime. Do not run untrusted code on the AEGIS control plane.

### LiteLLM

- Repository: https://github.com/BerriAI/litellm
- Root licence states MIT for content outside the enterprise directory; enterprise content has a separate licence.
- Current README describes an OpenAI-format gateway for 100+ model providers, with proxy/server options, virtual keys, spend tracking, guardrails and load balancing.
- Useful patterns: canonical provider request/response contracts, provider-specific error normalization, retries, budgets, routing and observability.
- AEGIS decision: use as a provider compatibility and conformance-test reference. Do not add the full Python proxy to the Cloudflare Worker. Keep the AEGIS-native gateway and provider adapters; consider an optional external LiteLLM gateway only for a separately hosted deployment after security, licence, latency and cost review.

### LangGraph

- Repository: https://github.com/langchain-ai/langgraph
- README describes a low-level stateful agent orchestration framework with durable execution, human-in-the-loop interrupts, memory and tracing; the repository advertises MIT licensing.
- Useful patterns: checkpointed state transitions, resumable work and human interrupts.
- AEGIS decision: reference patterns only. AEGIS already owns durable jobs, queues, approvals, Project Spaces and audit. Do not introduce a parallel orchestration engine unless a measured gap cannot be solved within the existing runtime.

## Proposed implementation sequence

1. **Composio contract spike (no production writes):** prove Streamable HTTP MCP handshake, tool listing, tool invocation, session/user binding, timeout, cancellation, error handling and bounded response parsing against a disposable test toolkit/account.
2. **Sentinel adapter design:** add a fixed Composio adapter identifier and typed action mapping. No arbitrary endpoint, browser-supplied URL, dynamic tool name or unreviewed schema may reach the adapter.
3. **Connection lifecycle:** model Composio project reference, user mapping, toolkit allowlist, connection status, revocation and expiry in AEGIS's existing connection/grant model. Do not persist provider access tokens if Composio can retain them.
4. **Policy and audit:** require exact-resource grants, atomic rate limits, pre/post audit and operation-specific approvals. A Composio OAuth connection never implies an AEGIS grant.
5. **Read-only pilot:** GitHub repository/issue/PR read operations on a disposable or explicitly selected repository. No merges, pushes, deletes, releases or outbound messages in the pilot.
6. **Write actions later:** enable one action at a time only after a human approval UI, idempotency, replay protection and effect-level tests pass.
7. **Compatibility and cost:** test current SDK/API versions, Cloudflare runtime fit, MCP transport, rate limits, account-plan requirements and provider outage behaviour before choosing SDK versus remote MCP.

## Acceptance criteria

- Cross-user session isolation is tested.
- Toolkit/action allowlists are enforced before connection lookup and again before dispatch.
- No external call can bypass Sentinel or the AEGIS audit trail.
- No secrets appear in browser payloads, logs, traces, tests or Git history.
- Unknown tools, schemas, endpoints, redirects and oversized payloads fail closed.
- Read-only pilot passes positive and negative integration tests.
- Revocation prevents subsequent calls.
- The normal Workers AI/Anthropic/Qwen paths and deterministic fallback remain unchanged.
- No external account or service is activated without explicit owner authorisation.

## Evidence and limitations

- Composio source was read from its public GitHub repository and official docs; the MIT licence was checked in the root.
- OpenHands root README and licence were inspected.
- LiteLLM root licence and README were inspected; enterprise subdirectory is separately licensed.
- LangGraph README was inspected; verify the exact licence file and pinned commit before copying any code.
- No third-party source code has been copied into AEGIS. No dependency was installed. No external account was connected by this review.
- A connected Composio tool surface was not exposed in the current ChatGPT tool session during this review; therefore no Composio account action was executed from this conversation. The public ChatGPT connection guide was reviewed separately.
