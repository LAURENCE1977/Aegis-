# AEGIS Agent UI and AG-UI Compatibility

Reviewed: 15 November 2026

## Decision

CopilotKit is a high-priority UI/protocol reference, not an AEGIS core dependency. AEGIS will reverse-engineer the useful interaction patterns and implement a small native compatibility boundary before considering a framework migration.

- Upstream: https://github.com/CopilotKit/CopilotKit
- Official site: https://copilotkit.org/
- Docs: https://docs.copilotkit.ai/
- AG-UI protocol: https://github.com/ag-ui-protocol/ag-ui
- Reported upstream licence: MIT. Pin a commit and inspect package/dependency licences before any reuse.

## What is valuable

CopilotKit provides agent-facing application UI: chat, streaming progress, frontend tools, shared agent/application state, generative UI, and human-in-the-loop pauses. Its AG-UI protocol is an event-based agent-to-user interface contract. The CopilotKit TypeScript runtime is documented for server integrations including Cloudflare Workers; verify the exact version, APIs and deployment compatibility before adopting it.

The protocol boundary is more valuable to AEGIS than copying a React component library. It can keep the future interface replaceable while specialist agents and backend execution remain independent.

## AEGIS-native implementation

Build a deliberately small AG-UI-compatible adapter in the existing Cloudflare Pages/Workers application (first streaming text slice implemented):

1. Keep the current lightweight, responsive web/PWA shell initially. Do not migrate the whole application to React just to use CopilotKit.
2. Implemented on the current feature branch: a versioned authenticated agent interaction endpoint with SSE streaming and explicit run/thread identifiers. Long-running durable run persistence and reconnect/resume are still pending.
3. Map AEGIS's own chat lifecycle to protocol events: run start, text/message start and content, tool-call start/arguments/result, state snapshots/deltas where needed, run finish and structured errors. Confirm exact event names and payload schemas against the pinned AG-UI specification before implementation.
4. Expose only UI-safe state: current Project Space, job summaries, agent status and approval request summaries. Never stream secrets, raw vault contents, private environment values or unrestricted internal records.
5. Tool calls are proposals only. Every operation must route through AEGIS capability registry and Sentinel; AG-UI events and frontend callbacks are not authorization.
6. Approval is an explicit backend state transition bound to the authenticated owner, exact capability/action, target, payload digest, expiry and one-time use. UI approval cannot bypass server-side revalidation.
7. Use the existing durable job runtime for long-running work once it is deployed. SSE disconnect/reconnect must not lose durable job state; the client can resume by run ID and fetch authoritative status.
8. Add a headless client contract so a future React/CopilotKit client, the native PWA, mobile apps or a ChatGPT connector can all use the same AEGIS interaction API.

## Security requirements

- Authenticate every stream and action using the existing signed AEGIS session or a future scoped OAuth client. No unauthenticated direct agent endpoint.
- Validate same-origin/CSRF protections for browser writes; do not rely on CORS as an authorization boundary.
- Bound request bodies, event sizes, run duration, concurrent streams and replay windows.
- Use per-run ownership checks; do not trust client-supplied owner IDs, roles, tool names or approval state.
- Redact secrets and sensitive tool arguments from stream events and audit payloads.
- Treat model output, browser/page content, tool results and generative UI descriptions as untrusted data.
- Do not let generated UI execute arbitrary HTML, JavaScript, URLs, shell commands or arbitrary MCP Apps. Use registered, typed, allowlisted UI components.
- Persist canonical run/job/approval/audit state server-side. Browser state is a view, not the source of truth.

## Integration boundary

Potential future CopilotKit adapter:
- UI package only, loaded by an optional React client.
- AG-UI transport to AEGIS's authenticated endpoint.
- AEGIS-specific client adapter translates events and renders registered components.
- CopilotKit's own runtime/Intelligence/cloud service is not required for the first native implementation.

Do not introduce a second agent runtime or second memory store. AEGIS remains authoritative for identity, memory, Project Spaces, jobs, provider routing, capabilities, Sentinel, approvals, vault, audit and budgets.

## Current fit and constraints

