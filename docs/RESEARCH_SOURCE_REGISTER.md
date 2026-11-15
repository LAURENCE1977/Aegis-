# AEGIS Research Source Register — UI, Agent OS and Developer Communities

Reviewed: 15 November 2026

This is an evaluation register, not an integration claim. No external package, agent platform or service below has been installed or granted access to AEGIS.

## Priority assessment

| Source | Best AEGIS use | Recommendation |
|---|---|---|
| Vercel AI SDK / AI SDK UI | Provider-neutral model/tool layer, streaming chat UI, typed tool calls, approvals, MCP | High-priority architecture reference; selective adoption after stack-fit review |
| Vstorm AgenticOS | Governed-agent architecture, shared knowledge, budgets, approvals, audit and operator console | Study and selectively adapt; do not deploy wholesale |
| Google ARTEMIS | Android UI automation, real-device testing, MCP-driven test execution and diagnostic traces | High-value optional mobile QA adapter if AEGIS ships/tests an Android client; not an AEGIS runtime dependency |
| TruffleHog | Secret discovery in AEGIS repositories, history and CI artifacts | High-priority security control to evaluate for isolated CI scans; do not automatically verify or expose detected credentials |
| OpenHarness (assumed autonomous-ai/openharness) | Multi-agent workspace, remote machine daemons, agent sessions and cross-machine coordination | Strong architecture candidate to study; desktop/daemon stack is not directly deployable on the current Chromebook-first Cloudflare setup |
| Harness.io platform (alternate interpretation of “Harness”) | Governed CI/CD, security testing, release controls, policy, audit and cost governance | Architecture reference; defer platform integration because it is broader and likely heavier than AEGIS needs |
| BLA (assumed qybaihe/bla, Blind LLM Agents) | Protect shipped binaries and bundles from automated reverse engineering | Niche optional release-hardening experiment only if AEGIS ships valuable client-side artifacts |
| SolidCraft | Parametric 3D CAD, browser/desktop modelling, CLI and MCP-driven model creation | Future Media Studio / 3D asset capability reference; unrelated to current core runtime |
| Dev.to | Discover practitioner articles, implementation notes and emerging patterns | Research input only; verify claims against primary sources |
| Stack Overflow | Troubleshooting, edge cases, failure modes and practical implementation evidence | Research input with strict attribution/licence handling |
| Frontend Mentor | Realistic UI challenges and independent frontend quality benchmarks | Optional UI/UX acceptance-test inspiration |
| v0 (assumed from “vo”) | Rapid UI prototypes and design exploration against GitHub branches | Optional prototyping tool; not a runtime dependency |
| Blackbox AI | External coding-agent orchestration, sandboxed runs, multi-agent comparison and PR workflow | Potential optional Forge adapter; defer pending security, API and cost review |

## Vercel AI SDK and AI SDK UI

Sources:
- https://github.com/vercel/ai
- https://ai-sdk.dev/docs
- https://ai-sdk.dev/docs/ai-sdk-ui/overview
- https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools
- https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage

Useful capabilities:
- AI SDK Core offers a common TypeScript interface for model generation, structured output, tool calling and agent loops across providers.
- AI SDK UI offers streaming chat/completion/structured-object hooks across supported UI frameworks.
- Tool calls can be server-executed, client-executed or held for user approval.
- MCP client support includes Streamable HTTP; HTTP is recommended for production, while stdio is intended for local connections.
- Current AI SDK 7 materials describe durable WorkflowAgent execution, approvals, sandbox support, harness integration and observability.

AEGIS decision:
- Leading implementation reference for the future provider router and interactive assistant UI.
- Preserve AEGIS's existing framework and Cloudflare architecture. Do not add a React-only dependency to a non-React surface without checking the actual frontend stack and bundle/runtime impact.
- Prefer protocol compatibility and small adapters over adopting the entire Vercel platform.
- Evaluate SDK version, Cloudflare Workers compatibility, package size, provider support, licence and API cost before installation.
- The current AEGIS MCP Bridge is a server endpoint; a future outbound MCP client is a separate capability.

## AgenticOS

Primary candidate:
- https://github.com/vstorm-co/agenticos
- Repository reports Apache-2.0 licensing.
- Described stack: FastAPI, Pydantic AI, PostgreSQL/pgvector, Redis and Next.js, with MCP integrations, access controls, budgets, approvals and audit.

Useful patterns:
- Separate agent runtime from the operator-facing console.
- Shared runner across UI/API/chat channels.
- Explicit budgets, access roles, tool allowlists, approval gates and run audit.
- Knowledge ingestion and agent configuration separated from code-defined capabilities.

AEGIS decision:
- High-value architecture and security-review reference.
- Do not fork or deploy wholesale at this stage. The documented infrastructure footprint (PostgreSQL/pgvector, Redis, Docker and a server-class host) conflicts with AEGIS's current low-cost Cloudflare/mobile-first direction.
- Extract patterns, not framework lock-in. Any copied code must be independently licence-reviewed and tested.

Other similarly named Agentic OS repositories exist. Pin exact owner/repository, commit and licence before evaluation.

## Google ARTEMIS

Primary candidate:
- https://github.com/google/artemis
- Google repository reports Apache-2.0 licensing.
- Natural-language Android automation with real-device/emulator execution, UI hierarchy and visual targeting, task traces, CLI/Python SDK, web console and an MCP server.

Useful capabilities:
- Exercise real Android app workflows instead of relying only on mocked browser tests.
- Capture screenshots, logs and execution traces for reproducible bug reports.
- Expose mobile test execution to compatible coding agents through MCP.
- Separate fast reactive execution from a more deliberate plan/execute/check workflow.

AEGIS decision:
- Strong optional QA adapter for a future Android AEGIS client or Android-specific companion workflow.
- Not a fit for the current Cloudflare Worker runtime: it expects a separate Python/ADB-capable host and an attached Android device or emulator.
- The user's primary devices are Chromebook, iPad and iPhone; ARTEMIS is Android-only today, so it does not solve iOS testing and should not be treated as a general mobile automation layer.
- If trialled, isolate the device host, use a disposable test device/account, restrict MCP tools to test actions, and require approval before any action that sends messages, makes purchases, changes accounts or affects real data.
- Validate Google's published benchmark claims independently; benchmark scores are not a guarantee for AEGIS-specific workflows.

## TruffleHog

Primary candidate:
- https://github.com/trufflesecurity/trufflehog
- Official README: https://github.com/trufflesecurity/trufflehog/blob/main/README.md
- Since v3.0, the repository states it is licensed AGPL-3.0. Check the exact release and licence before embedding or redistributing any component.

Useful capabilities:
- Discover and classify credentials across Git repositories, filesystems, logs and supported external sources.
- Distinguish detected, verified and unknown credentials; verification can contact the corresponding external service.
- Run as a standalone scanner and integrate into CI/pre-commit workflows.

AEGIS decision:
- High-priority candidate for a controlled secret-scanning gate on AEGIS source and release workflows.
- Prefer a pinned standalone CLI or isolated CI action over importing its code into AEGIS, subject to licence, provenance, supply-chain and runner review.
- Start with local/repository-history detection that does not attempt live credential verification. Do not print secret values in logs, PR comments or AEGIS memory; redact findings and restrict access.
- Live verification may send authentication attempts to external providers and reveal whether a credential is active. Keep it disabled unless separately authorised and explicitly scoped.
- Scanner findings are sensitive security incidents: record file/commit references and remediation status, not raw credential material. Rotate/revoke exposed credentials rather than merely deleting the visible line.
- A clean scan is not proof that no secrets exist; combine with least-privilege secret storage, secret rotation and review of CI logs/artifacts.

## OpenHarness and Harness (identity unresolved)

