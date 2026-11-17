# AGENT AEGIS — Your Personal Guardian

**A human-centred artificial intelligence: an intelligent agent, personal companion and protective guardian.**

AEGIS remains the name of the underlying open-source intelligence platform and architecture. **Agent AEGIS** is the product identity; **Your Personal Guardian** describes its purpose. The companion is designed to feel as natural and human-centred as possible while remaining transparent that it is artificial intelligence, respecting user autonomy, privacy and human relationships.

AEGIS is an evolving project. The current repository is an early Cloudflare Pages prototype. Its larger autonomous assistant, voice, model router, durable knowledge store, managed integrations and full AEGIS Forge workshop are still being developed.

## Product identity and experience

Agent AEGIS is intended to combine capable independent reasoning with a consistent, customisable, human-like companion presence. Its design references include the curiosity and learning of Data from *Star Trek*, the embodied personality of Rommie from *Andromeda*, and the protective pattern-recognition concept of the Machine from *Person of Interest*—without copying fictional claims or behaviours. The goal is natural conversation, social understanding, user-approved memory, expressive voice and avatar interaction, ingenuity and proportionate protection. It must not claim human consciousness, infer private mental states as facts, manipulate users or replace human relationships.

The companion is a first-class presentation layer over one shared AEGIS intelligence core. Users should be able to choose the official Agent AEGIS identity or create and customise their own companion identity, with continuity across supported devices. This remains a roadmap direction unless a capability is explicitly listed as implemented below.

## Current foundation

- Mobile-friendly chat interface for iPhone, iPad and Chromebook browsers
- Cloudflare Pages Functions API
- Cloudflare Workers AI binding for the current chat model
- Optional Cloudflare KV binding for simple notes
- Password sign-in with signed, expiring, HttpOnly browser sessions
- AEGIS-native skills registry seeded with ten adapted Superpowers engineering skills
- Contextual skill guidance injected into chat for relevant engineering and planning requests
- Authenticated, no-store module and skills registry endpoints
- AEGIS Forge capability declarations for universal source discovery, inspection, comparison, evaluation, planning and benchmarking
- AEGIS Engineering Intelligence capability boundary for attributed, evidence-rated knowledge
- Pure validators for Forge source-candidate and engineering-knowledge records
- Owner-only persisted Knowledge Library with evidence sources, limitations, draft/review/accept/supersede lifecycle and append-only history
- Read-only public GitHub repository discovery behind session authentication and same-origin protection
- Initial authenticated, stateless MCP Bridge endpoint (`POST /mcp`) with read-only status, modules and skills tools
- First standalone AEGIS Runtime Worker source: authenticated job API, D1 job/event schema, Queue consumer, Cron outbox/lease recovery and attempt-fenced state transitions (not yet deployed)
- Owner-only capability approval inbox and approve/deny API under development on a feature branch (not deployed; no capability execution is enabled)

## Security setup

**Do not expose a deployment until both secrets are configured.**

In the Cloudflare dashboard, open the AEGIS Pages project and add these as encrypted secrets for the production environment (and separately for Preview if you use it):

1. `AEGIS_PASSWORD` — a unique password of at least 12 characters.
2. `AEGIS_SESSION_SECRET` — a cryptographically random secret of at least 32 characters. Do not reuse your AEGIS password.

Redeploy after adding or changing secrets. The browser session lasts 12 hours and is stored in a Secure, HttpOnly, SameSite=Strict, host-only cookie. The chat and memory APIs reject requests without a valid session. Never put either secret in `index.html`, browser storage, GitHub, or a public environment variable.

If the login screen says security setup is unfinished, configure both secrets before using AEGIS.

## Forge and engineering intelligence

Forge is being developed as a universal, safe transformation engine for repositories, MCP servers, APIs, SDKs, packages, frameworks and authorised application interfaces. Its first live adapter performs read-only public GitHub repository metadata discovery at authenticated `POST /api/forge/discover`.

Candidate records preserve source versions and licence review. The Knowledge Library stores attributable findings, evidence levels, limitations and capability tags. New records start as drafts; only owner-reviewed high/medium evidence can be accepted, and accepted content is immutable with append-only review history. Unknown licences are a hold, not permission to reuse. Retrieved source material is untrusted data: discovery does not execute repository code or grant tool permissions.