- Current AEGIS frontend is a small static HTML/CSS/JavaScript PWA; there is no established React build system or package manifest on this feature branch.
- A wholesale React migration would add build/dependency complexity before the backend contracts are stable.
- User's target devices are Chromebook, iPhone and iPad browsers. A responsive PWA and server-side execution remain the first target.
- CopilotKit's open-source TypeScript runtime may be compatible with a Cloudflare edge adapter, but compatibility must be proven against AEGIS's actual Pages Functions/Workers deployment and chosen package version.
- No CopilotKit package, React dependency, cloud service, external account or upstream code has been installed or connected.

## Acceptance tests before any production integration

1. Unauthenticated stream and run requests are rejected.
2. Cross-origin writes and malformed/oversized event payloads are rejected.
3. Authenticated owner can start a run and receive a correctly ordered event stream.
4. Client disconnect/reconnect resumes authoritative run state without duplicating a side effect.
5. Agent tool proposal without a valid Sentinel grant/approval never invokes an adapter.
6. Approval is bound to exact action and payload digest, expires and cannot be replayed.
7. Secrets and restricted memory never appear in stream events.
8. Unknown event types, component names and generated UI payloads fail closed.
9. Job state survives page reload and mobile background suspension.
10. Native PWA and a future CopilotKit client produce the same backend job/approval outcomes.

## Implementation order

1. Pin and inspect the AG-UI protocol schema and current CopilotKit runtime/Workers adapter source.
2. Add protocol conformance fixtures and failing tests before implementing event encoding/decoding.
3. Build the minimal authenticated SSE run endpoint over the existing AEGIS chat/job interfaces.
4. Wire run state to Project Spaces and the durable job runtime.
5. Add typed UI action and approval events through Sentinel.
6. Only then compare a thin CopilotKit React client against the native PWA and decide whether its UI components justify a controlled migration.

## Implemented native slice

- `functions/lib/ag-ui.mjs` emits a bounded AG-UI 1.0 text-run lifecycle and encodes allowlisted event frames as SSE.
- Authenticated `POST /api/ag-ui` accepts a bounded protocol 1.0 run containing plain-text user/assistant messages, calls Workers AI with `stream: true`, parses provider SSE frames (including frames split across network chunks), and emits RUN_STARTED, TEXT_MESSAGE_START, incremental TEXT_MESSAGE_CONTENT events, TEXT_MESSAGE_END, RUN_FINISHED and redacted RUN_ERROR.
- Provider output is bounded to 12,000 characters. A mid-stream provider failure emits a safe RUN_ERROR event without leaking provider exception details.
- The existing mobile PWA chat now sends AG-UI 1.0 runs, consumes `ReadableStream` chunks and appends each text delta as it arrives; it no longer calls the legacy `/api/ask` JSON route directly.
- It reuses the existing signed-session authentication and same-origin check, and the same shared prompt-context builder as `/api/ask`, so approved personal and explicitly selected project memory plus registered skill context remain part of the canonical assistant.
- An optional `projectId` is checked against an active owner-owned Project Space before the model is called. Frontend tools, ambient context, resume, multimodal messages and arbitrary state are explicitly rejected until their server-side policy and lifecycle semantics exist. The endpoint cannot execute tools.
- Event types, identifiers, message size, body size and serialized event size are bounded. Only the five implemented event types can be emitted by the encoder.
- Latest branch head `e3b79ff795e1181576e7f9c3a66f5784e17bcf7e` passed GitHub Actions run 43744994054: **230 tests, 0 failures** (Node.js 22): https://github.com/LAURENCE1977/Aegis-/actions/runs/43744994054.
- Cloudflare Pages preview for that commit deployed successfully at https://7aef49d9.aegis-6yk.pages.dev. Browser verification reached the AEGIS login screen; preview `/api/login` returns HTTP 503 until the two required Preview secrets are configured.

## Status and limitations

This is a native protocol adapter, not an installed CopilotKit client. No CopilotKit package, React migration, cloud service, account or upstream code has been added. No production deployment or infrastructure change has occurred. Token-by-token text streaming, explicit Project Space context, a Projects timeline, an owner approval inbox, memory correction/export and a static-only PWA shell are implemented on the feature branch. Durable run resume, shared agent state, generative UI, frontend tool calls and Sentinel-bound approval events remain future work. It is a first compatibility slice, not full AG-UI conformance.