Two materially different candidates surfaced; do not conflate them:

### OpenHarness — autonomous-ai/openharness

Primary candidate:
- https://github.com/autonomous-ai/openharness
- Repository reports MIT licensing; pin and verify the exact commit and all bundled third-party licences before reuse.
- Describes a desktop command centre for running coding agents across multiple machines, with per-machine daemons, persistent agent sessions, remote coordination and end-to-end encrypted links. The repository includes app, CLI, daemon, relay and device components.

AEGIS decision:
- Highly relevant architecture reference for the user's long-term goal of coordinating multiple agent harnesses and machines while keeping work running independently of a chat session.
- Study its session lifecycle, daemon connectivity, encrypted transport, machine pairing, permissions and failure recovery. Do not assume its relay, desktop app or local agent processes can be transplanted into Cloudflare Workers.
- Its documented build/install path targets macOS or Linux and includes native desktop/toolchain requirements; it is not a direct Chromebook-only browser solution. Treat it as a possible optional operator/worker node, not AEGIS's core host.
- Before any integration, inspect security model, key management, relay trust boundaries, update mechanism, data retention, supported agent adapters and whether the daemon can run headlessly on a low-cost host.

### Harness.io platform — alternate interpretation

Primary candidate:
- https://www.harness.io/products/platform

The Harness platform describes a governed software-delivery layer spanning builds, deployments, testing, application security, runtime protection, cost management, policy-as-code, RBAC, approvals and audit. It also describes an agent harness and SDLC knowledge graph.

AEGIS decision:
- Study its governance model: policy enforcement at execution boundaries, worker agents with bounded permissions, evidence-backed audit, release verification and rollback.
- Do not adopt the full platform as an AEGIS dependency. It is a broad commercial DevOps platform aimed at organisational delivery environments, not a lightweight personal runtime.
- Reproduce the useful principles in AEGIS-native controls and keep CI provider-neutral.

The user has not supplied an exact Harness URL, so the intended project remains unconfirmed.

## BLA — Blind LLM Agents (provisional identity: qybaihe/bla)

Primary candidate:
- https://github.com/qybaihe/bla
- Repository reports MIT licensing; pin and re-check the exact release before use.
- CLI, MCP server and agent skill intended to make shipped binaries/bundles more expensive and misleading for automated AI reverse-engineering while preserving intended runtime behaviour.

AEGIS decision:
- Niche release-hardening candidate, not a general security scanner or agent safety boundary.
- Relevant only if AEGIS distributes client-side binaries, Electron apps, bundles, WASM or other supported artifacts that need protection from automated reverse engineering.
- Do not run its setup against global agent configuration. If evaluated, use an isolated disposable workspace and explicit output directory, inspect every transformation, verify functional equivalence in staging, and measure artifact-size/runtime impact.
- Avoid enabling LLM-directed decoys or deceptive directives without a specific, reviewed use case.
- Never treat obfuscation/decoys as a substitute for protecting server-side secrets, signing releases, secure design or access controls.

## SolidCraft

Primary candidate:
- https://docs.solidcraft.io/
- Documentation states MIT OR Apache-2.0 licensing.
- Described as a Rust parametric 3D CAD application available as desktop software, browser app, headless CLI and MCP server. The same command model is used by the UI, scripts, CLI and MCP.

AEGIS decision:
- Interesting future Media Studio / 3D asset-generation integration, especially because the command surface is scriptable and MCP-accessible.
- Not relevant to the current AEGIS runtime, orchestration or mobile Control Centre; do not add it to the core deployment.
- Before any adapter, verify repository maturity, supported modelling operations, WebGPU/WebGL browser requirements, MCP transport/security, export formats and dependency footprint.
- Keep generated CAD files in a sandboxed project workspace and require review before publishing or overwriting user assets.

## Dev.to

Use it to discover practitioner reports, tutorials, postmortems and emerging tools. Treat posts as leads, not authoritative specifications. Record author, canonical URL, publication/update date and linked primary sources. Verify claims against official documentation, source code, standards or reproducible tests. Do not bulk-copy articles into AEGIS; store concise attributed notes and links subject to site terms and copyright.

## Stack Overflow

Use it to find concrete error cases, compatibility issues, edge conditions and troubleshooting paths. Link answers to the exact product/runtime version they discuss.

Public contributions are licensed under Creative Commons Attribution-ShareAlike; the applicable licence depends on contribution date/revision (CC BY-SA 2.5, 3.0 or 4.0). Preserve attribution and applicable share-alike obligations when reusing content. Do not bulk mirror Q&A or assume accepted/upvoted answers are correct. Prefer original documentation and reproduce solutions in AEGIS tests.

Official licence information: https://stackoverflow.com/help/licensing

## Frontend Mentor

Use optional, repeatable UI challenge briefs to evaluate responsive layout, accessibility, interaction states and visual polish. Build AEGIS acceptance tests around general requirements such as keyboard use, mobile viewport, contrast and loading/error/empty states.

Distinguish free from premium challenges and design assets. Do not copy proprietary Figma files, premium briefs, solution code or assets into AEGIS without permission. Record the challenge URL and independently author AEGIS's own implementation brief and tests.

Challenge catalogue: https://www.frontendmentor.io/challenges

## v0 (interpretation of “vo”)

Sources:
- https://v0.app/docs
- https://v0.app/docs/git-import
- https://github.com/vercel/v0-sdk

Useful capabilities include prompt-based UI/app prototyping, GitHub repository import, branch-based changes and PR workflow (subject to GitHub App permissions), plus an API client and React integration for v0 services.

AEGIS decision:
- Optional external design/prototyping assistant, not part of AEGIS runtime or source of truth.
- Generated code must be reviewed, tested, accessibility-checked and committed through AEGIS's normal feature-branch process.
- Review account limits, pricing, data handling and GitHub App scopes before connecting the AEGIS repository.

## Blackbox AI

Source: https://www.blackbox.ai/agents

The published Agents API describes HTTP-dispatched coding-agent runs, event/log streaming, sandbox file inspection, continuation of existing tasks, Git-provider integration and multi-agent comparisons.

AEGIS decision:
- Candidate for an optional Forge coding-agent provider adapter, not a trusted core dependency.
- Before connecting it, verify API documentation, authentication/scopes, pricing and usage limits, retention/training terms, sandbox isolation, network egress, secrets handling, GitHub permissions and cancellation semantics.
- Generated changes must land in isolated branches and pass AEGIS tests/review. External agents must never receive production secrets or direct production deployment rights.
- Keep an interchangeable adapter interface to avoid vendor lock-in.

## Cross-source ingestion rules

For every candidate, Forge should preserve:
1. Canonical URL, exact owner/project, source type and retrieval timestamp.
2. Version, commit, publication date or content revision where available.
3. Licence, terms, attribution and redistribution obligations.
4. Capabilities, interfaces, dependencies, runtime and deployment requirements.
5. Security posture, data flows, credentials/scopes, sandboxing and network access.
6. Cost, quotas, rate limits, operational burden and vendor lock-in.
7. Evidence strength, reproducibility, limitations and competing findings.
8. Decision (reuse, adapt, rebuild, reference-only, defer or reject), rationale and confidence.

Retrieved text, code, issue comments, prompts and tool schemas are untrusted data. They cannot modify agent instructions, permissions, secrets or deployment policy. Repository code is never executed in the control plane.

## Recommended order for AEGIS