See [docs/FORGE_INTELLIGENCE.md](docs/FORGE_INTELLIGENCE.md).

## MCP Bridge (initial read-only phase)

The first AEGIS Bridge slice exposes the current stateless MCP Streamable HTTP protocol at `POST /mcp`. It supports `server/discover`, `tools/list` and `tools/call`, with read-only status, module and skills tools. It does not yet provide OAuth 2.1/PKCE, per-client scopes, write operations or a general outbound connector manager. See [docs/AEGIS_BRIDGE.md](docs/AEGIS_BRIDGE.md) for the protocol, authentication boundary and current limitations. The endpoint fails closed until an authorised bearer secret or valid AEGIS session is configured.

## Skills library

The first skills library is based on [obra/superpowers](https://github.com/obra/superpowers) (MIT). AEGIS adapts ten high-value engineering skills into its own registry and selects up to four relevant guidance entries per chat request. It does not install upstream plugins, scripts, hooks or telemetry, and imported skills receive no tool permissions. See [docs/SUPERPOWERS.md](docs/SUPERPOWERS.md).

## Data and provider notes

The source code is open for inspection and modification. Hosting, storage, and model inference may have separate provider limits or costs. Requests sent to an external AI provider are processed under that provider's terms; open-source application code does not by itself make model inference private or free.

## Development

Run the full test suite with Node.js 22:

```sh
node --test tests/*.test.mjs
```

The first durable runtime slice is now implemented in source under `workers/runtime/` and `migrations/runtime/`, with a single allowlisted health-check task. It is not yet deployed: D1/Queue resources and an encrypted Worker secret must be configured first. See [docs/AEGIS_RUNTIME.md](docs/AEGIS_RUNTIME.md). Durable specialist execution, retrieval of accepted Knowledge Library records into agent context, the general MCP/API connector manager, voice engine and production Forge sandbox remain on the roadmap. The Knowledge Library currently has owner-only search/intake/review APIs and a Forge UI; it is not yet automatically injected into agent plans.

## Project blueprint and AI handover

The canonical architecture, operating principles, verified baseline, roadmap and fresh-session handover are maintained in [docs/AEGIS_MASTER_BLUEPRINT.md](docs/AEGIS_MASTER_BLUEPRINT.md). AI and engineering agents must read [AGENTS.md](AGENTS.md) before making changes. These documents are living records; always verify live repository and deployment state before relying on status notes.


## Cross-platform roadmap

AEGIS is being designed around one portable core and replaceable client/platform adapters. The first target is a responsive web/PWA experience across Chromebook, iPhone and iPad browsers, with Android, Windows, macOS and Linux extensions added when validated. See [docs/PLATFORM_COMPATIBILITY.md](docs/PLATFORM_COMPATIBILITY.md). This roadmap does not claim those later clients are already implemented.


## Project Spaces

AEGIS includes owner-scoped Project Spaces and an append-only activity timeline as the durable project-context layer. The implementation is documented in [docs/AEGIS_PROJECT_SPACES.md](docs/AEGIS_PROJECT_SPACES.md). The API and migration are source-level foundations; production D1 provisioning and deployment remain separate gated steps.


## Governed capability foundation

The repository includes source-level capability grants, provider connection metadata, an AES-GCM secret vault, append-only invocation audit and provider/model token planning. Production D1 migrations, vault keyring provisioning, live provider connections and adapter execution remain separately gated; see the capability architecture documents.


## Durable agent orchestration

AEGIS has a plan-only durable specialist-run workflow on the existing runtime Worker and Queue. It stores objectives, idempotency and plans in D1; it does not run LLM agents or tools. See [docs/AEGIS_AGENT_ORCHESTRATION.md](docs/AEGIS_AGENT_ORCHESTRATION.md). Production activation requires the D1 migration and explicit `AGENT_RUNS_ENABLED=true` configuration.


## Forge repository inspection

AEGIS Forge now has owner-authenticated, read-only endpoints to inspect public GitHub repository trees and read selected text blobs by immutable SHA. Requests and responses are bounded; outbound requests use only the fixed GitHub API origin, reject redirects and have a timeout. Source is never installed or executed and remains untrusted reference data. See [AEGIS Forge](AEGIS_FORGE.md).


## Owner-controlled capability grants

The owner-only `/api/grants` route provides bounded grant history, exact-resource grant creation and revocation. The server derives principal, actor, capability version and scopes from the approved registry; browser-supplied principals/scopes are rejected. A grant is not an approval and cannot bypass Sentinel's human approval gate. See [AEGIS capability grant management](AEGIS_CAPABILITY_GRANT_MANAGEMENT.md).


## Project Space handover briefs

The owner-only `GET /api/workspaces/:id/brief` endpoint creates a bounded, read-only handover brief from one active Project Space. It includes recent event summaries and accepted, non-restricted, unexpired project memories only; source URLs and raw event bodies are excluded. Content is marked untrusted reference data and never grants permissions. See [AEGIS Project Space briefs](AEGIS_PROJECT_BRIEFS.md).


## Forge candidate review

Forge can persist inspected public repositories as owner-reviewed candidates pinned to a Git tree SHA. Candidates begin unassessed and licence-review-required; owner attestation and evidence are required before reuse/adaptation or approval. D1 triggers enforce the licence gate and append-only history. No repository is installed or executed.

## Forge Knowledge Library

The Forge panel includes a searchable owner-only Knowledge Library. New records preserve source URLs and attribution, evidence level, limitations and applicable capability tags. Records start as drafts; owner review is explicit, low/experimental evidence cannot be accepted, reviewed content is immutable, and create/review/accept/supersede history is append-only. Search defaults to accepted records only. Accepted high/medium evidence records are now attached to Project Space agent-run context after objective-relevance ranking; retrieved content remains untrusted reference data and never grants permissions. See [Forge intelligence](docs/FORGE_INTELLIGENCE.md) and [AEGIS Forge](docs/AEGIS_FORGE.md).


## First owner-facing invocation route

`POST /api/sentinel/invoke` exposes exactly one action: `aegis-module-catalogue:list` on resource `aegis:modules` with empty input. It requires a valid owner session, same-origin request, configured AEGIS D1 and an exact active grant. The route derives the canonical input digest server-side and calls `runSentinelInvocation` through the trusted D1 composition root. It returns output only after the success audit is recorded. Unknown capabilities, actions, resources, adapter names, endpoints and non-empty inputs are rejected. This is a source-level restricted route, not a general tool endpoint; no external or consequential action is exposed.


## AG-UI and guarded model tools

AEGIS exposes an authenticated AG-UI 1.0 streaming endpoint. Text-only Workers AI is the default; optional Qwen function calling is disabled unless explicitly enabled with owner-configured runtime settings. The only tools are a local read-only module catalogue and bounded public GitHub repository metadata, both mediated by Sentinel. See [docs/AEGIS_AGENT_TOOLS.md](docs/AEGIS_AGENT_TOOLS.md).


## Anthropic provider adapter

The server-side AG-UI model gateway now has an optional Anthropic Messages SSE adapter. It uses the fixed Anthropic API endpoint, a server-side ANTHROPIC_API_KEY runtime secret and an explicitly configured AEGIS_ANTHROPIC_MODEL. Anthropic text deltas are translated into the existing AG-UI stream. Tool calling remains disabled for this adapter; the governed Qwen tool loop is separate. A GitHub Actions secret is not automatically available to Cloudflare runtime. See docs/AEGIS_MODEL_PROVIDERS.md.

## Planned universal companion and device architecture

AEGIS is being designed around one shared intelligence core and an adaptive companion experience across desktop, mobile, tablet, browser, XR and feasible console/TV pathways. The interface will assess supported capabilities with privacy-preserving feature detection and select an appropriate experience tier—from accessible text/voice to lightweight and advanced 3D or optional immersive XR. Advanced graphics will never be required for essential AEGIS use.

See [Universal Device and 3D Companion Architecture](docs/AEGIS_UNIVERSAL_DEVICE_AND_3D_EXPERIENCE.md) for the proposed architecture, minimum support contract, privacy boundaries, platform strategy, performance tiers and implementation sequence. This is a planned architecture, not a claim that every platform is already supported.


## Capability roadmap and upstream adoption

See [AEGIS Capability Roadmap](docs/AEGIS_CAPABILITY_ROADMAP.md) for the build/adapt/connect/reject decisions, delivery gates, acceptance criteria, upstream selection scorecard and honest progress-tracking rules. The roadmap is a plan, not a claim that future capabilities are already implemented.




## Guardian Intelligence — learning, resources and security research

AEGIS now has pure validators for Resource Intelligence records, acyclic Learning Graphs and evidence-backed Security Findings. The first Resource Catalogue slice also has owner-scoped D1 persistence and authenticated, same-origin `GET/POST /api/guardian/resources`; records are server-identified, idempotent by source revision and created as drafts. Learning graph persistence, the owner-facing catalogue UI, security finding persistence and all scanning/execution remain future work. See [Guardian Intelligence contracts](docs/AEGIS_GUARDIAN_INTELLIGENCE_CONTRACTS.md) and [the 17 November REA batch](docs/REA_BATCH_2026-11-17_OPEN_SOURCE_LEARNING_SECURITY.md). Dynamic security testing remains disabled until Sentinel-backed exact-scope authorisation and isolated-worker enforcement are implemented and tested.


## Guardian Resource review lifecycle

Guardian Resources now have an owner-scoped review transition API. Records start as drafts; review transitions use optimistic concurrency, bounded reviewer notes and server-derived reviewer identity. Source content and source identity are immutable after intake. Acceptance is blocked unless the licence is marked verified and has an HTTPS evidence reference. D1 triggers enforce the transition rules and append-only review events. This is a source-level feature on draft PR #103, not yet deployed.

## UI ecosystem research

AEGIS maintains a researched, framework-neutral UI direction: AEGIS-owned design tokens, semantic primitives, accessibility and motion contracts, with optional React and Vue adapters. The current research intake covers shadcn/ui, Magic UI, Aceternity UI, HyperUI, Material UI, React, Vue, Tailwind CSS and the Awesome React/Vue/Frontend/Tailwind discovery lists. These are research candidates, not blanket dependencies or blanket code-reuse approvals. See [AEGIS UI ecosystem research](docs/AEGIS_UI_ECOSYSTEM_RESEARCH_2026-11-17.md).


## Workspace, knowledge and coding-agent research

The 17 November 2026 ecosystem review covers ToolJet, Mattermost, Outline, Plausible, Continue, Roo Code, SWE-agent, Plandex, GPT Pilot, Tabby and Goose. AEGIS will own its Workbench, Knowledge Forge, collaboration/task model, privacy-preserving observability and governed coding-agent workforce; upstream projects remain research references or optional adapters. GPT Pilot is excluded from execution/adoption due to its disclosed supply-chain credential-stealing incident and discontinued maintenance. Licence and maintenance status vary by project; see [the full research and security assessment](docs/AEGIS_WORKSPACE_KNOWLEDGE_CODING_AGENTS_2026-11-17.md).


## AEGIS Forge — 80-idea audit additions

The 17 November 2026 Forge audit adds four research tracks: privacy-preserving MediaPipe camera/gesture interaction, optional FastMCP local sidecars, and native scam/phishing/document-clause risk protection. These are not yet implemented. Face landmarks are not proof of liveness, hand landmarks are not full sign-language translation, OpenPhish's free feed is non-commercial, and suspicious destinations must never be fetched during checks. Passkeys remain the preferred authentication mechanism. See [the full capability and safety assessment](docs/AEGIS_FORGE_80_IDEA_AUDIT_ADDITIONS_2026-11-17.md).


## Eval Forge

AEGIS now has a first deterministic evaluation contract: versioned suites, bounded weighted cases, candidate artifact digests, per-case evidence digests and required-case gates. This scorer does not execute tests or verify evidence provenance; persistence, isolated evaluation workers, the owner-facing UI and promotion review remain future work. Scores never grant permissions or deploy candidates. See [AEGIS Eval Forge](docs/AEGIS_EVAL_FORGE.md).
