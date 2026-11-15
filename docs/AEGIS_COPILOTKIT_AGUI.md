# AEGIS Agent UI and AG-UI Compatibility

Reviewed: 15 November 2026

## Decision

CopilotKit is a high-priority UI/protocol reference, not an AEGIS core dependency. AEGIS will reverse-engineer the useful interaction patterns and implement a small native compatibility boundary before considering a framework migration.

- Upstream: https://github.com/CopilotKit/CopilotKit
- Official site: https://copilotkit.org/
- Docs: https://docs.copilotkit.ai/
- AG-UI protocol: https://github.com/ag-ui-protocol/ag-ui
- Protocol source reviewed at commit `2330368a2a74573902858867072406638ba3073d` (MIT repository): [run lifecycle](https://github.com/ag-ui-protocol/ag-ui/blob/2330368a2a74573902858867072406638ba3073d/docs/spec/1.0/events/lifecycle.mdx), [text messages](https://github.com/ag-ui-protocol/ag-ui/blob/2330368a2a74573902858867072406638ba3073d/docs/spec/1.0/events/text-messages.mdx), [run input](https://github.com/ag-ui-protocol/ag-ui/blob/2330368a2a74573902858867072406638ba3073d/docs/spec/1.0/basic/run-input.mdx), [frozen 1.0 wire schema](https://github.com/ag-ui-protocol/ag-ui/blob/2330368a2a74573902858867072406638ba3073d/spec/1.0/proto-freeze.txt)
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
- Provider output is bounded to 12,000 characters. A provider startup failure emits RUN_ERROR as the first SSE event; a mid-stream provider failure emits a safe RUN_ERROR event without leaking provider exception details.
- The existing mobile PWA chat now sends AG-UI 1.0 runs, consumes `ReadableStream` chunks and appends each text delta as it arrives; it no longer calls the legacy `/api/ask` JSON route directly.
- It reuses the existing signed-session authentication and same-origin check, and the same shared prompt-context builder as `/api/ask`, so approved personal and explicitly selected project memory plus registered skill context remain part of the canonical assistant.
- An optional `projectId` is checked against an active owner-owned Project Space before the model is called. Frontend tools, ambient context, resume, multimodal messages and arbitrary state are explicitly rejected until their server-side policy and lifecycle semantics exist. The endpoint cannot execute tools.
- Event types, identifiers, message size, body size and serialized event size are bounded. Only the six implemented event types can be emitted by the encoder.
- AG-UI 1.0's lifecycle rules were checked against the pinned normative source: a valid stream begins with RUN_STARTED or RUN_ERROR; an output stream deliberately stopped by AEGIS's 12,000-character safety cap closes its text message and now reports RUN_FINISHED with `outcome: cancelled`, rather than falsely reporting success. A client disconnect is not converted into a successful finish.
- Latest verified feature-branch commit `0d795002bfb45f267a5faba1c0d25174ec9c95c9` passed GitHub Actions run 43750742950: **288 tests, 0 failures** (Node.js 22): https://github.com/LAURENCE1977/Aegis-/actions/runs/43750742950.
- Cloudflare Pages preview for that commit deployed successfully at https://7aef49d9.aegis-6yk.pages.dev. Browser verification reached the AEGIS login screen; preview `/api/login` returns HTTP 503 until the two required Preview secrets are configured.

## Status and limitations

This is a native protocol adapter, not an installed CopilotKit client. No CopilotKit package, React migration, cloud service, account or upstream code has been added. No production application-code deployment, data, secrets or infrastructure change has been made from this feature branch. Two separate Markdown-only commits were accidentally pushed to `main` and triggered Pages redeploys; neither changed application source, data, secrets or infrastructure. See the operational note in `AEGIS_MASTER_BLUEPRINT.md`. Token-by-token text streaming, explicit Project Space context, a Projects timeline, an owner approval inbox, memory correction/export and a static-only PWA shell are implemented on the feature branch. Durable run resume, shared agent state, generative UI, frontend tool calls and Sentinel-bound approval events remain future work. It is a first compatibility slice, not full AG-UI conformance.


## Composio-assisted upstream review — 15 November 2026

### OpenBot and OpenFuse

- [CopilotKit/OpenBot](https://github.com/CopilotKit/OpenBot) is an MIT application template, but its documented stack includes a separately licensed CopilotKit Intelligence service, PostgreSQL, Kubernetes/containers, a Hono API, AG-UI Bot endpoints and dedicated computer containers. It is not a low-cost Cloudflare Pages/D1 dependency for AEGIS.
- High-value patterns extracted from its architecture documentation: the server-side gateway is the authority boundary; evaluate current policy before every action; durably record the decision before forwarding; record failure after forwarding; computer containers do not receive application secrets or database credentials; isolate per-person/per-agent computer workspaces; enforce outbound network policy at the computer boundary; support human takeover rather than bypassing CAPTCHA or human verification.
- [CopilotKit/openfuse](https://github.com/CopilotKit/openfuse) is MIT and explicitly described as alpha. Its README requires Node 24, pnpm, a CopilotKit Intelligence project key and a model-provider key; its documented hosted setup uses a persistent Standard service, disk and a separate browser worker. The verification document reports 154 tests and real Chromium/Docker checks for its September 2026 release; these are upstream-reported and do not prove AEGIS compatibility.
- Useful OpenFuse concepts: durable task plans, explicit pause/resume/cancel/retry, saved receipts, approvals, per-run activity, persistent browser takeover and separation of API/task/browser/computer workers.
- AEGIS decision: adapt the contracts and threat boundaries natively. Do not adopt either full stack, add a React migration, depend on CopilotKit Intelligence, import their code or add infrastructure. AEGIS keeps its own D1/job runtime, capability policy, Sentinel, approvals, vault and audit authoritative.

### AG-UI 1.0 conformance notes

- The pinned AG-UI 1.0 lifecycle specification says the first stream event MUST be RUN_STARTED or RUN_ERROR. A successful run ends with RUN_FINISHED; a producer-stopped run must declare the cancelled outcome; a consumer disconnect must not be misreported as a successful run.
- Text messages use a matching messageId and must be opened before content, closed before RUN_FINISHED.
- AEGIS implements only the bounded text-run subset. It rejects frontend tools, ambient context, resume, multimodal messages and arbitrary state until the corresponding backend policy, persistence and Sentinel semantics exist. This is deliberately partial conformance, not a claim of full AG-UI support.

## Retrieval research adapted from local-first memory projects

- [cognicore-dev/cognicore-env](https://github.com/cognicore-dev/cognicore-env) — Apache-2.0; local SQLite memory, bounded session handover briefs, curated project context and suggested-then-confirmed decisions. Its README describes lexical BM25/TF-IDF retrieval and notes vocabulary mismatch as a limitation; optional semantic retrieval adds dependencies. AEGIS adapts explicit review and compact handover ideas without adding its Python runtime or hosted MCP service.
- [Uranid/mnem](https://github.com/Uranid/mnem) — Apache-2.0; local/offline, versioned knowledge, content-addressed records, hybrid vector/keyword/graph retrieval and token-budget reporting. Rust/CLI/embedding footprint is not suitable as a required Cloudflare Worker dependency. AEGIS keeps D1 as canonical and selectively adapts version/provenance and explicit retrieval-budget principles.
- [MemTensor/MemOS](https://github.com/MemTensor/MemOS) — Apache-2.0; broad persistent memory and skill-reuse system. It is a larger multi-component architecture, so use as a comparison source rather than a required runtime.
- AEGIS's new retrieval implementation uses bounded BM25-style lexical ranking, exact token boundaries, tag/kind weighting and a maximum 200-row D1 candidate set. It adds no embedding service, vector database, Python/Rust runtime or API cost. It remains scoped to accepted, unexpired, non-restricted owner/project memories.