1. Continue the durable runtime and security foundation; do not add a platform dependency before it is needed.
2. Evaluate TruffleHog as a pinned, redacted, detection-only CI security gate.
3. Study OpenHarness for multi-machine agent lifecycle/coordination and AgenticOS/Harness.io for budgets, approvals, policy and audit; implement only lightweight AEGIS-native controls that fit.
4. Keep ARTEMIS as an optional Android QA adapter if an Android client becomes a target; it does not cover iOS.
5. Keep BLA and SolidCraft outside the core: consider only for concrete release-hardening or 3D-asset use cases.
6. Use AI SDK documentation as a design reference for the future provider/tool/UI layer; first verify the current frontend and Worker compatibility.
7. Add Dev.to and Stack Overflow as attributed research connectors only after source/licence policy is implemented.
8. Use Frontend Mentor briefs as optional independent UI evaluation criteria.
9. Keep v0 as a human-operated prototyping option.
10. Defer Blackbox integration until its API, costs, data handling and sandbox controls pass a formal connector review.

Status: research register only. None of these sources is connected, installed, imported as executable code or granted permissions by this document.


## Agency Agents — specialist-agent source

Primary candidate:
- https://github.com/msitarzewski/agency-agents
- Repository describes itself as a library of specialist AI-agent definitions and workflows. Its published repository licence is MIT; verify the exact commit and any individual bundled assets/licences before reuse.
- The repository contains role-oriented Markdown definitions, specialist categories and supporting workflows. These definitions are not, by themselves, a durable agent runtime, secure tool broker or permission system.

Useful AEGIS applications:
- Seed a curated catalogue of specialist roles such as software architect, frontend/backend developer, reviewer, security specialist, QA engineer, DevOps/SRE, researcher and UX designer.
- Compare role boundaries, expected inputs, deliverables, checklists and hand-off patterns.
- Use specialist agents behind one AEGIS orchestrator, shared run state, budgets, audit and approval policy.
- Require independent review for security-sensitive, production-impacting or high-consequence work.

AEGIS decision:
- **High-priority knowledge/agent-definition source; selective adaptation, not wholesale installation.**
- Convert chosen roles into AEGIS-native, versioned agent records with role, purpose, expertise, instruction set, allowed capability IDs, input/output schema, expected artefacts, evaluation tests, source commit, licence and review status.
- Keep prompts and role definitions separate from tool permissions. An agent definition never grants a tool or secret scope.
- Do not import the desktop installer or make AEGIS dependent on Claude Code, Cursor, Codex, Gemini CLI or any other specific agent host.
- Start with a small set of complementary roles and evaluate them against repeatable AEGIS tasks before expanding the catalogue.
- Preserve MIT attribution and upstream provenance; review all content for unsafe instructions, duplicated roles, prompt injection and platform-specific assumptions.
- No Agency Agents code or definitions have been installed, copied into the runtime or granted permissions by this research entry.

Source: https://github.com/msitarzewski/agency-agents



## Workflow, ingestion and always-on agent candidates — 15 November 2026

These candidates are architecture references or optional adapters. They are not installed, connected or granted permissions by this register.

### OpenDots — CopilotKit

Primary candidate: https://github.com/CopilotKit/OpenDots. MIT licence. An open-source web/mobile agent-workspace template using CopilotKit and AG-UI. It models persistent specialist "Dots", Spaces/pages, per-Dot research and memory permissions, MCP connections, human approval cards, activity receipts, browser/computer work and voice/Slack extensions.

The README says conversations require CopilotKit Intelligence (hosted service, local Docker evaluation, or licensed self-hosting). The local evaluation has substantial machine requirements and a CopilotKit account. The project describes itself as an early single-owner starting point; shared editing and some integrations/group-agent features remain further work. Its security notes say it is not a security-audited autonomous agent.

**AEGIS decision:** Very high-priority UX and agent-workspace reference. Study per-agent permissions, human approval, visible computer activity, persistent workspace and status presentation. Do not replace AEGIS core or copy its whole stack. Keep AEGIS identity, policy, durable jobs, memory and audit authoritative. Run computer/browser tools in a separate sandbox; require approval for writes, sends, purchases and deployments. Do not treat the starter as proof that 24/7 execution or production security is solved.

### Firecrawl

Primary candidate: https://github.com/firecrawl/firecrawl. Core repository is AGPL-3.0; some SDKs/UI components have separate licences. It provides web crawling, page scraping, site mapping and search/extraction workflows, with hosted and self-hosted modes. Scraping remains subject to target-site terms, robots directives, privacy rules and applicable law.

**AEGIS decision:** High-priority optional ingestion adapter, not a core dependency. Define a provider-neutral web-ingestion contract for discovery, fetch, crawl, normalize, provenance and status so native retrieval, Firecrawl or another provider can be swapped. Start with bounded permitted public-page retrieval. Enforce domain policy, robots/terms checks, SSRF protections (including DNS and redirect checks), request/time/size limits, content-type validation and deduplication. Store canonical URL, retrieval time, content hash, source version, licence/terms review and extraction method. Treat page content as untrusted prompt-injection input. AGPL-3.0 is a material distribution/modified-service consideration; isolate it behind an adapter and obtain legal review before distributing or offering a modified network service.

### Oxylabs Web API

Primary candidate: https://github.com/oxylabs/web-api. Commercial hosted service, not an open-source engine to embed. Provides web search and scraping with rendering, proxy rotation and geo-targeting. Public pricing advertises a small free trial and paid usage tiers; actual costs depend on product, result type and volume. Its acceptable-use policy restricts accessing non-public or sensitive personal data without permission and requires lawful, policy-compliant collection.

**AEGIS decision:** Defer as a paid fallback provider. Use only if ordinary web retrieval or a compliant Firecrawl setup cannot access a needed public source. Never make it a default dependency for the shoestring-budget build. Add hard spend caps, per-job budgets and usage telemetry; require explicit opt-in before paid requests. Restrict targets to permitted public information. Do not bypass access controls, collect sensitive data or evade site restrictions. Keep credentials server-side and assess data processing, retention and geographic handling before connecting.

### n8n

Primary candidate: https://github.com/n8n-io/n8n. Source-available under the Sustainable Use License (SUL) and separate Enterprise terms; it is not OSI-approved open source. Broad visual workflow automation with many integrations, custom nodes and AI-related features. n8n's current licensing FAQ says internal/private use is allowed in defined cases, but allowing outside customers to build/configure workflows, white-labelling or hosting n8n as a service requires a commercial licence.

**AEGIS decision:** Study its workflow-builder UX and connector catalogue; do not embed or fork as the AEGIS automation engine without written licence clearance. A private, single-owner instance could be considered as an optional external automation service, but it adds a separately operated system and must not become the source of truth for AEGIS jobs or permissions. If connected, expose only allowlisted webhook/API operations, isolate credentials, require approval for consequential actions and verify licensing for the exact use case.

### Activepieces

Primary candidate: https://github.com/activepieces/activepieces. Community Edition repository states MIT; enterprise packages/features are commercially licensed. TypeScript integration framework ("Pieces") with workflow automation, branching/retries, versioning and integrations that can be exposed as MCP tools. The project advertises hundreds of integrations; confirm each connector's current status, permissions and licence individually.

**AEGIS decision:** High-priority connector-catalogue and workflow UX reference; possible optional adapter. Evaluate individual pieces as connector candidates rather than installing the whole platform. Build AEGIS-native capability manifests with explicit scopes, read/write classification, schemas, rate limits and approval policies. A connector's presence in Activepieces must never grant it permission in AEGIS. Keep enterprise-only features separate and review connector-specific third-party licences and data handling.

### Temporal

Primary candidate: https://github.com/temporalio/temporal. Temporal server repository reports MIT licence. Mature durable-execution platform: workflow state survives process failures, with retryable activities and replayable workflow orchestration. It is a server platform with workers and persistence, not a small library or a Cloudflare Worker drop-in.

**AEGIS decision:** Top-tier durability architecture reference and long-term candidate. Study workflow history, deterministic orchestration, activity retry, cancellation, signals, timers, versioning and recovery semantics. Do not add a Temporal cluster to the current low-cost Cloudflare setup: it introduces a separately operated server, persistence and worker fleet. Continue the minimal AEGIS D1/Queue runtime for the first health-check slice. Reassess Temporal only when multi-step jobs justify the operational footprint.

### Hatchet

Primary candidate: https://github.com/hatchet-dev/hatchet. Repository reports MIT licence. Orchestrates background tasks, AI agents and durable workflows across TypeScript, Python, Go and Ruby; includes retries, schedules, event/webhook triggers, concurrency controls, task routing and observability. Self-hosted operation requires a separate service and infrastructure (including Docker for the documented local path).

**AEGIS decision:** High-priority comparison candidate for the next runtime stage. Compare worker model, durable sleep/event waits, retries, concurrency and operational footprint against the existing AEGIS Worker/D1/Queue implementation and Temporal. Do not run Hatchet and a full AEGIS scheduler/queue in parallel for the same jobs. If adopted, one engine owns execution state; AEGIS remains the identity, policy, approval and user-facing control plane. Run a small proof of concept only after defining resource limits, backup/restore, security boundaries and migration/exit strategy.

### Trigger.dev

Primary candidate: https://github.com/triggerdotdev/trigger.dev. Repository reports Apache-2.0. TypeScript-first durable background jobs and AI workflows with retries, queues, idempotency, long-running execution, schedules, observability and progress streaming. Supports managed cloud and self-hosted Docker/Kubernetes deployments. Self-hosting the full stack is operationally heavier than deploying one Cloudflare Worker; review the exact current compose/Helm footprint before estimating costs.

**AEGIS decision:** High-priority developer-experience and TypeScript workflow reference; optional future runtime alternative. Study checkpointing, retries, idempotency, run traces, progress streaming and human-wait patterns. Its TypeScript orientation may fit AEGIS better than Python-first systems, but do not assume its runtime fits Cloudflare Workers or a free Chromebook-only setup. Compare with Hatchet and Temporal using the same representative AEGIS jobs before selecting any engine.

### Inngest — provisional interpretation of user's "ingest"

Primary candidate: https://github.com/inngest/inngest. The server/CLI licensing is described by its repository as Server Side Public License with delayed open-source publication under Apache-2.0; SDKs are Apache-2.0. Verify exact component and release terms. Durable event-driven functions combine triggers, cron schedules, retries, step state and coordination. Supports self-hosted server and hosted platform.

**AEGIS decision:** Study event-driven function and developer-experience patterns; defer server adoption. Do not describe the whole server as OSI-open-source or copy server code without checking SSPL/DOSP terms. Evaluate SDK/API integration separately from server licensing. Compare it with Trigger.dev, Hatchet and the native AEGIS runtime before adding another scheduler/queue. The user's spelling "ingest" has been interpreted as Inngest; confirm if a different product was intended.

### Kestra

Primary candidate: https://github.com/kestra-io/kestra. Apache-2.0. Declarative YAML, event-driven orchestration for data, infrastructure, business processes and AI agents; has MCP support and Python/JavaScript SDKs. Official requirements describe a Java runtime, PostgreSQL or MySQL for OSS queue/repository, and at least 4 GiB RAM plus 2 vCPUs for a standalone server. Script tasks may require Docker-in-Docker.

**AEGIS decision:** Architecture reference for declarative workflows, event triggers, versioning and data pipelines; not a current deployment candidate. Infrastructure footprint is disproportionate to the current free-tier Cloudflare-first build. Revisit only if AEGIS develops substantial multi-source ETL or scheduled data operations that cannot be handled by small isolated jobs.

### Windmill

Primary candidate: https://github.com/windmill-labs/windmill. Core Community Edition is AGPLv3; APIs/OpenAPI clients and some components have separate licences. Commercial licensing applies to certain embedding, managed-service and redistribution scenarios. Code-first scripts, workflows, apps and AI agents; supports many languages, Git sync, worker isolation and environment promotion.

**AEGIS decision:** Study worker isolation, code-first workflow composition and review/promotion patterns; do not embed the platform. AGPL and commercial-use boundaries need careful review before any distribution or user-facing integration. Its PostgreSQL/worker deployment footprint is heavier than the initial AEGIS runtime. Do not create a second workflow control plane just to gain a visual editor.

### Apache Airflow

Primary candidate: https://github.com/apache/airflow. Apache-2.0. Programmatic DAG authoring, scheduling and monitoring for data pipelines. Its own README says it is best for workflows whose DAG structure is mostly static and slowly changing.

**AEGIS decision:** Reference-only for future bulk data engineering/ETL, not interactive agent jobs. Airflow is designed around a scheduler, metadata database, executor and workers; it is operationally excessive for the current small event-driven runtime. Do not use it for user-facing, approval-driven agent conversations or low-latency tasks. If AEGIS later needs large scheduled data pipelines, compare it with Kestra and managed data services.

### OpenOutreach

Primary candidate: https://github.com/eracle/OpenOutreach. Repository reports GPL-3.0. Self-hosted B2B lead discovery/qualification and email outreach agent. It uses a licensed data provider and can send email through a connected mailbox; some operations consume paid credits.

**AEGIS decision:** Not a core AEGIS capability. This is a specialised sales/outbound lead-generation workflow. Study only its modular CLI producer/consumer contract, transparent qualification rationale and spend gates if AEGIS later gains a user-requested outreach module. Never enable mailbox sending, purchase lead credits or contact third parties by default. Require explicit per-campaign approval, recipient/source provenance, opt-out/suppression checks and applicable UK GDPR/PECR compliance review. GPL-3.0 and data-provider terms require review before reuse. No outbound messaging capability is authorised by this entry.

## Workflow-engine selection guidance

These products overlap, but are not interchangeable:

| Candidate | Best-fit problem | AEGIS position |
|---|---|---|
| Existing AEGIS Worker + D1 + Queue | Small, bounded jobs on Cloudflare | Keep as first runtime slice |
| Temporal | Mature durable, multi-step execution | Benchmark/reference; future option |
| Hatchet | Agent/background tasks, retries and concurrency | Closest runtime comparison |
| Trigger.dev | TypeScript developer experience and long-running AI jobs | Strong alternative to benchmark |
| Inngest | Event-driven durable functions | SDK/pattern study; server licence review |
| Kestra | Declarative business/data workflows | Later data-orchestration option |
| Airflow | Scheduled DAG/data engineering pipelines | Not agent runtime |
| Activepieces / n8n / Windmill | Visual or code-first integrations and automation | Optional external automation layer; licensing matters |

**Architecture rule:** AEGIS must retain one canonical job identity, state machine, policy engine, approval record and audit trail. An external workflow engine may execute work behind an adapter, but must not create a second conflicting source of truth. Do not deploy multiple overlapping engines before a benchmark proves the need.

## Source-intake clarifications

- "Ingest" was interpreted as Inngest.
- "Open Outreach" was interpreted as eracle/OpenOutreach.
- "OpenDots" was interpreted as CopilotKit/OpenDots.
- No code, package, connector, account or service from this list has been installed or authorised.


## Mercury Agent — persistent local-first agent runtime

**Source:** [cosmicstack-labs/mercury-agent](https://github.com/cosmicstack-labs/mercury-agent)  
**Licence:** MIT (repository package metadata, checked 15 November 2026).  
**Package inspected:** `@cosmicstack/mercury-agent` 1.5.2; Node.js >=22.  
**Scope reviewed:** README, package metadata, architecture, security policy, permissions implementation, bots architecture and published roadmap.

**What it provides**
- One persistent local daemon with CLI/TUI, local web dashboard and messaging-channel adapters.
- Provider abstraction and Vercel AI SDK-based multi-step tool loop.
- Local SQLite second-brain memory, sessions, scheduler and token budgets.
- Permission manager with folder scopes, shell-command policy, approvals and per-turn contexts.
- Persistent specialist bots with persona, model/provider, scoped memory, tool allow/deny lists, routines and daily/fleet budgets.
- Git/GitHub, filesystem, shell, web fetch and MCP integrations.
- Mercury Code with plan/checklist, background sub-agents and test/build verification intent.

**AEGIS decision: high-value architecture and UX reference; do not adopt the runtime wholesale.**
Study and selectively adapt:
1. Permission-context propagation and explicit grants for delegated agents.
2. Per-agent memory namespaces and explicit sharing.
3. Durable local job queues, leases, idempotency and failure-type-aware retries.
4. Per-agent and fleet-wide token/time/concurrency budgets.
5. Agent roster, activity, approval and run-history UX.
6. Provider/channel adapters and small tool contracts.

**Important limitations and risk findings**
- Mercury is a Node.js local runtime, not a Cloudflare Worker or browser-native service. The current package requires Node.js 22 or newer; a full source build also brings a substantial desktop/web/CLI dependency tree. It is not a native iOS/iPadOS or ChromeOS application. Android is documented through Termux; remote Linux hosting is possible but introduces an always-on host and operating cost.
- Its own website explicitly says there is **no OS-level sandbox**: safety relies on approvals, blocklists and folder scopes. Do not treat permission prompts as a sandbox boundary.
- The inspected security policy explains the permission model and lists scope limitations. The repository roadmap also records previously observed defects around evidence-gated completion, delegated-worker permission context, terminal/UI behaviour, SQLite packaging and Termux support. These are reasons to audit the exact current code and regression coverage before relying on any implementation, not proof that every issue remains present in release 1.5.2.
- The README describes community skills as unaudited; skills must be inspected before installation.
- The package and source include many dependencies and platform-specific paths. Importing the whole runtime would duplicate AEGIS orchestration, memory, permissions, provider routing and scheduler rather than strengthen the existing architecture.
- Mercury's local-first memory and 24/7 daemon are useful design references, but a local daemon is not a free cloud service and does not automatically solve AEGIS's durable server-side background execution.

**Recommended AEGIS treatment**
- Keep AEGIS as the canonical control plane, policy engine, memory owner and durable job ledger.
- Translate useful patterns into AEGIS-native capability manifests and tests; never copy permissions based solely on prompts or config claims.
- If a Mercury adapter is ever tested, isolate it as an optional external runtime, pin a release/commit, use a disposable workspace and synthetic data, restrict network egress, require Ask-Me/approval mode, set strict token/time budgets, and do not provide production credentials.
- Benchmark it against AEGIS's own Worker/D1/Queue runtime and specialist-agent model before considering any deployment.

No Mercury package, daemon, account, provider key, skill, bot or service has been installed or connected.


## Addy Osmani — Agent Skills

**Source:** [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills)  
**Licence:** MIT; repository `LICENSE` checked on 15 November 2026.  
**Reviewed:** README, `AGENTS.md`, skill anatomy, selected skill definitions, repository structure and installation guidance on the default `main` branch.

**What it provides**
- 25 portable Markdown skills: 24 lifecycle skills plus a meta-skill that routes work to the right workflow.
- A six-stage engineering lifecycle: define, plan, build, verify, review and ship; nine command wrappers for supported hosts.
- Four specialist review personas: code reviewer, test engineer, security auditor and web-performance auditor.
- Seven shared checklists covering definition of done, testing, security, performance, accessibility, observability and orchestration.
- Contributor validation scripts, routing evaluation cases and host-specific adapters for Claude Code, Codex, Gemini CLI, Antigravity, Copilot and other tools.
- Skills are designed as actionable workflows with explicit triggers, verification evidence, exit criteria and anti-rationalisation guidance, not just general prompt advice.

**Particularly valuable skills for AEGIS**
1. `constraint-driven-development`: persistent project quality contracts and checks that detect weakened standards, skipped tests, suppressions and reduced thresholds.
2. `context-engineering`: deliberate context packing, rules, MCP and task handoff.
3. `source-driven-development`: decisions grounded in current authoritative documentation with source evidence and explicit unknowns.
4. `doubt-driven-development`: adversarial second-pass review for high-stakes or unfamiliar changes.
5. `planning-and-task-breakdown` and `incremental-implementation`: dependency-aware, thin vertical slices with verification after each slice.
6. `debugging-and-error-recovery`: stop-the-line, preserve evidence, find root cause, add regression guard.
7. `security-and-hardening`, `api-and-interface-design`, `frontend-ui-engineering`, `browser-testing-with-devtools` and `performance-optimization`: directly relevant to AEGIS's capability boundaries and Chromebook/iPhone/iPad PWA.
8. `documentation-and-adrs`, `observability-and-instrumentation`, `ci-cd-and-automation` and `shipping-and-launch`: operational discipline for durable runtime and safe releases.

**Overlap and fit**
- AEGIS already has ten AEGIS-native adaptations of MIT-licensed Superpowers skills and its own TDD/blueprint workflow. Addy's TDD, spec, review and debugging skills overlap in purpose with existing AEGIS controls; do not install duplicate copies or create competing instructions.
- Addy contributes useful complementary coverage, especially constraint-driven standards, context engineering, source-driven and doubt-driven review, browser-specific verification, observability and release readiness.
- The four personas are reviewer perspectives, not autonomous agents or a scheduler. Adapt their role contracts into AEGIS specialist definitions that receive only explicitly granted capabilities.
- The nine slash commands and host-specific wrappers are not the AEGIS runtime. Keep AEGIS's canonical orchestrator, capability policy, approvals, memory and durable job state.

**Licence and portability notes**
- MIT permits selective adaptation subject to retaining the copyright and licence notice in copies or substantial portions.
- The README describes the skills as usable across 70+ agent hosts through the open skills CLI, with native host-specific integration instructions.
- A documented portability caveat: per-skill CLI installation copies only `skills/<name>/`, not the repository-level `references/` directory; skills that link to shared checklists may therefore lose those supporting files. Prefer a complete pinned source snapshot or explicitly package each required reference with an adapted skill.
- Treat every upstream update as a new reviewed version. Pin commit and record skill path, licence, retrieval date and AEGIS adaptation commit; do not silently sync changing upstream instructions into the live agent prompt.
- Do not copy upstream repository-level `AGENTS.md` into AEGIS: the upstream file explicitly scopes itself to contributors working on that repository. Adapt reusable `skills/` content only.

**AEGIS decision: very high-priority skill and workflow source; selectively adapt, do not wholesale install.**
- Create an AEGIS skill catalogue with upstream provenance, version pin, skill triggers, input/output contract, required evidence, risk tier, required capabilities and tests.
- Map each candidate to existing AEGIS-native skills before adoption; prefer improving the existing skill where it already covers the behaviour.
- Prioritise the complementary skills listed above and the four specialist reviewer perspectives.
- Convert checklists into AEGIS quality gates only where measurable and appropriate; don't blindly impose generic numeric thresholds on every project.
- Preserve human approval for production deployment, external side effects, permissions and other high-impact actions. An upstream `/build auto` workflow is not authority for AEGIS to bypass its approval policy.

No Addy plugin, CLI, package, agent persona, script or upstream skill has been installed or connected to AEGIS.


## CoreDeck — Android SDK and device-tooling candidate

Primary candidate:
- https://github.com/devmuaz/CoreDeck
- Official project site: https://coredeck.dev/
- Repository and project site identify the project as MIT-licensed; preserve the copyright and licence notice if code is ever reused.
- Latest stable release observed on 15 November 2026: v0.16.0 (8 November 2026). Release details and platform support must be rechecked before any future adoption.
- Native C++20 / Dear ImGui desktop command centre for Google's official Android SDK tools. It manages Android Virtual Devices and system images, launches emulators, exposes ADB/device workflows, checks SDK/JDK health, inspects and signs APKs, and manages keystores.
- Published native targets: Windows 10/11 x86-64, macOS 12+ (Apple Silicon and Intel), Linux x86-64 and arm64. Requires JDK 17+ and Android SDK tooling; it is not a Chromebook-browser or iOS application.

Useful AEGIS applications:
- Optional operator-side Android emulator/device management if AEGIS later ships an Android client.
- Potential human-operated QA workstation for ADB, emulator logs, APK inspection and signing.
- Reference for a compact, task-focused native tooling interface.

AEGIS decision:
- **Reference / optional external QA utility only; do not add it to the AEGIS core or runtime.**
- It is not an AI agent, orchestration engine, remote browser, CI runner or 24/7 background host. It does not replace Android Studio/Gradle as an app IDE/build system.
- It does not solve the current Chromebook-first development workflow: its published native targets do not include ChromeOS, and it does not provide an iOS/iPadOS test path.
- If an Android QA adapter is later justified, define a narrow AEGIS capability contract around an isolated ADB/emulator host. Treat device actions as privileged, scope to disposable test devices/accounts, capture logs/screenshots as evidence, and require approval for actions that could affect real accounts or data.
- Do not expose ADB, signing keys or emulator control directly to arbitrary agents. Keep keystore passwords and private keys out of manifests, logs and memory; use encrypted secret references and explicit signing approvals.
- Before adoption, verify release checksums/signatures, pinned source commit, third-party dependency licences, update mechanism, telemetry/crash-reporting behaviour and the security boundary around host process execution.

Sources:
- https://github.com/devmuaz/CoreDeck
- https://github.com/devmuaz/CoreDeck/blob/main/README.md
- https://github.com/devmuaz/CoreDeck/blob/main/LICENSE
- https://coredeck.dev/
- https://devmuaz.com/projects/coredeck

No CoreDeck binary, SDK, emulator, package, agent, account or service has been installed or connected to AEGIS.

## Vercel agent-browser — browser automation adapter

Primary candidate: https://github.com/vercel-labs/agent-browser
- Apache-2.0; native Rust CLI with Node/npm distribution.
- Browser automation for agents: opens pages, returns compact accessibility-tree snapshots with element references, and performs actions step by step. Supports persistent browser sessions, screenshots, skills and an MCP server over stdio.
- Requires a host with compatible Chrome; it is not a Cloudflare Worker/browser-only runtime dependency.

AEGIS decision:
- High-priority optional browser-worker adapter, not a core dependency.
- Use a separate disposable browser worker with no production secrets or host filesystem access. Enforce domain allowlists, action policies, explicit confirmation for sensitive actions, isolated profiles and short-lived sessions.
- Treat page content as untrusted prompt-injection. Keep navigation policy and tool permissions outside page/agent context; verify state-changing actions and capture evidence.
- Repository documentation describes domain allowlists and action policies, but GitHub currently reports no SECURITY.md and no published advisories. That is not proof of security; review source before use.
- Do not expose shell/browser control directly to arbitrary agents. Route requests through AEGIS capabilities and approvals.
- Chromebook constraint: test on ChromeOS Linux or a remote isolated worker; iPhone/iPad Safari is not a local execution target.

Sources:
- https://github.com/vercel-labs/agent-browser
- https://www.npmjs.com/package/agent-browser
- https://github.com/vercel-labs/agent-browser/security
- https://github.com/vercel-labs/agent-browser/blob/main/docs/public/schema.json

No package, browser profile, MCP server or service has been installed or connected.

## Code Review Graph — repository intelligence

Primary candidate: https://github.com/tirth8205/code-review-graph
PyPI: https://pypi.org/project/code-review-graph/
- MIT-licensed local-first Python code-intelligence graph using Tree-sitter and SQLite; exposes CLI and MCP tools.
- Extracts code structure, incrementally updates changed files, maps change impact and affected tests, supports risk-scored PR reviews, graph traversal, architecture communities, multi-repository search and context/token measurements.
- Current PyPI listing observed 15 November 2026: v2.4.0. Verify release and Python/dependency support before pinning.

AEGIS decision:
- Very high-priority optional engineering/Forge adapter. It directly addresses repository understanding, change impact and review context.
- Evaluate on AEGIS using representative PRs; reproduce context savings and review accuracy against the existing workflow.
- Its installer can modify MCP configuration, hooks, skills and agent instruction files. Use install dry-run, inspect every proposed change and configure only the intended tool. Never let a broad installer rewrite canonical AEGIS instructions.
- Treat graph data as derived and potentially sensitive repository metadata. Keep SQLite private; do not upload source/embeddings without review. Start read-only; do not enable automated refactors until separately approved and tested.
- It is not AEGIS durable runtime, canonical memory or source of truth. Verify graph freshness against Git.

Sources:
- https://github.com/tirth8205/code-review-graph
- https://pypi.org/project/code-review-graph/
- https://github.com/tirth8205/code-review-graph/releases

No package, MCP server, GitHub Action or graph database has been installed or connected.

## FlashML FreeToken — local model serving (identity interpreted)

Likely intended project:
- https://github.com/FlashML-org/FreeToken
- https://www.flashml.ai/
- Apache-2.0.
- FreeToken is not a website that hands out free API tokens or hosted inference quota. It is a local inference/serving engine for open-weight models, especially large Mixture-of-Experts models, exposing OpenAI- and Anthropic-compatible local APIs.
- Official CLI install guide currently lists Linux x86_64, NVIDIA GPU and driver r580+ / CUDA 13. Desktop downloads are listed for Windows and Linux. Real usable model size/performance depends on GPU VRAM, system RAM, bandwidth and quantization.

AEGIS decision:
- Future optional local-inference provider adapter; defer. It can reduce per-token API spend on a capable workstation, but it does not create free cloud compute and does not run on the user's iPad/iPhone or ordinary Chromebook hardware.
- Provider router should support an OpenAI-compatible custom base URL, health/model discovery, capability metadata, timeouts and context limits. Never assume local models match hosted tool-use, reasoning, vision or reliability.
- If evaluated, run on a dedicated GPU host, bind to loopback/private network, require authentication before remote exposure, restrict egress, isolate model files and set resource/thermal limits. Never expose a no-auth inference endpoint publicly.
- Benchmark cost per useful task, latency, memory footprint, coding correctness and tool-call reliability against hosted alternatives.

Sources:
- https://github.com/FlashML-org/FreeToken
- https://github.com/FlashML-org/FreeToken/blob/main/docs/install.md
- https://github.com/FlashML-org/FreeToken/blob/main/docs/quickstart.md
- https://www.flashml.ai/

Identity note: user wrote “flashml.org / free token”. Search surfaced FreeToken at flashml.ai and its GitHub organisation. If a different flashml.org service or free API-token offer was intended, its exact URL is needed. Do not paste a purported token into AEGIS until issuer, scope, expiry, data handling and billing are verified.

## 9Router — multi-provider model router (security hold)

Primary candidate:
- https://github.com/Raisolah/9router
- Related upstream/release references: https://github.com/decolua/9router and https://github.com/decolua/9router/releases
- README describes an OpenAI-compatible local endpoint, provider/model aggregation, OAuth/account routing, quota tracking, token-output compression, format translation and fallback across subscription, paid and free providers.
- Related decolua release feed showed v0.5.35 on 16 July 2026; do not assume Raisolah's repository is byte-identical or that a deployed build contains the same fixes.

Security findings:
- GHSA-vjc7-jrh9-9j86 reports critical unauthenticated provider CRUD and plaintext API-key/conversation-history exposure in versions <=0.4.41; the advisory listed no patched version at publication.
- GHSA-86m2-fcxq-5q7c reports a high-severity Host-header trust flaw enabling unauthenticated /v1 proxy use and SSRF in versions <0.5.2; the advisory identifies 0.5.2 as patched.
- Later release notes mention security/provider fixes, but do not independently prove the first advisory's endpoints are fixed in every fork/deployment. Audit exact source commit and reproduce fixes.

AEGIS decision:
- Do not integrate or give it credentials yet. Security hold.
- Potential future provider-router comparison only. AEGIS keeps its own provider adapter, routing policy, budgets and audit as canonical.
- Before disposable evaluation: pin exact repo/commit/release; diff advisory fixes; verify auth on every dashboard/API endpoint; verify loopback binding and peer-IP checks; validate SSRF/private-network protections and provider URLs; inspect OAuth token storage, request logging, cloud sync, telemetry and outbound calls; run dependency and secret scans.
- Never connect production API keys, ChatGPT credentials, GitHub OAuth or personal accounts. Use synthetic test credentials only after security review.
- “Free” provider labels do not guarantee permanent free access, unlimited quota or terms-compliant use. Verify each provider's official terms and rate limits.

Sources:
- https://github.com/Raisolah/9router
- https://github.com/decolua/9router/releases
- https://github.com/advisories/GHSA-vjc7-jrh9-9j86
- https://github.com/advisories/GHSA-86m2-fcxq-5q7c

No 9Router package, account, OAuth provider or credential has been connected.

## OpenCut — future Media Studio editing engine

Primary candidate: https://github.com/OpenCut-app/OpenCut
- MIT-licensed open-source video editor. Current repository README says it is being rewritten around a Rust core and shared web/desktop/mobile architecture, with a planned Editor API, plugin system, MCP server, headless automation and scripting.
- Former OpenCut-app/opencut-classic repository is archived and read-only; do not adopt it for new work.
- A separate similarly named https://github.com/opencutvideo/Opencut repository also surfaced. Do not conflate the projects; pin exact owner/repository before implementation.

AEGIS decision:
- High-value future Media Studio reference; defer implementation. Potentially useful for promo videos, lyric videos, clips and social assets.
- Planned MCP/headless/editor APIs are roadmap items, not proven automation interfaces. Do not design a production dependency around unshipped features.
- First evaluate the live browser editor manually on Chromebook/iPad, then inspect export formats, audio handling, timeline precision, browser memory/performance, accessibility, codec licensing and local-file privacy.
- Keep AEGIS media project metadata and source assets canonical. Automated editing should use an isolated project copy and require approval before overwriting/publishing.
- Do not make OpenCut an AEGIS core dependency or assume MCP automation exists today.

Sources:
- https://github.com/OpenCut-app/OpenCut
- https://github.com/OpenCut-app/opencut-classic
- https://github.com/opencutvideo/Opencut

No OpenCut package, editor project, plugin or service has been installed or connected.

## Xiryn — local-first personal multi-agent runtime

Primary candidate: https://github.com/SouravBeraAkaSpeed/xiryn
Product site: https://xiryn.com/
- MIT-licensed; package currently reports v0.7.0 and Node.js >=20.9.
- TypeScript/Next.js application using AI SDK 7, SQLite/Drizzle, Docker workstations, Chromium/noVNC and provider adapters. Each specialist agent receives its own Linux desktop container; agents can delegate within squads.
- README/site documents persistent turns that survive browser closure, long-term memory, scheduled routines, usage/budget tracking, Firecrawl research, local Ollama/LM Studio models, Telegram remote control and human hand-off for logins/payments.
- Supports hosted providers and OpenAI-compatible endpoints. Local inference still consumes the host's CPU/RAM/GPU.

AEGIS decision:
- Very high-value architecture reference and optional external worker/runtime candidate. It is one of the closest projects to AEGIS's personal-agent, persistent-specialist, computer-use and background-work goals.
- Do not replace AEGIS core or merge its runtime wholesale. Xiryn is a separate self-hosted product with its own database, agent model, UI and lifecycle. AEGIS remains canonical for identity, memory policy, capability registry, approvals, job state, audit and cross-platform Control Centre.
- Extract/adapt ideas: isolated per-agent workstations; disposable worker lifecycle; agent role/model/budget profiles; durable turns; scheduled routines; visible run costs; specialist squads; phone-based approvals and takeover; local-model/provider adapters.
- Possible future adapter: AEGIS issues a narrowly scoped, expiring job envelope; a separate Xiryn worker performs only the permitted task in an isolated workstation; a validated result and evidence return to AEGIS. Do not grant Xiryn broad AEGIS credentials or let it become a second source of truth.
- Chromebook/iPhone/iPad-first constraint matters: Xiryn requires a computer capable of Node.js and Docker to host its server and agent desktops. It is not hosted infrastructure and cannot run persistently on iPhone/iPad. ChromeOS Linux/Docker compatibility and resource requirements must be tested on the actual Chromebook; the documented Mac/Linux/Windows installer does not establish ChromeOS support.
- Its local-first claim is qualified: configured model-provider calls, optional Firecrawl, Telegram and temporary Cloudflare quick tunnels for phone takeover leave the machine. Review each external data flow and provider retention terms.
- **Critical security trade-off from actual repository:** Docker Compose mounts /var/run/docker.sock and runs the main service as root to create sibling workstations. Docker socket access is effectively host-root-equivalent. Agent containers have separate isolation controls, but the orchestrator is a privileged host service. Do not casually install on a personal Chromebook or expose it to a network.
- Upstream AGENTS.md says agents must never act on host files, no host paths should be mounted into agent containers, secrets must remain server-side and the app should remain loopback-only. SECURITY.md documents browser-key protection, per-container isolation, Telegram pairing, vault boundaries and prompt-injection limitations. These are useful controls, not proof of escape-proof isolation.
- Before any sandbox trial: pin exact commit/release; inspect Dockerfile, workstation creation, socket use, network rules, container capabilities, mounts, image provenance, browser bridge, update process, vault crypto and Telegram/tunnel handling; run dependency/secret scanning; use a disposable non-production machine, synthetic credentials, restricted egress and no personal files. Test reset, cancellation, crash recovery and agent-to-agent isolation.
- README documents npm run check (typecheck, lint, format) and npm run build; model-call tests can incur provider charges. Prefer mocks and local models during evaluation.

Sources inspected:
- https://github.com/SouravBeraAkaSpeed/xiryn
- https://github.com/SouravBeraAkaSpeed/xiryn/blob/main/AGENTS.md
- https://github.com/SouravBeraAkaSpeed/xiryn/blob/main/SECURITY.md
- https://github.com/SouravBeraAkaSpeed/xiryn/blob/main/docker-compose.yml
- https://github.com/SouravBeraAkaSpeed/xiryn/blob/main/package.json
- https://xiryn.com/

No Xiryn code, Docker image, container, package, API key, Telegram bot or service has been installed or connected.


## DevToys — developer utility toolkit

Primary project: https://github.com/DevToys-app/DevToys  
Website: https://devtoys.app/  
Related default-tools repository: https://github.com/DevToys-app/DevToys.Tools  
- MIT-licensed core application. DevToys 2.0 provides a cross-platform desktop toolbox with roughly 30 built-in utilities: JSON/YAML and date/number conversion; URL, HTML, Base64, GZip and JWT encoding/decoding; JSON/SQL/XML formatting; hashes/checksums; regex and JSONPath testing; Markdown/text utilities; QR tools and image compression. An extension ecosystem allows additional tools.
- A separate CLI is available for terminal/CI use. It is not safe to assume every GUI extension exposes a CLI operation; each tool needs to implement/support the CLI scenario. Linux packages and CLI installation are documented upstream.
- Desktop platforms are Windows, macOS and Linux. This is not a browser-native/PWA service and there is no official iOS/iPadOS app. ChromeOS Linux-container compatibility is plausible for the Linux CLI/package path but is not an officially verified Chromebook support claim.
- Useful design patterns: small single-purpose utilities; local processing instead of sending snippets to random web converters; discoverable tool catalogue; clipboard smart detection; extension contracts; compact layouts; and reusable utilities in CI.
- Security finding: upstream advisory GHSA-ggxr-h6fm-p2qh identifies a high-severity extension-installation path-traversal (“Zip Slip”) issue affecting v2.0.0.0 through v2.0.8.0, with v2.0.9.0 listed as patched. The inspected release page labels v2.0.9.0 a pre-release at the time of research. Treat extension installation as a code-loading trust boundary; pin and verify a patched release before any trial, avoid untrusted extensions, and inspect extension archive/path validation. Do not treat the patch version listing alone as proof that a stable package is available on every platform.
- AEGIS decision: useful reference and optional local developer-tool companion, but not an AEGIS runtime, agent, MCP server or core dependency. Prefer implementing the small, high-value converters/formatters/encoders as browser-native AEGIS utilities (offline-capable where practical) behind tested pure-function modules. This better fits Chromebook/iPhone/iPad and avoids asking the user to install a separate desktop app. Consider a DevToys CLI adapter only for a future Linux-capable worker, with explicit tool allowlists and no arbitrary command execution.
- Before any integration: verify exact stable release and platform package signatures; review core and per-extension licences independently; review extension update/install and archive extraction; check privacy/telemetry and clipboard behavior; pin versions and test offline; never feed secrets into third-party extensions or log clipboard contents.
- No DevToys app, CLI, extension, package or service has been installed or connected to AEGIS.

Sources inspected:
- https://github.com/DevToys-app/DevToys
- https://github.com/DevToys-app/DevToys.Tools
- https://github.com/DevToys-app/DevToys/blob/main/CONTRIBUTING.md
- https://github.com/DevToys-app/DevToys/security/advisories/GHSA-ggxr-h6fm-p2qh
- https://github.com/DevToys-app/DevToys/releases
- https://github.com/DevToys-app/Publish


## mcptoon — cross-agent MCP and skill management gateway

Primary repository: https://github.com/activeing123/mcptoon  
PyPI: https://pypi.org/project/mcptoon/  
- Current main-branch package metadata inspected 15 Nov 2026: v0.8.40, Python >=3.10, Apache-2.0, zero declared runtime dependencies (Python standard library). README and developer guide advertise 3,186 passing tests and two skipped; this is an upstream-reported count, not independently reproduced by AEGIS.
- A CLI-first MCP client/management layer: discovers configured MCP servers; keeps a canonical local config; syncs server and skill configuration into multiple supported agent hosts; offers compact tool manifests, on-demand schema inspection, search/selection/call, health checks, caching, a unified stdio/HTTP MCP gateway, and local skills/docs routing.
- Token reduction claims (for example 71,929 → 581 tokens / 99.2%) are upstream benchmarks on stated tool catalogues and tokenization. Treat as a hypothesis to benchmark against AEGIS's actual registry and model tokenizer, not a universal guaranteed saving. Names-only manifests reduce discovery context but require an inspect/call round trip and robust schema retrieval.
- The product has evolved rapidly: README, PyPI metadata and developer docs can describe different releases/features. Pin a specific tag/commit and compare package contents with the source before any trial. Do not infer all GUI-agent integrations work identically; each host has different config and runtime support.
- AEGIS fit: very high-priority architecture reference for MCP catalogue management, compact manifests, lazy schema retrieval, unified gateway, server health checks, skill/document retrieval, per-agent configuration adapters and measured context budgets. These patterns map directly to the AEGIS Capability System and Forge.
- Adopt patterns, not wholesale control. AEGIS remains canonical for identity, connections, capability manifests, action scopes, risk classification, approval records, budgets, job state and audit. A third-party gateway must never bypass AEGIS policy or become a parallel permissions/source-of-truth layer. Use AEGIS-owned capability IDs and stable operation IDs; resolve schemas only after policy allows discovery.
- Platform limitation: mcptoon is a local Python CLI and MCP gateway, not a Cloudflare Worker, hosted multi-tenant control plane, native iOS app or browser PWA. It may be usable on a Linux-capable host/worker; Chromebook Linux/shell availability must be tested on the actual device. It cannot run persistently on iPhone/iPad as a local daemon. The CLI can be called by shell-capable agents, but this does not imply ChatGPT Free's native mobile app can execute arbitrary local commands.
- **Important safety boundary:** the upstream exec_sandbox.py explicitly states it is a context/output sandbox, not a security sandbox: child code inherits the launching shell's filesystem, network and credential access. Never treat it as isolated code execution. It is not suitable as AEGIS's untrusted-code sandbox.
- MCP server management can launch configured stdio subprocesses and connect to configured HTTP servers; this is powerful and requires allowlisted server definitions, pinned package versions, explicit environment/secret injection, network egress policy and action approvals. The sync command writes agent configuration files across detected hosts, so never run it against a user's machine without preview, explicit target list, backup and approval. HTTP gateway exposure requires authentication and network binding review; do not expose an unauthenticated listener.
- The project has destructive-operation, tool-output prompt-injection and credential-pattern checks, but these are defence-in-depth heuristics, not a policy engine or proof of safety. Tool annotations are server-supplied metadata; a readOnlyHint must never be treated as authorization. Keep AEGIS's exact-operation approvals and server-side enforcement authoritative.
- Credential handling deserves special review: OAuth tokens are stored in owner-only local files (0600 best-effort) and the explicit auth token command prints raw access tokens. This is not equivalent to encrypted vault storage. Do not import tokens into AEGIS or pass production credentials to a trial.
- Local-first/no-telemetry claims need to be scoped to local CLI operations: optional live registry search, remote MCP/HTTP servers, OpenAPI/GraphQL endpoints, configured providers and other integrations necessarily create external network paths. Verify per-command network behavior.
- Recommended evaluation sequence: (1) benchmark compact manifest and on-demand schema retrieval against AEGIS's own capability catalogue; (2) test MCP protocol compatibility and tool-call round trips with synthetic read-only tools; (3) inspect gateway HTTP auth/bind behavior and subprocess lifecycle; (4) compare host config adapters without writing to personal machine; (5) audit injection/credential/destructive-operation tests and false-positive/false-negative coverage; (6) assess whether to implement native AEGIS equivalents rather than adopt the CLI.
- Decision: high-value design/reference project; defer installation and connection. Implement an AEGIS-native compact capability index, schema-on-demand, tool search and health status in the existing control plane. Consider mcptoon only as an isolated optional adapter on a dedicated Linux worker after a pinned-version security review and measured benefit.
- No mcptoon package, CLI, MCP server, agent config, skill, OAuth token or external connection has been installed or changed for AEGIS.

Sources inspected:
- https://github.com/activeing123/mcptoon
- https://github.com/activeing123/mcptoon/blob/main/pyproject.toml
- https://github.com/activeing123/mcptoon/blob/main/SECURITY.md
- https://github.com/activeing123/mcptoon/blob/main/DEVELOPERS.md
- https://github.com/activeing123/mcptoon/blob/main/src/mcptoon/router.py
- https://github.com/activeing123/mcptoon/blob/main/src/mcptoon/client.py
- https://github.com/activeing123/mcptoon/blob/main/src/mcptoon/config.py
- https://github.com/activeing123/mcptoon/blob/main/src/mcptoon/exec_sandbox.py
- https://github.com/activeing123/mcptoon/blob/main/src/mcptoon/oauth.py
